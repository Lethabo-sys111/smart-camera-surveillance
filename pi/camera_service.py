#!/usr/bin/env python3
"""
Smart Camera Surveillance — Raspberry Pi camera service.

Runs on the Pi and does four jobs at once:
  1. Live stream   — serves MJPEG video at http://<pi-ip>:8000/stream.mjpg
  2. Motion        — detects movement (from the video, a PIR sensor, or both)
  3. Capture       — on motion while ARMED, takes a burst of photos
  4. Upload        — sends photos to the Laravel API, retrying if the network drops

State machine:
    DISARMED ──arm──▶ ARMED ──motion──▶ TRIGGERED ──burst done──▶ COOLDOWN ──timer──▶ ARMED
       ▲                │                                                              │
       └────disarm──────┴──────────────────────────────disarm──────────────────────────┘

The server decides armed/disarmed. The Pi learns it from every heartbeat/upload reply.
"""

import configparser
import io
import logging
import queue
import socket
import socketserver
import threading
import time
from http import server
from pathlib import Path

import numpy as np
import requests
from picamera2 import Picamera2
from picamera2.encoders import MJPEGEncoder
from picamera2.outputs import FileOutput

log = logging.getLogger("camera")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ---------------------------------------------------------------- config

CONFIG_PATH = Path(__file__).with_name("config.ini")
cfg = configparser.ConfigParser()
if not cfg.read(CONFIG_PATH):
    raise SystemExit(f"Missing {CONFIG_PATH}. Copy config.example.ini to config.ini and edit it.")

API_URL = cfg["server"]["api_url"].rstrip("/")
DEVICE_KEY = cfg["server"]["device_key"]
DEVICE_ID = cfg["server"].get("device_id", "cam-01")

WIDTH = cfg["camera"].getint("width", 1280)
HEIGHT = cfg["camera"].getint("height", 720)
FPS = cfg["camera"].getint("framerate", 15)
HFLIP = cfg["camera"].getboolean("hflip", False)
VFLIP = cfg["camera"].getboolean("vflip", False)

STREAM_PORT = cfg["stream"].getint("port", 8000)
STREAM_PATH = "/stream.mjpg"

MOTION_SOURCE = cfg["motion"].get("source", "camera").lower()
PIR_PIN = cfg["motion"].getint("pir_pin", 17)
# Percent of the picture that must change to count as motion
THRESHOLD = cfg["motion"].getfloat("threshold", 1.5)
BURST_COUNT = cfg["motion"].getint("burst_count", 3)
BURST_INTERVAL = cfg["motion"].getfloat("burst_interval", 0.5)
COOLDOWN = cfg["motion"].getfloat("cooldown", 10)

HEARTBEAT_INTERVAL = cfg["timing"].getfloat("heartbeat_interval", 5)

HEADERS = {"X-Device-Key": DEVICE_KEY, "X-Device-Id": DEVICE_ID, "Accept": "application/json"}

# ---------------------------------------------------------------- shared state


class State:
    """Values shared between threads. The lock keeps reads/writes safe."""

    def __init__(self):
        self.lock = threading.Lock()
        self.armed = False           # unknown until the server answers; stay safe = don't trigger
        self.capture_now = False     # "Take photo" button pressed in the web app
        self.cooldown_until = 0.0
        self.mode = "DISARMED"

    def apply_commands(self, data: dict):
        with self.lock:
            was_armed = self.armed
            self.armed = bool(data.get("armed", self.armed))
            if data.get("capture_now"):
                self.capture_now = True
            if self.armed != was_armed:
                self.mode = "ARMED" if self.armed else "DISARMED"
                log.info("Server says: %s", self.mode)


state = State()
stop = threading.Event()

# ---------------------------------------------------------------- live stream


class StreamingOutput(io.BufferedIOBase):
    """Holds the most recent JPEG frame from the encoder. Viewers and snapshots read from it."""

    def __init__(self):
        self.frame = None
        self.condition = threading.Condition()

    def write(self, buf):
        with self.condition:
            self.frame = buf
            self.condition.notify_all()

    def latest(self, timeout=2.0):
        with self.condition:
            self.condition.wait(timeout)
            return self.frame


output = StreamingOutput()


class StreamingHandler(server.BaseHTTPRequestHandler):
    def log_message(self, *_):  # keep the console quiet
        pass

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == STREAM_PATH:
            self.send_response(200)
            self.send_header("Age", "0")
            self.send_header("Cache-Control", "no-cache, private")
            self.send_header("Pragma", "no-cache")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=FRAME")
            self.end_headers()
            try:
                while not stop.is_set():
                    frame = output.latest()
                    if frame is None:
                        continue
                    self.wfile.write(b"--FRAME\r\n")
                    self.send_header("Content-Type", "image/jpeg")
                    self.send_header("Content-Length", str(len(frame)))
                    self.end_headers()
                    self.wfile.write(frame)
                    self.wfile.write(b"\r\n")
            except (BrokenPipeError, ConnectionResetError):
                pass  # viewer closed the live feed
        elif path == "/snapshot.jpg":
            frame = output.latest()
            self.send_response(200 if frame else 503)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            if frame:
                self.wfile.write(frame)
        else:
            self.send_error(404)


class StreamingServer(socketserver.ThreadingMixIn, server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True


# ---------------------------------------------------------------- server comms

upload_queue: "queue.Queue[tuple[bytes, str, int]]" = queue.Queue(maxsize=30)


def local_ip() -> str:
    """The Pi's LAN IP (the address other devices use to reach the live stream)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))  # no packets are sent; this just picks the right interface
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def heartbeat_loop():
    while not stop.is_set():
        try:
            r = requests.post(
                f"{API_URL}/api/device/heartbeat",
                json={"ip": local_ip(), "stream_port": STREAM_PORT, "stream_path": STREAM_PATH},
                headers=HEADERS,
                timeout=5,
            )
            r.raise_for_status()
            state.apply_commands(r.json())
        except requests.RequestException as e:
            log.warning("Heartbeat failed: %s", e)
        stop.wait(HEARTBEAT_INTERVAL)


def upload_loop():
    """Sends queued photos. If the server is unreachable, the photo is kept and retried."""
    while not stop.is_set():
        try:
            jpeg, trigger, burst_index = upload_queue.get(timeout=1)
        except queue.Empty:
            continue

        delay = 2
        while not stop.is_set():
            try:
                r = requests.post(
                    f"{API_URL}/api/device/upload",
                    files={"image": ("capture.jpg", jpeg, "image/jpeg")},
                    headers={**HEADERS, "X-Trigger": trigger, "X-Burst-Index": str(burst_index)},
                    timeout=15,
                )
                if r.status_code == 401:
                    log.error("Upload rejected: device key does not match the server's DEVICE_KEY")
                    break
                r.raise_for_status()
                state.apply_commands(r.json())
                log.info("Uploaded %s photo #%d (%d KB)", trigger, burst_index, len(jpeg) // 1024)
                break
            except requests.RequestException as e:
                log.warning("Upload failed (%s), retrying in %ss", e, delay)
                stop.wait(delay)
                delay = min(delay * 2, 30)


def queue_photo(trigger: str, burst_index: int):
    frame = output.latest()
    if not frame:
        log.warning("No frame available to capture")
        return
    try:
        upload_queue.put_nowait((bytes(frame), trigger, burst_index))
    except queue.Full:
        log.warning("Upload queue full (server offline?) — dropping photo")


# ---------------------------------------------------------------- motion detection


class CameraMotion:
    """
    Compares each small greyscale frame with the previous one.
    A pixel "changed" if its brightness moved by more than 25 (out of 255).
    If more than THRESHOLD percent of pixels changed, something moved.
    A sudden change of the WHOLE image brightness (lights switched on,
    IR LEDs turning on at dusk) is ignored so it does not count as an intruder.
    """

    def __init__(self, picam2: Picamera2, lores_w: int, lores_h: int):
        self.picam2 = picam2
        self.w, self.h = lores_w, lores_h
        self.prev = None

    def check(self) -> bool:
        yuv = self.picam2.capture_buffer("lores")
        cur = np.frombuffer(yuv, dtype=np.uint8)[: self.w * self.h].reshape(self.h, self.w).astype(np.int16)
        prev, self.prev = self.prev, cur
        if prev is None:
            return False
        brightness_jump = abs(float(cur.mean()) - float(prev.mean()))
        if brightness_jump > 25:
            return False
        changed_percent = float((np.abs(cur - prev) > 25).mean()) * 100
        return changed_percent > THRESHOLD


def make_pir():
    try:
        from gpiozero import MotionSensor
    except ImportError:
        raise SystemExit("gpiozero is needed for PIR mode: sudo apt install python3-gpiozero")
    log.info("PIR sensor on GPIO%d (warming up ~30s)", PIR_PIN)
    return MotionSensor(PIR_PIN)


def motion_loop(picam2: Picamera2, lores_size):
    cam_motion = CameraMotion(picam2, *lores_size) if MOTION_SOURCE in ("camera", "both") else None
    pir = make_pir() if MOTION_SOURCE in ("pir", "both") else None

    while not stop.is_set():
        # --- manual "Take photo" from the web app works even when disarmed ---
        with state.lock:
            manual = state.capture_now
            state.capture_now = False
        if manual:
            log.info("Manual capture requested")
            queue_photo("manual", 1)

        # Always read the camera so the "previous frame" stays fresh.
        cam_moved = cam_motion.check() if cam_motion else False
        pir_moved = bool(pir.motion_detected) if pir else False
        motion = cam_moved or pir_moved

        with state.lock:
            armed = state.armed
            cooling = time.monotonic() < state.cooldown_until
            if armed and state.mode == "COOLDOWN" and not cooling:
                state.mode = "ARMED"
                log.info("ARMED (cooldown over)")

        # Alarm condition: armed AND motion AND not cooling down
        if armed and motion and not cooling:
            with state.lock:
                state.mode = "TRIGGERED"
            log.info("MOTION detected (%s) — taking %d photos", "PIR" if pir_moved else "camera", BURST_COUNT)
            for i in range(1, BURST_COUNT + 1):
                queue_photo("motion", i)
                if i < BURST_COUNT:
                    stop.wait(BURST_INTERVAL)
            with state.lock:
                state.cooldown_until = time.monotonic() + COOLDOWN
                state.mode = "COOLDOWN"
            if cam_motion:
                cam_motion.prev = None  # start comparing fresh after the burst

        stop.wait(0.2)


# ---------------------------------------------------------------- main


def main():
    picam2 = Picamera2()
    lores_size = (320, 240)
    from libcamera import Transform

    config = picam2.create_video_configuration(
        main={"size": (WIDTH, HEIGHT)},
        lores={"size": lores_size, "format": "YUV420"},
        controls={"FrameRate": FPS},
        transform=Transform(hflip=HFLIP, vflip=VFLIP),
    )
    picam2.configure(config)
    picam2.start_recording(MJPEGEncoder(), FileOutput(output))
    log.info("Camera started at %dx%d @ %dfps", WIDTH, HEIGHT, FPS)

    httpd = StreamingServer(("", STREAM_PORT), StreamingHandler)
    threads = [
        threading.Thread(target=httpd.serve_forever, name="stream", daemon=True),
        threading.Thread(target=heartbeat_loop, name="heartbeat", daemon=True),
        threading.Thread(target=upload_loop, name="upload", daemon=True),
        threading.Thread(target=motion_loop, args=(picam2, lores_size), name="motion", daemon=True),
    ]
    for t in threads:
        t.start()
    log.info("Live stream: http://%s:%d%s", local_ip(), STREAM_PORT, STREAM_PATH)
    log.info("Sending photos to %s (motion source: %s)", API_URL, MOTION_SOURCE)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("Stopping…")
    finally:
        stop.set()
        httpd.shutdown()
        picam2.stop_recording()


if __name__ == "__main__":
    main()

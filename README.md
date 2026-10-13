Smart Camera Surveillance System

TUT Logic Design 126 (LOD216D) — Project 4.

A Raspberry Pi 3 B+ with a night-vision camera watches for motion. When it's armed and something moves, it takes a burst of photos and sends them to a web app. There you can browse the gallery, watch the live feed, arm/disarm the camera and take a photo on demand.

## Hardware

- Raspberry Pi 3 Model B+ (5V 2.5A micro-USB supply)
- Night-vision camera module 
- 2× infrared LED boards — screw onto the camera board's power holes. They are not controlled by code.
- PIR sensor

> Night-vision ("NoIR") cameras have no IR filter, so daytime photos look pinkish.

## 1. Backend 

Needs PHP 8.2+ and Composer.
This installs Laravel, merges in this project's files, creates the SQLite database, links photo storage and generates a `DEVICE_KEY`. Copy that key; the Pi needs it.

Set `APP_URL` in `backend/.env` to the address other devices use, so photo links work from your phone:

```
APP_URL=http://192.168.1.10:8080
```

Run it (listening on all interfaces so the Pi can reach it):

```bash
cd backend
PHP_CLI_SERVER_WORKERS=4 php artisan serve --host=0.0.0.0 --port=8080
```

## 2. Frontend

```bash
cd frontend
cp .env.example .env        # set VITE_API_URL=http://192.168.1.10:8080
npm install
npm run dev                 # open the URL it prints
```

Test it without the Pi:

```bash
bash tools/test-upload.sh some-photo.jpg
```

The photo appears in the gallery within ~5 seconds.

## 3. Raspberry Pi

Use Raspberry Pi OS (Bookworm). The camera is detected automatically.

```bash
libcamera-hello -t 3000           # quick camera check (rpicam-hello on newer images)
sudo apt install -y python3-picamera2 python3-requests python3-numpy python3-gpiozero

git clone https://github.com/<you>/smart-camera-surveillance.git
cd smart-camera-surveillance/pi
cp config.example.ini config.ini
nano config.ini                   # api_url = http://<laptop-ip>:8080, device_key = <DEVICE_KEY>
python3 camera_service.py
```

Start on boot:

```bash
sudo cp surveillance-camera.service /etc/systemd/system/
sudo systemctl enable --now surveillance-camera
journalctl -u surveillance-camera -f
```

## How it works (logic design)

**State machine** on the Pi:

```
DISARMED ──arm──▶ ARMED ──motion──▶ TRIGGERED ──burst done──▶ COOLDOWN ──10s──▶ ARMED
```

- **Alarm condition:** `armed AND motion AND NOT cooling_down` → capture.
- **Motion detection (camera mode):** compares each small greyscale frame with the last one. If more than `threshold`% of pixels changed noticeably, it counts as motion. A sudden change in the whole picture's brightness (lights on, IR LEDs switching on at dusk) is ignored.
- **Motion detection (PIR mode):** GPIO17 HIGH = motion. `both` mode ORs the two.
- **Burst + cooldown:** 3 photos 0.5s apart, then motion is ignored for 10s, so one person walking past isn't 40 photos.
- **Commands:** the Pi sends a heartbeat every 5s. The reply tells it whether it's armed and whether "Take photo" was pressed. The server never has to reach the Pi.
- **Offline buffering:** if the server is down, photos wait in a queue (up to 30) and are retried with increasing delays.
- **Security:** only requests with the correct `X-Device-Key` header can upload.

## API

| Method | Path | Called by | Purpose |
|---|---|---|---|
| POST | `/api/device/upload` | Pi | Upload a JPEG (`image` field). Returns `{armed, capture_now}` |
| POST | `/api/device/heartbeat` | Pi | Report IP and stream port. Returns `{armed, capture_now}` |
| GET | `/api/camera` | Web app | Status: online, armed, IP, stream URL, photo counts |
| PATCH | `/api/camera` | Web app | `{armed: true/false}` |
| POST | `/api/camera/capture` | Web app | Ask the Pi for a photo now |
| GET | `/api/captures?page=&date=` | Web app | Photos, newest first |
| DELETE | `/api/captures/{id}` | Web app | Delete a photo |

## Live feed note

The browser loads the stream straight from the Pi (`http://<pi-ip>:8000/stream.mjpg`). So your phone or laptop must be on the **same Wi-Fi** as the Pi. If the web app is served over HTTPS, the browser blocks the HTTP stream. For the demo, run everything on one hotspot over plain `http://`.

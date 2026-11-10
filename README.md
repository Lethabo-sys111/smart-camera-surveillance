# Sentinel — Smart Camera Surveillance System

**Module:** Digital Electronics 126 (LOD216D) · **Institution:** Tshwane University of Technology · **Project topic:** 4

Sentinel is a home security camera built on a Raspberry Pi 3. When it is armed and someone walks
past, it photographs them, sounds a siren and sends the owner a Telegram alert with a photo. The
siren keeps going until an authorised person disarms the system, either by tapping an NFC card on
the device or by pressing Disarm in a web dashboard. A 16x2 LCD on the device always shows whether
the system is ARMED or DISARMED.

---

## 1. How the system works

The system has three parts that talk to each other over one Wi-Fi network:

| Part | Runs on | Role |
| --- | --- | --- |
| **Device** | Raspberry Pi 3 | Senses motion, takes photos, streams live video, reads NFC cards, drives the LCD and siren |
| **Backend API** | Laptop (Laravel, PHP) | Stores the photos and the armed/disarmed setting |
| **Web dashboard** | Any browser (React) | Lets the owner see the status, photos and live feed, and arm or disarm |

```
 Raspberry Pi 3                         Laptop                         Phone / laptop browser
 ┌───────────────────────┐   HTTP    ┌─────────────────────────┐ HTTP  ┌───────────────────┐
 │ camera_service.py     │─────────▶│ Laravel REST API :8080  │◀──────│ React dashboard   │
 │  PIR, photos, stream  │           │  - armed flag           │       │ :5173             │
 │ nfc_service.py        │─────────▶│  - stored photos        │       └───────────────────┘
 │  NFC, LCD, siren      │           └─────────────────────────┘                │
 └───────────────────────┘◀───────────── live video :8000 (MJPEG) ─────────────┘
            │ when the alarm starts
            ▼
   Telegram photo alert + call to the owner (internet)
```

**Key design idea:** the backend holds one value, `armed`, and it is the single source of truth.
An NFC card, the dashboard button and the camera all read or change that same value, so the
device, the LCD and every open dashboard always agree.

### 1.1 Arming and disarming

- **With an NFC card:** the user taps a card on the RC522 reader. The Pi checks the card's ID against
  a list of authorised cards. If it matches, the Pi asks the backend to flip the armed state. The LCD
  then shows ARMED or DISARMED, and the buzzer beeps: two short beeps for armed, one long beep for
  disarmed. Unknown cards are ignored.
- **With the dashboard:** the user presses Arm, or presses Disarm and confirms. The Pi checks the
  backend every 2 seconds, so the LCD and buzzer follow within 2 seconds.

### 1.2 What happens when an intruder is detected

1. While the system is armed, the PIR sensor detects body heat moving and signals the Pi.
2. The camera takes a burst of 3 photos, 0.5 seconds apart, and uploads them to the backend.
3. At the same moment the siren starts. It pulses loudly and does **not** stop by itself.
4. The owner receives a Telegram message with a live photo, and their phone rings.
5. The dashboard turns red, shows "Intrusion detected", and the new photos appear in the gallery.
6. The siren stops only when an authorised card is tapped or the dashboard disarms the system.

### 1.3 Other features

- **Live feed:** the dashboard shows live video straight from the Pi's camera.
- **Manual photo:** the Take photo button asks the Pi to take a photo on demand.
- **Gallery:** every photo is stored with its time and whether it came from motion or was taken manually.
- **Activity timeline:** the dashboard lists recent motion events and arm/disarm changes.
- **Recovery:** if the network drops, the Pi keeps photos in a queue and uploads them later.

---

## 2. Hardware

The full circuit is in `docs/sentinel-schematic.png`.

| Component | Purpose | How it connects |
| --- | --- | --- |
| Raspberry Pi 3 Model B+ | Main controller | – |
| Pi camera module | Photos and live video | CSI ribbon cable |
| PIR motion sensor | Detects movement | Digital input, GPIO 17 |
| RC522 NFC reader | Reads authorised cards | SPI bus |
| 16x2 LCD (HD44780) | Shows ARMED / DISARMED | 4-bit parallel mode |
| 10 kΩ potentiometer | LCD contrast | Voltage divider on LCD V0 |
| Buzzer + BC547 transistor + 1 kΩ resistor | Beeps and siren | GPIO 27 switches the transistor, which runs the buzzer on 5V |

### Pin allocation

| Device | Signal | Pi physical pin | GPIO (BCM) |
| --- | --- | --- | --- |
| PIR sensor | OUT | 11 | 17 |
| Buzzer driver | Transistor base (via 1 kΩ) | 13 | 27 |
| RC522 | 3.3V / MOSI / MISO / RST / SCK / SDA / GND | 1 / 19 / 21 / 22 / 23 / 24 / 25 | – / 10 / 9 / 25 / 11 / 8 / – |
| LCD | RS / E / D4 / D5 / D6 / D7 | 37 / 35 / 33 / 31 / 29 / 40 | 26 / 19 / 13 / 6 / 5 / 21 |
| LCD | VDD / VSS / RW | 4 / 9 / 30 | 5V / GND / GND |

Design notes:
- The LCD's RW pin is tied to ground, so the LCD can only be written to and never sends 5V back into the Pi.
- The RC522 runs on 3.3V only. Its SPI speed was reduced and its antenna gain raised to make card reads reliable.
- The buzzer is switched through a transistor because a GPIO pin only gives 3.3V and a small current.

---

## 3. Software

### 3.1 Raspberry Pi (`pi/`)

| File | What it does |
| --- | --- |
| `camera_service.py` | Watches the PIR, takes and uploads photos, sends a heartbeat to the backend every few seconds, and serves the live video stream on port 8000 |
| `nfc_service.py` | Reads NFC cards, updates the LCD, runs the buzzer and siren, and starts the owner alert |
| `owner_call.py` | Sends the Telegram photo alert and rings the owner |
| `read_card.py` | Utility: prints a card's ID so it can be added to the authorised list |
| `add_chat_ids.py` | Utility: registers people who should receive Telegram alerts |
| `config.ini.example` | Settings for `camera_service.py` (server address, device key, motion settings) |
| `telegram.ini.example` | Telegram bot settings for `owner_call.py` |
| `surveillance-camera.service`, `nfc-reader.service` | Start both programs automatically when the Pi boots |

### 3.2 Backend (`backend/`)

A Laravel REST API. It stores the camera's settings and the `armed` flag in a `devices` table, and
the photo records in a `captures` table. Routes used by the Pi require a secret `X-Device-Key`
header, so other devices on the network can't upload photos or change the alarm.

| Method | Endpoint | Called by | Purpose |
| --- | --- | --- | --- |
| POST | `/api/device/heartbeat` | Pi | Report "online"; the reply says armed or not |
| POST | `/api/device/upload` | Pi | Upload a photo |
| POST | `/api/device/toggle` | Pi | Flip armed/disarmed after a card tap |
| GET | `/api/camera` | Dashboard, Pi | Status: armed, online, last seen, photo counts |
| PATCH | `/api/camera` | Dashboard | Arm or disarm |
| POST | `/api/camera/capture` | Dashboard | Request a manual photo |
| GET | `/api/captures` | Dashboard | List photos (paged, filter by day) |
| DELETE | `/api/captures/{id}` | Dashboard | Delete a photo |

### 3.3 Web dashboard (`frontend/`)

A React app built with Vite. It checks the backend every 3 seconds for the status and every
5 seconds for new photos. It shows a colour-coded status panel (green = disarmed, red = armed,
flashing = intrusion), an Arm/Disarm button with a confirmation before disarming, an activity
timeline, a photo gallery grouped by day, and the live feed.

---

## 4. How to run it

All devices must be on the same 2.4 GHz Wi-Fi network. Find the laptop's IP address with `hostname -I`.
Secrets have been removed: copy each `.example` file, remove `.example` from its name, and fill in
the values. Generate a device key with `openssl rand -hex 16` and use the same key everywhere.

**Backend (laptop)**

```bash
cd backend
composer install
cp .env.example .env            # set APP_URL and DEVICE_KEY
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
PHP_CLI_SERVER_WORKERS=12 php artisan serve --host=0.0.0.0 --port=8080
```

**Dashboard (laptop)**

```bash
cd frontend
npm install
echo "VITE_API_URL=http://<laptop-ip>:8080" > .env
npm run dev
```

Open `http://<laptop-ip>:5173` in any browser on the same Wi-Fi.

**Raspberry Pi**

```bash
sudo raspi-config nonint do_spi 0      # enable SPI for the NFC reader, then reboot
pip3 install mfrc522 spidev RPLCD requests --break-system-packages
cd pi
cp config.ini.example config.ini       # set api_url and device_key
cp telegram.ini.example telegram.ini   # set the Telegram bot token
python3 read_card.py                   # tap each card and note its ID
```

In `nfc_service.py`, set `API_URL`, `DEVICE_KEY` and `AUTHORISED_CARDS`. Then start both programs at boot:

```bash
sudo cp surveillance-camera.service nfc-reader.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now surveillance-camera nfc-reader
```

---

## 5. How to test it

1. Tap an authorised card: the LCD changes, the buzzer beeps, and the dashboard follows within 3 seconds.
2. Press Disarm in the dashboard: the LCD and buzzer follow within 2 seconds.
3. Arm the system and walk in front of the PIR: the siren sounds, photos appear in the gallery, and a Telegram alert arrives.
4. Tap a card or press Disarm: the siren stops.
5. Tap an unknown card: nothing changes.
6. Open the live feed, then press Take photo: a photo marked MANUAL appears in the gallery.

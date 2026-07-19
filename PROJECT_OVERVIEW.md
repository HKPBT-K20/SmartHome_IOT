# 🏠 SmartHome_IOT — Tài Liệu Tổng Hợp Toàn Diện

> **Tổng hợp:** 2026-07-19 | **Dựa trên:** source code thực tế + 4 file MD + git log 5 ngày gần đây

---

## 📋 Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [Phần cứng & Chân cắm](#3-phần-cứng--chân-cắm)
4. [Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
5. [Firmware ESP32 — Chi tiết từng module](#5-firmware-esp32--chi-tiết-từng-module)
6. [Firmware Arduino Uno — I/O Extension](#6-firmware-arduino-uno--io-extension)
7. [Dashboard Web — Chi tiết từng module](#7-dashboard-web--chi-tiết-từng-module)
8. [Firebase — Schema & Luồng dữ liệu](#8-firebase--schema--luồng-dữ-liệu)
9. [Luồng hoạt động từng tính năng](#9-luồng-hoạt-động-từng-tính-năng)
10. [Boot Sequence & Loop chính](#10-boot-sequence--loop-chính)
11. [Thư viện & Cài đặt môi trường](#11-thư-viện--cài-đặt-môi-trường)
12. [Cấu hình dự án (config.h)](#12-cấu-hình-dự-án-configh)
13. [Struct dữ liệu dùng chung](#13-struct-dữ-liệu-dùng-chung)
14. [Trạng thái tính năng](#14-trạng-thái-tính-năng)
15. [Lịch sử Git — 5 ngày gần đây](#15-lịch-sử-git--5-ngày-gần-đây)
16. [Phân công thành viên](#16-phân-công-thành-viên)
17. [Điểm cần xử lý trước demo/nộp](#17-điểm-cần-xử-lý-trước-demonộp)

---

## 1. Tổng quan dự án

**SmartHome_IOT** là hệ thống nhà thông minh sử dụng **ESP32** làm vi điều khiển trung tâm (Master Hub), kết hợp với **Arduino Uno** đóng vai trò mở rộng I/O. Hệ thống xử lý 3 nhóm tác vụ song song:

| Nhóm | Mô tả |
|---|---|
| **Time-Critical** | Hẹn giờ bật/tắt thiết bị dựa trên DS1307 RTC |
| **Event-Driven** | Kiểm soát vào/ra bằng RFID + Keypad, cảnh báo PIR |
| **Networking** | Đồng bộ Firebase, fetch API thời tiết, điều khiển từ xa qua web |

**Stack công nghệ:**
- Firmware: Arduino C++ (ESP32 Dev Module + Arduino Uno)
- Dashboard: HTML + Vanilla JS (ES Modules) + TailwindCSS
- Cloud: Firebase Realtime Database (asia-southeast1)
- Thời tiết: Open-Meteo API (free, không cần key)
- Thời gian: NTP → RTC DS1307 → compile-time fallback

---

## 2. Kiến trúc hệ thống

```
                                 ┌───────────────┐
                                 │  Arduino Uno  │
                                 │ (Keypad, PIR, │
                                 │  LDR, LM35)   │
                                 └───────┬───────┘
                                         │ SoftwareSerial / UART 9600 baud
                                         │ Giao thức: "KEY:X", "PIR:0/1",
                                         │            "LDR:NNNN", "TEMP:NN.N"
                                         ▼
User ──▶ Dashboard Web ──▶ Firebase ──▶ ESP32 Firmware ──▶ Firebase ──▶ Dashboard
                                         │
                            ┌────────────┴──────────────────┐
                            │          ESP32 Output         │
                            │  Relay CH1 (GPIO 32)          │
                            │  Relay CH2 (GPIO 33)          │
                            │  Servo SG90 (GPIO 25)         │
                            │  Buzzer (GPIO 14)             │
                            │  LCD I2C (GPIO 21/22)         │
                            │  RFID RC522 (SPI)             │
                            │  DHT11 (GPIO 27)              │
                            └───────────────────────────────┘
```

**Nguyên tắc vận hành:**
- Dashboard ghi lệnh lên Firebase → ESP32 poll mỗi 5s để thực thi
- ESP32 push trạng thái thực lên Firebase → Dashboard listen realtime
- Arduino Uno gửi dữ liệu qua UART → ESP32 xử lý và đẩy lên Firebase
- Toàn bộ firmware chạy **single-threaded**, không dùng RTOS, tất cả non-blocking bằng `millis()`

| Lớp | Công nghệ | Trạng thái |
|---|---|---|
| Dashboard | HTML + Vanilla JS (ES Module) + TailwindCSS | ✅ Hoàn chỉnh |
| Firebase | Realtime Database (asia-southeast1) | ✅ Đã setup thật |
| Firmware (ESP32) | Arduino C++ — Master Hub | ✅ Hoàn chỉnh |
| Extension (Uno) | Arduino C++ — I/O Extension | ✅ Hoàn chỉnh |

---

## 3. Phần cứng & Chân cắm

### Board 1: ESP32 (Master Hub)

| Linh kiện | GPIO (ESP32) | Giao tiếp | Ghi chú |
|---|---|---|---|
| **DHT11** | GPIO **27** | Digital | Đo nhiệt độ + độ ẩm không khí |
| **DS1307 RTC** | GPIO **21** (SDA), **22** (SCL) | I2C | Chung bus với LCD. `RTC_ENABLED` đã define |
| **LCD 1602 I2C** | GPIO **21** (SDA), **22** (SCL), addr `0x27` | I2C | Hiển thị T/H/L/Air + cảnh báo "Uno ERR" |
| **RFID RC522** | SCK=**18**, MOSI=**23**, MISO=**19**, SS=**5**, RST=**-1** | SPI | ⚠️ MOSI/MISO bị hoán đổi so với sơ đồ gốc |
| **Servo SG90** | GPIO **25** | PWM (Timer 2/3) | 0°=mở cửa, 90°=đóng cửa |
| **Relay CH1** | GPIO **32** | Digital | Đèn phòng làm việc. `on=true → HIGH` |
| **Relay CH2** | GPIO **33** | Digital | Đèn phòng khách. `on=true → HIGH` |
| **Buzzer** | GPIO **14** | Digital | State machine non-blocking |
| **Air Quality (MQ)** | GPIO **35** | ADC | Đọc PPM, mapping 350–2000 |
| **Arduino Uno (UART)** | RX=**16**, TX=**17** | Serial2 (9600) | Watchdog 5s — hiện "Uno ERR" nếu mất kết nối |

> ⚠️ GPIO 6–11: **KHÔNG dùng** (kết nối flash nội). GPIO 34–39: chỉ INPUT.  
> ⚠️ Relay 3, 4 (GPIO 18, 23) **xung đột** với SPI RFID — không sử dụng được.

### Board 2: Arduino Uno (I/O Extension)

| Linh kiện | Pin (Uno) | Giao tiếp | Ghi chú |
|---|---|---|---|
| **Keypad 4×4 Rows** | D**2, 3, 4, 5** | Digital | Thư viện Keypad |
| **Keypad 4×4 Cols** | D**6, 7, 8, 9** | Digital | — |
| **PIR HC-SR501** | D**10** | Digital | Polling + confirm 200ms HIGH mới xác nhận |
| **LDR/CDS** | A**0** | Analog | Đọc 10-bit × 4 → gần 12-bit, gửi qua UART dạng `LDR:NNNN` |
| **LM35** | A**1** | Analog | Đọc 50 mẫu, gửi qua UART dạng `TEMP:NN.N` |
| **ESP32 (UART)** | RX=D**11**, TX=D**12** | SoftwareSerial | Baud 9600 |

**Giao thức UART Uno → ESP32:**
```
KEY:X         — nhấn phím X trên keypad
PIR:0 / PIR:1 — trạng thái PIR (0=không có chuyển động, 1=có)
LDR:NNNN      — mức ánh sáng (0–4092 tương đương 0–4095 ADC 12-bit)
TEMP:NN.N     — nhiệt độ từ LM35 (°C)
```

---

## 4. Cấu trúc thư mục

```
SmartHome_IOT/
│
├── firmware/
│   ├── config.example.h          # Template — copy thành config.h
│   ├── main/                     # Sketch ESP32 — mở folder này bằng Arduino IDE
│   │   ├── main.ino              # Loop chính, gọi các module
│   │   ├── sensor.ino            # DHT11, DS1307 RTC, Air Quality
│   │   ├── display.ino           # LCD I2C 16×2
│   │   ├── security.ino          # RFID, Keypad, PIR, UART Uno handler
│   │   ├── actuator.ino          # Relay, Servo, Buzzer, Smart Lighting
│   │   ├── network.ino           # WiFi, Firebase push/listen, Schedule
│   │   ├── weather.ino.bak       # ❌ Tạm disabled — fetch OpenWeatherMap
│   │   ├── config.h              # 🔒 KHÔNG push Git (gitignore)
│   │   └── types.h               # Struct dùng chung: SensorData, AccessLog, RelayScheduleConfig
│   │
│   ├── rtc_setup/
│   │   └── rtc_setup.ino         # Sketch riêng để set thời gian RTC lần đầu
│   │
│   └── uno_extension/
│       └── uno_extension.ino     # Sketch Arduino Uno: Keypad + PIR + LDR + LM35 → UART
│
├── dashboard/
│   ├── index.html                # SPA duy nhất — tất cả views trong 1 file
│   ├── app.js                    # ⚠️ Legacy — không phải entry point thực
│   ├── env.js                    # Cấu hình Firebase endpoint + demo credentials
│   ├── .hintrc                   # ESLint hint config
│   └── js/
│       ├── app.js                # ✅ Entry point thực: init modules, navigation, theme
│       ├── core/
│       │   ├── firebase.js       # Firebase SDK init + Mock mode
│       │   └── ui.js             # Toast, modal, theme toggle, sidebar
│       └── features/
│           ├── auth.js           # Mock login/logout (localStorage)
│           ├── home.js           # Sensor display + relay manual control
│           ├── schedule.js       # Hẹn giờ 2 kênh CH1/CH3
│           ├── security.js       # PIR motion + còi + chế độ an ninh
│           ├── logs.js           # Access log realtime + clear
│           └── weather.js        # Open-Meteo API + geolocation
│
├── README.md
├── STATUS.md
├── FLOW.md
├── DASHBOARD_FIREBASE_IOT_FLOW.md
├── PROJECT_OVERVIEW.md           # ← File này
├── AGENTS.md
├── .env                          # Firebase credentials thật (gitignore)
└── .gitignore
```

---

## 5. Firmware ESP32 — Chi tiết từng module

### `main.ino` — Loop chính

```cpp
void setup() {
  Serial2.begin(9600, SERIAL_8N1, 16, 17);  // UART với Uno
  setupSensors();
  setupRTC();
  setupDisplay();
  setupActuator();
  setupSecurity();
  setupFirebase();
}

void loop() {
  handleUnoCommunication();   // UART Uno → xử lý KEY/PIR/LDR
  updateTime();               // Lấy giờ từ RTC/NTP/millis
  checkRFID();                // Quét SPI RFID
  checkKeypad();              // Kiểm tra lockout timeout
  checkPIR(currentHour);      // Xử lý PIR + cooldown
  updateDoor();               // Tự đóng sau 3s
  updateBuzzer();             // State machine còi
  updateDisplay();            // LCD mỗi 1s

  updateSmartLighting();      // Đèn thông minh tự động (CH1)

  if (now - lastAirPush >= 5000)     pushAirQuality();  // Air quality mỗi 5s
  if (now - lastSensorPush >= 30000) pushSensors();     // Sensors mỗi 30s
  if (now - lastCmdPoll >= 5000)     listenCommands();  // Relay+Schedule mỗi 5s
  if (newLogAvailable)               pushAccessLog();   // Log ngay khi có sự kiện
}
```

---

### `sensor.ino` — Cảm biến

| Hàm | Mô tả |
|---|---|
| `setupSensors()` | `analogReadResolution(12)`, `dht.begin()` |
| `setupRTC()` | Khởi tạo DS1307. Nếu `RTC_ENABLED` chưa define → test mode |
| `readTemperature()` | Đọc DHT11 (`dht.readTemperature()`). Trả `-999.0f` nếu NaN |
| `readLightLevel()` | Trả `currentLightLevel` (được cập nhật từ UART Uno qua `LDR:`) |
| `readHumidity()` | Đọc DHT11 (`dht.readHumidity()`). Validate range 0–100% |
| `readDHTTemperature()` | Đọc nhiệt độ DHT11 (alias của readTemperature) |
| `updateTime()` | Cập nhật `currentHour` từ RTC (nếu `RTC_ENABLED`) hoặc `millis()` |
| `getTimeString()` | Trả chuỗi `"HH:MM:SS DD/MM/YY"` |
| `readAirQualityPPM()` | Đọc GPIO 35 (MQ sensor), mapping thành PPM (350–2000) |

**Pin definitions trong `sensor.ino`:**
- `DHT_PIN = 27`, `DHT_TYPE = DHT11`
- Biến chia sẻ: `int currentHour`, `int currentLightLevel`

---

### `display.ino` — LCD I2C

- LCD 16×2 địa chỉ `0x27`, I2C GPIO 21/22
- `updateDisplay()` throttle 1s, dùng `lcd.print()` từng char — **không flicker**
- **Dòng 0:** `T:XX.X°   H:XX.X%` (nhiệt độ + độ ẩm DHT11)
- **Dòng 1:** `L:XXXX   A:XXXX` (ánh sáng LDR + air quality PPM)
- Nếu `unoOnline == false` → hiển thị `ERR` thay cho giá trị cảm biến Uno

---

### `security.ino` — Bảo mật + UART Handler

**RFID RC522:**
- SPI init: `SPI.begin(18, 23, 19, SS_PIN)` — SCK=18, MOSI=23, MISO=19, SS=5
- FM17522 fix: kiểm tra `TxControlReg`, set `AntennaGain_max`
- Đọc UID hex, `toUpperCase()`, so khớp với `validUIDs[]` từ `config.h`
- Debounce: không quét trong thời gian cửa đang mở (`DOOR_OPEN_MS = 3000ms`)

**Keypad (qua UART từ Uno):**
- Nhận ký tự qua `processKey(char key)`
- `'*'` → xóa buffer | `'#'` → xác nhận PIN (tối đa 6 ký tự)
- Sai 3 lần → lock 30 giây + `alertBuzzer()`
- PIN từ `SECURITY_PIN` trong `config.h`

**PIR (qua UART từ Uno):**
- Nhận trạng thái qua `PIR:0` / `PIR:1` từ Uno
- `currentPIRState` được cập nhật realtime
- `checkPIR()` kiểm tra `securityMode`, cooldown ngày/đêm

**UART Uno Handler (`handleUnoCommunication()`):**
- Buffer line-by-line từ `Serial2`
- Parse prefix: `KEY:`, `PIR:`, `LDR:`
- Watchdog: nếu >5s không nhận được dữ liệu → `unoOnline = false`, hiển thị ERR trên LCD, push `/security/uno_online = false`

**`fillAccessLog()`** — Tạo struct `AccessLog` đầy đủ:
- Timestamp ưu tiên: NTP (`getLocalTime`) → RTC → fallback hardcode
- Granted: `actorId="user_001"`, `actorName="Vo Nguyen Thien Phu"`
- Denied: `actorId="unknown"`, `actorName="Unknown User"`

---

### `actuator.ino` — Điều khiển thiết bị

**Pin definitions:**
- `SERVO_PIN = 25`, `BUZZER = 14`, `RELAY_1 = 32`, `RELAY_2 = 33`

**Relay:**
- Relay logic: `on=true → HIGH` (không phải active-LOW như README mô tả ban đầu)
- `setRelay(ch, on)` — idempotent (chỉ ghi nếu trạng thái thay đổi)
- Chỉ hỗ trợ ch=1 và ch=3 (map tương ứng vào GPIO 32, 33)

**Servo:**
- `0°` = mở cửa | `90°` = đóng cửa
- Tự đóng sau 3000ms không blocking (qua `updateDoor()`)
- Timer 2 & 3 (tránh xung đột với WiFi/BT)

**Buzzer state machine (non-blocking):**
```
alertBuzzer(n) → set _buz.active, beepsTotal=n
updateBuzzer() → toggle HIGH/LOW mỗi 200ms, dừng sau n beeps
stopBuzzer()   → tắt ngay lập tức (dùng khi hết PIR active)
```
- `alertBuzzer(9999)` → còi liên tục cho đến khi `stopBuzzer()` được gọi

**Smart Lighting Automation (`updateSmartLighting()`):**

| Khung giờ | Điều kiện bật | Timeout tắt |
|---|---|---|
| Tối (18:00–21:59) | PIR phát hiện chuyển động | 15 phút kể từ lần cuối |
| Ngủ (22:00–05:59) | PIR phát hiện chuyển động | 3 phút kể từ lần cuối |
| Ngày (06:00–17:59) | PIR + LDR dark (`> 2000`) | 15 phút kể từ lần cuối |

- Điều khiển Relay CH1 (đèn chính)
- Chỉ xử lý nếu đã từng có chuyển động (`lastMotionTime != 0`)

---

### `network.ino` — WiFi, Firebase, Schedule

**Setup (`setupFirebase()`):**
1. WiFi kết nối (timeout 15s)
2. NTP sync: `configTime(7*3600, 0, "time.google.com", "pool.ntp.org")`
3. Fallback thời gian: NTP → compile-time → RTC (nếu `RTC_ENABLED`)
4. Firebase init: `database_url`, `legacy_token`, `socketConnection = 1500ms`
5. Push initial state: relay state, `motion_detected=false`, `alarm_status=false`

**`pushSensors()` — mỗi 30s:**
- Push `/sensors/temp`, `/sensors/light`, `/sensors/humidity`, `/sensors/time`
- Bỏ qua `temp` nếu DHT11 trả về `-999.0f`

**`pushAirQuality()` — mỗi 5s:**
- Push `/sensors/air` (PPM)
- Nếu `air > 600 PPM` → `alertBuzzer(5)`

**`pushAccessLog()` — event-driven:**
- Gọi khi `newLogAvailable == true`
- Push JSON đầy đủ lên `/access_logs` bằng `Firebase.pushJSON()`
- Reset cờ `newLogAvailable = false` ngay trước khi push

**`listenCommands()` — mỗi 5s:**
- Đọc `/commands/relay_1`, `/commands/relay_3` → `setRelay()` + `pushRelayState()`
- `syncSecurityMode()` → đọc `/security/mode` vào `securityMode[]`
- Đọc `/security/alarm_status` → bật/tắt còi nếu thay đổi
- `syncScheduleChannel(1)`, `syncScheduleChannel(3)` → thực thi lịch

**Schedule logic (`syncScheduleChannel()`):**
- Đọc `/schedules/ch{n}/enabled`, `on_time`, `off_time`
- Hỗ trợ lịch qua đêm: nếu `on_time > off_time` → xử lý theo vòng quanh nửa đêm
- **Manual override**: nếu người dùng tắt đèn thủ công trong khung giờ hẹn → skip hôm đó (`scheduleSkipDay`)
- Nguồn giờ ưu tiên: NTP → RTC → `millis()`

---

### `weather.ino.bak` — ❌ Tạm disabled

File này không được compile (đuôi `.bak`). Chứa logic:
- Fetch `api.openweathermap.org/data/2.5/weather?id={CITY_ID}`
- Parse JSON bằng ArduinoJson (`StaticJsonDocument<2048>`)
- Lưu vào `WeatherData currentWeather` (temperature + weatherDesc)
- Cần thêm `WEATHER_KEY` và `CITY_ID` vào `config.h`
- Cần đổi lại thành `.ino` và thêm `fetchWeather()` vào `loop()` trong `main.ino`

---

## 6. Firmware Arduino Uno — I/O Extension

**File:** `firmware/uno_extension/uno_extension.ino`

```
Keypad 4×4: Rows=D2,3,4,5 | Cols=D6,7,8,9
PIR:        D10 (polling, confirm 200ms HIGH)
LDR:        A0  (10-bit × 4 → scale ~12-bit)
LM35:       A1  (50 mẫu trung bình, delay 1ms/mẫu)
UART TX:    D12 → ESP32 RX D16 (SoftwareSerial 9600)
```

**Logic gửi UART:**
- Keypad: gửi ngay khi có phím `KEY:X`
- PIR: gửi khi trạng thái thay đổi HOẶC mỗi 5s heartbeat `PIR:0/1`
- LDR: gửi mỗi 5s `LDR:NNNN`
- LM35: gửi mỗi 5s `TEMP:NN.N`

---

## 7. Dashboard Web — Chi tiết từng module

### `js/core/firebase.js` — Firebase SDK + Mock Mode

- Init Firebase app với config từ `env.js`
- **Mock mode**: khi config chứa `"YOUR_"` → chạy offline bằng localStorage
- LocalStorage keys: `smarthomeMockSession`, `smarthomeMockSchedules`, `smarthomeMockSecurity`, `smarthomeMockAccessLogs`
- Export: `db` (Firebase database instance hoặc mock object)

### `js/core/ui.js` — Utilities

- Toast notifications (success/error/warning/info)
- Modal confirm
- Theme toggle (Dark/Light) + lưu localStorage + theo system preference
- Sidebar: collapse desktop, overlay mobile

### `js/features/auth.js` — Xác thực

- Mock login: kiểm tra credentials từ `env.js` với localStorage
- Không dùng Firebase Authentication thật
- Account demo cấu hình qua `.env`: `hkpbSmartHome@gmail.com`

### `js/features/home.js` — Trang chủ

- Listen `/sensors` → cập nhật thẻ: Nhiệt độ, Ánh sáng, Độ ẩm
- Điều khiển relay: ghi `/commands/relay_1`, `/commands/relay_3`
- Listen `/relay/ch1`, `/relay/ch3` → cập nhật trạng thái nút ON/OFF
- ⚠️ Ô "Air Quality" map `sensors.air` (PPM từ MQ sensor)

### `js/features/schedule.js` — Hẹn giờ

- UI nhập `on_time` / `off_time` (HH:MM) cho CH1 và CH3
- Validate format `HH:MM`
- Lưu lên `/schedules/ch1`, `/schedules/ch3`
- Bật/tắt lịch qua `enabled`
- **Mock mode**: lưu localStorage khi không có Firebase thật

### `js/features/security.js` — An ninh

- Chọn chế độ: `always` / `night_only` / `disabled` → write `/security/mode`
- Listen `/security/motion_detected` → animate pulse khi có chuyển động
- Kích hoạt/tắt còi thủ công → write `/security/alarm_status`
- Reset cảnh báo → clear `alarm_status + motion_detected`

### `js/features/logs.js` — Lịch sử truy cập

- Listen `/access_logs` + legacy `/access_log` (normalize 2 schema)
- Hiển thị bảng realtime
- Xóa log: confirm modal → remove Firebase node

### `js/features/weather.js` — Thời tiết

- Sử dụng **Open-Meteo API** (free, không cần API key)
- Geolocation (nếu user cho phép) + reverse geocode tên thành phố
- Fallback: TP.HCM coordinates
- Tự refresh mỗi 10 phút

---

## 8. Firebase — Schema & Luồng dữ liệu

### Schema đầy đủ

```
/ (root)
├── sensors/
│   ├── temp          → float     (DHT11 °C, push mỗi 30s)
│   ├── light         → int       (LDR 0–4095, từ Uno qua UART)
│   ├── humidity      → float     (DHT11 %, push mỗi 30s)
│   ├── time          → string    ("HH:MM:SS DD/MM/YY")
│   └── air           → int       (MQ PPM 350–2000, push mỗi 5s)
│
├── relay/
│   ├── ch1           → bool      (trạng thái thực tế relay CH1)
│   └── ch3           → bool      (trạng thái thực tế relay CH3)
│
├── commands/
│   ├── relay_1       → bool      (dashboard ghi, ESP32 poll 5s)
│   └── relay_3       → bool
│
├── schedules/
│   ├── ch1/
│   │   ├── on_time   → "HH:MM"
│   │   ├── off_time  → "HH:MM"
│   │   ├── enabled   → bool
│   │   └── mode      → "daily"
│   └── ch3/ (cấu trúc giống ch1)
│
├── security/
│   ├── mode            → "always" | "night_only" | "disabled"
│   ├── alarm_status    → bool
│   ├── motion_detected → bool
│   └── uno_online      → bool      (watchdog Uno — mới thêm)
│
└── access_logs/
    └── {auto-key}/
        ├── created_at     → int (timestamp ms)
        ├── display_time   → "DD/MM/YYYY HH:MM:SS"
        ├── auth_method    → "RFID" | "KEYPAD"
        ├── identity_type  → "RFID" | "PIN"
        ├── identity_value → UID hex hoặc PIN đã nhập
        ├── actor_id       → "user_001" | "unknown"
        ├── actor_name     → "Vo Nguyen Thien Phu" | "Unknown User"
        ├── result         → "Success" | "Failed"
        └── granted        → bool
```

### Luồng dữ liệu tổng quát

```
User → Dashboard → Firebase → ESP32 → Firebase → Dashboard
                     ▲
                     │ push sensors, log, relay state, security
                Arduino Uno ──UART──▶ ESP32
```

---

## 9. Luồng hoạt động từng tính năng

### 9.1 Điều khiển Relay thủ công

```
Dashboard bấm ON/OFF
  → ghi /commands/relay_1 hoặc /commands/relay_3
  → ESP32 listenCommands() mỗi 5s
  → setRelay(ch, val) → digitalWrite
  → pushRelayState(ch, val) → /relay/ch1 hoặc /relay/ch3
  → Dashboard listen /relay → cập nhật nút trạng thái
```

### 9.2 Hẹn giờ tự động

```
Dashboard nhập HH:MM → validate → ghi /schedules/ch{n}
  → ESP32 syncScheduleChannel() mỗi 5s
  → So sánh giờ hiện tại (NTP/RTC/millis) với khung giờ
  → Trong khung giờ → setRelay ON, pushRelayState
  → Ngoài khung giờ → setRelay OFF, pushRelayState
  → Manual override: user tắt thủ công trong khung giờ → skip cả ngày
  → Lịch qua đêm: on_time > off_time được hỗ trợ
```

### 9.3 RFID kiểm soát cửa

```
Quét thẻ
  → Đọc UID hex (toUpperCase)
  → So khớp validUIDs[] (từ config.h RFID_UID)
  → GRANTED: openDoor() → Servo 0° → tự đóng sau 3s
  → DENIED:  alertBuzzer(3)
  → fillAccessLog("RFID", "RFID", uid, granted)
  → newLogAvailable = true → pushAccessLog() → /access_logs
```

### 9.4 Keypad PIN

```
Nhập PIN (tối đa 6 ký tự) qua UART từ Uno
  → '*' xóa | '#' xác nhận
  → So khớp với SECURITY_PIN từ config.h
  → GRANTED: openDoor(), reset wrongAttempts
  → DENIED:  wrongAttempts++
             ≥ 3 lần → lock 30s + alertBuzzer(3)
  → fillAccessLog("KEYPAD", "PIN", inputPIN, granted)
  → newLogAvailable = true → pushAccessLog()
```

### 9.5 PIR chống trộm

```
Uno confirm PIR 200ms HIGH → gửi "PIR:1" qua UART
  → ESP32 nhận → currentPIRState = true
  → checkPIR(currentHour):
      Kiểm tra securityMode (đọc từ Firebase mỗi 5s)
      Kiểm tra cooldown (ngày=5 phút, đêm=30 giây)
      Hợp lệ:
        → alertBuzzer(9999) — còi liên tục
        → pushSecurityMotion(true) → /security/motion_detected
        → pushSecurityAlarm(true)  → /security/alarm_status
        → motionDetectedUntil = now + 5000ms
      Sau 5s:
        → stopBuzzer()
        → pushSecurityMotion(false)
        → pushSecurityAlarm(false)
  → Dashboard listen /security → animate pulse
```

### 9.6 Smart Lighting

```
PIR kích hoạt → lastMotionTime = now
updateSmartLighting() mỗi vòng loop:
  - Tối (18–22h): có motion trong 15 phút → bật CH1
  - Ngủ (22–6h):  có motion trong 3 phút  → bật CH1
  - Ngày (6–18h): có motion + LDR tối (>2000) trong 15 phút → bật CH1
  → setRelay(1, true/false)
```

### 9.7 Access Log

```
Security event (RFID/Keypad)
  → fillAccessLog() tạo AccessLog struct
  → newLogAvailable = true
  → pushAccessLog() → Firebase.pushJSON("/access_logs", json)
  → Dashboard logs.js listen → bảng cập nhật realtime
  → User có thể xóa log (confirm modal → remove Firebase node)
```

### 9.8 Air Quality Alert

```
pushAirQuality() mỗi 5s
  → readAirQualityPPM() từ GPIO 35
  → Firebase.setInt("/sensors/air", ppm)
  → Nếu ppm > 600 → alertBuzzer(5)
  → Dashboard home.js hiển thị PPM realtime
```

---

## 10. Boot Sequence & Loop chính

### Boot Sequence

```
Serial.begin(115200)
Serial2.begin(9600, SERIAL_8N1, 16, 17)   ← UART với Uno
delay(1000)

setupSensors()    → analogReadResolution(12), dht.begin()
setupRTC()        → DS1307 I2C (fallback test mode nếu không cắm)
setupDisplay()    → Wire.begin(21,22), LCD init "System Ready"
setupActuator()   → Relay LOW (tắt), Servo 90° (đóng), Buzzer OUTPUT
setupSecurity()   → SPI.begin(18,23,19,5), RFID init, FM17522 fix

setupFirebase():
  WiFi.begin() → chờ tối đa 15s
  configTime(GMT+7, "time.google.com", "pool.ntp.org")
  Fallback 1: compile-time (dev only)
  Fallback 2: RTC (production, nếu RTC_ENABLED)
  Firebase.begin() → legacy_token
  socketConnection timeout = 1500ms
  Push initial state (relay OFF, motion=false, alarm=false)
```

### Loop chính (thực tế trong code)

```
Mỗi vòng loop (<1ms):
  ├─ handleUnoCommunication()  → UART parse KEY/PIR/LDR + watchdog 5s
  ├─ updateTime()              → currentHour từ RTC/NTP/millis
  ├─ checkRFID()               → SPI RFID scan
  ├─ checkKeypad()             → lockout timeout check
  ├─ checkPIR(hour)            → PIR state + cooldown + security mode
  ├─ updateDoor()              → đóng cửa sau 3s
  ├─ updateBuzzer()            → state machine còi
  ├─ updateDisplay()           → LCD mỗi 1s (T/H/L/Air)
  ├─ updateSmartLighting()     → đèn thông minh tự động
  │
  ├─ pushAirQuality()          mỗi 5s    — /sensors/air
  ├─ pushSensors()             mỗi 30s   — temp/light/humidity/time
  ├─ listenCommands()          mỗi 5s    — relay + security + schedule
  └─ pushAccessLog()           event     — khi newLogAvailable == true

  ❌ fetchWeather()            — KHÔNG CÓ (weather.ino.bak bị loại)
```

---

## 11. Thư viện & Cài đặt môi trường

### Arduino IDE

- Phiên bản: 2.x
- Board: ESP32 Dev Module
- Board URL: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`

### Thư viện ESP32

| Thư viện | Dùng cho | Tác giả |
|---|---|---|
| RTClib | DS1307 RTC | Adafruit |
| LiquidCrystal I2C | LCD I2C | Frank de Brabander |
| MFRC522 | RFID RC522 | miguelbalboa |
| ESP32Servo | Servo SG90 | Kevin Harrington |
| FirebaseESP32 | Firebase Realtime DB | mobizt |
| DHT sensor library | DHT11 | Adafruit |
| ArduinoJson | Parse JSON (weather) | Benoit Blanchon |

### Thư viện Uno

| Thư viện | Dùng cho |
|---|---|
| Keypad | Keypad 4×4 |

---

## 12. Cấu hình dự án (config.h)

```cpp
// firmware/main/config.h — KHÔNG push lên Git
#ifndef CONFIG_H
#define CONFIG_H

#define WIFI_SSID     "tên_wifi"
#define WIFI_PASS     "mật_khẩu_wifi"
#define FIREBASE_URL  "https://<project>.firebaseio.com"
#define FIREBASE_KEY  "your_api_key"
#define SECURITY_PIN  "123456"          // PIN mở cửa 6 ký tự
#define RFID_UID      "4362F506"        // UID thẻ RFID hợp lệ

#define RTC_ENABLED   // Comment out để chạy test mode không cần RTC thật

// Cho weather.ino (hiện đang .bak):
// #define WEATHER_KEY  "openweathermap_api_key"
// #define CITY_ID      "1580578"  // TP.HCM

#endif
```

---

## 13. Struct dữ liệu dùng chung

```cpp
// firmware/main/types.h

struct SensorData {
  float temperature;  // Nhiệt độ (°C) từ DHT11
  int   lightLevel;   // Mức độ ánh sáng từ LDR (0–4095)
  char  time[20];     // "HH:MM:SS DD/MM/YY"
};

struct AccessLog {
  uint64_t createdAt;         // Timestamp ms
  char     displayTime[32];   // "DD/MM/YYYY HH:MM:SS"
  char     authMethod[16];    // "KEYPAD" | "RFID"
  char     identityType[16];  // "PIN" | "RFID"
  char     identityValue[32]; // Mã PIN hoặc UID thẻ
  char     actorId[32];       // "user_001" | "unknown"
  char     actorName[64];     // "Vo Nguyen Thien Phu" | "Unknown User"
  char     result[16];        // "Success" | "Failed"
  bool     granted;
};

struct RelayScheduleConfig {
  char onTime[6];   // "HH:MM"
  char offTime[6];  // "HH:MM"
  bool enabled;
  bool valid;
};

// Shared function prototypes
void openDoor();
void closeDoor();
void alertBuzzer(int beeps = 3);
void stopBuzzer();
void setRelay(int ch, bool on);
float readTemperature();
int readLightLevel();
bool readHumidity(float &humidity);
bool readDHTTemperature(float &tempVal);
void getTimeString(char *buffer);
void pushSecurityMotion(bool detected);
void pushSecurityAlarm(bool active);
```

> ⚠️ **Không tự ý thay đổi layout struct** — sẽ phá vỡ serialization Firebase và compatibility giữa các module.

---

## 14. Trạng thái tính năng

### ✅ Firmware — Đã hoàn chỉnh

| Tính năng | File | Chi tiết |
|---|---|---|
| Đọc nhiệt độ + độ ẩm DHT11 | `sensor.ino` | Validate NaN + range |
| Đọc ánh sáng LDR (qua Uno) | `sensor.ino` | Nhận từ UART `LDR:` |
| Đọc Air Quality MQ | `sensor.ino` | GPIO 35, PPM 350–2000 |
| Đồng hồ RTC DS1307 | `sensor.ino` | `RTC_ENABLED` + NTP fallback |
| Hiển thị LCD 4 thông số | `display.ino` | T/H/L/Air, 1s throttle, no flicker |
| Servo mở/đóng cửa | `actuator.ino` | 0°=mở, 90°=đóng, tự đóng 3s |
| Relay 2 kênh | `actuator.ino` | CH1=GPIO32, CH3=GPIO33, on→HIGH |
| Buzzer non-blocking | `actuator.ino` | State machine, stopBuzzer() ngay lập tức |
| Smart Lighting tự động | `actuator.ino` | PIR + giờ + LDR |
| RFID RC522 | `security.ino` | UID hex, FM17522 fix, debounce |
| Keypad PIN (qua UART) | `security.ino` | 6 ký tự, lock 30s sau 3 lần sai |
| PIR chống trộm | `security.ino` | Polling Uno + confirm 200ms + cooldown |
| UART Uno handler | `security.ino` | KEY/PIR/LDR parse, watchdog 5s |
| Access log đầy đủ | `security.ino` + `network.ino` | Struct + push Firebase event-driven |
| WiFi + NTP | `network.ino` | GMT+7, fallback compile-time → RTC |
| Firebase push sensors | `network.ino` | Mỗi 30s: temp/light/humidity/time |
| Firebase push air | `network.ino` | Mỗi 5s: PPM |
| Firebase listen relay | `network.ino` | Poll 5s: relay_1, relay_3 |
| Hẹn giờ tự động | `network.ino` | Đọc schedules, hỗ trợ qua đêm, manual override |
| Chế độ an ninh | `network.ino` | always/night_only/disabled |
| Push motion/alarm | `network.ino` | Event-based |
| Push relay state | `network.ino` | Sync /relay/ch1,ch3 |
| Uno online status | `network.ino` | /security/uno_online |

### ✅ Dashboard — Đã hoàn chỉnh

| Tính năng | File |
|---|---|
| Mock login/logout | `auth.js` |
| Dark/Light mode | `app.js` + `ui.js` |
| Sidebar responsive | `app.js` + `ui.js` |
| Sensor realtime | `home.js` |
| Relay thủ công | `home.js` |
| Hẹn giờ 2 kênh | `schedule.js` |
| An ninh PIR + còi | `security.js` |
| Access log realtime + xóa | `logs.js` |
| Thời tiết Open-Meteo | `weather.js` |
| Mock mode toàn bộ | `firebase.js` |

### ❌ Tính năng còn thiếu / chưa hoàn thiện

| Tính năng | Vấn đề |
|---|---|
| `weather.ino` (firmware) | Đổi thành `.bak` — fetch OpenWeatherMap không hoạt động |
| Hiển thị thời tiết trên LCD | Phụ thuộc weather.ino — chưa implement |
| `validUIDs[]` hardcode 1 thẻ | Chỉ có `"4362F506"` |
| `actorName` hardcode | Chưa có quản lý user thật |
| Relay 3, 4 | GPIO 18, 23 xung đột SPI RFID — chỉ hỗ trợ 2 relay |
| IR Remote fallback | GPIO 36 không có trong code |
| Firebase Auth thật | Dashboard dùng mock login localStorage |
| Quản lý UID/PIN từ dashboard | Chưa có UI thêm/xóa RFID UID hoặc đổi PIN |
| Browser push notification | Chưa implement khi PIR kích hoạt |
| Biểu đồ lịch sử sensor | Chưa có chart nhiệt độ/ánh sáng |
| Export log CSV/PDF | Chưa implement |

---

## 15. Lịch sử Git — 5 ngày gần đây

> Tất cả commits bởi: **PhuVo0112** `<rggaming1235555@gmail.com>`

| Ngày (GMT+7) | Commit | Mô tả |
|---|---|---|
| **2026-07-12 ~16:05** | `146eb05` ← **HEAD** | `feat: implement security and sensor management modules with peripheral hardware support` |
| 2026-07-12 ~09:30 | `4fdc4b0` | `feat: implement core Smart Home firmware with modular network, security, actuator, and UNO extension support` |
| 2026-07-11 ~17:55 | `4b7578b` | `feat: initialize Smart Home IoT project with modular firmware structure and responsive dashboard UI` |
| 2026-07-11 ~11:25 | `3737427` | `feat: implement IoT firmware with Firebase connectivity, real-time relay control, sensor logging, and security scheduling` |
| 2026-07-09 ~15:03 | `eb24c85` | pull origin main — Fast-forward (merge từ branch FirmwareFix) |
| 2026-07-09 ~10:55 | `87edec4` | `feat: implement core firmware structure with RTC setup, configuration, and data types` |
| 2026-07-09 ~10:30 | `2afd7b5` | `feat: define sensor and access logging data structures and implement network and security modules` |

**Branch history:** `master` → rename `main` → branch `FirmwareFix` (phát triển firmware) → rebase về `main` → merge

---

## 16. Phân công thành viên

| Thành viên | Mảng phụ trách | File chính |
|---|---|---|
| **Khuyên** | Cảm biến & hiển thị | `sensor.ino`, `display.ino` |
| **Phú** | Bảo mật & điều khiển vật lý | `security.ino`, `actuator.ino` |
| **Bảo** | Networking & Cloud | `network.ino`, `weather.ino` |
| **Huy** | Dashboard & tích hợp | `dashboard/` |

---

## 17. Điểm cần xử lý trước demo/nộp

> **Ưu tiên cao:**

1. **`weather.ino.bak`** — Nếu muốn thời tiết trên LCD:
   - Đổi lại thành `weather.ino`
   - Thêm `#define WEATHER_KEY` và `#define CITY_ID` vào `config.h`
   - Thêm lời gọi `fetchWeather()` vào `loop()` trong `main.ino` (mỗi 15 phút)

2. **UID thẻ RFID** — Hiện chỉ có `"4362F506"` trong `RFID_UID`:
   - Quét các thẻ thật qua Serial Monitor
   - Thêm vào `validUIDs[]`

3. **PIN bảo mật** — `SECURITY_PIN = "123456"`:
   - Đổi thành PIN thực trước khi demo

4. **Relay logic** — Đã sửa thành `on=true → HIGH`:
   - Kiểm tra lại phần cứng nếu đèn bị ngược chiều

> **Ưu tiên thấp hơn (có thể bỏ qua khi demo):**

5. **Ô Air Quality trên dashboard** — Firmware đã push `/sensors/air`, kiểm tra dashboard xem đã map đúng chưa

6. **Mock login** — Tài khoản demo cấu hình trong `env.js`, đủ cho demo nhưng không bảo mật production

7. **`readTemperature()` trên Uno** — 50 × `delay(1ms)` blocking nhưng không ảnh hưởng ESP32 vì chạy trên board riêng

> **Lưu ý khi demo:**
> - Dùng Mock mode (dashboard chạy được ngay khi không có WiFi/Firebase)
> - `RTC_ENABLED` đã define trong `config.h` → cần cắm RTC DS1307 thật
> - Không để `config.h` lên Git — chứa credentials thật

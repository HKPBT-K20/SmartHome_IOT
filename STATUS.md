# 📊 STATUS.md – Tổng hợp tình trạng dự án SmartHome_IOT

> **Cập nhật:** 2026-07-11  
> **Dựa trên:** code thực tế (không phải file md)

---

## 🗺️ Kiến trúc hệ thống

```
                                 ┌───────────────┐
                                 │  Arduino Uno  │
                                 │ (Keypad, PIR, │
                                 │  LDR Sensors) │
                                 └───────┬───────┘
                                         │ UART (9600)
                                         ▼
User ──▶ Dashboard Web ──▶ Firebase ──▶ ESP32 Firmware ──▶ Firebase ──▶ Dashboard
```

| Lớp | Công nghệ | Trạng thái |
|---|---|---|
| Dashboard | HTML + Vanilla JS (ES Module) + TailwindCSS | ✅ Hoàn chỉnh |
| Firebase | Realtime Database (asia-southeast1) | ✅ Đã setup thật |
| Firmware (ESP32) | Arduino C++ chạy trên ESP32 (Master Hub) | ✅ Hoàn chỉnh |
| Extension (Uno) | Arduino C++ chạy trên Uno (I/O Extension) | ✅ Hoàn chỉnh |

---

## ⚡ Linh kiện & Chân cắm thực tế (dựa trên code)

### Board 1: ESP32 (Master Hub)
| Linh kiện | GPIO (ESP32) | Giao tiếp | Trạng thái code |
|---|---|---|---|
| **LM35** | GPIO **34** | ADC 12-bit | ✅ Đọc không chặn (updateTemperatureSensor) |
| **DHT11** | GPIO **26** | Digital | ✅ |
| **DS1307 RTC** | GPIO **21** (SDA), **22** (SCL) | I2C | ✅ (`RTC_ENABLED` đã define) |
| **LCD 1602 I2C** | GPIO **21** (SDA), **22** (SCL), addr `0x27` | I2C (chung bus RTC) | ✅ Hiển thị cảnh báo Uno Err |
| **RFID RC522** | SCK=**18**, MOSI=**23**, MISO=**19**, SS=**5**, RST=**-1** | SPI | ✅ |
| **Servo SG90** | GPIO **25** | PWM (Timer 2/3) | ✅ |
| **Relay CH1** | GPIO **32** | Digital | ✅ |
| **Relay CH2** | GPIO **33** | Digital | ✅ |
| **Buzzer** | GPIO **14** | Digital | ✅ |
| **Arduino Uno (UART)** | RX=**16**, TX=**17** | Serial2 (9600) | ✅ |

### Board 2: Arduino Uno (I/O Extension)
| Linh kiện | Pin (Uno) | Giao tiếp | Trạng thái code |
|---|---|---|---|
| **Keypad 4×4 Rows** | D**2, 3, 4, 5** | Digital | ✅ |
| **Keypad 4×4 Cols** | D**6, 7, 8, 9** | Digital | ✅ |
| **PIR HC-SR501** | D**10** | Digital | ✅ Đọc confirm 200ms HIGH trên Uno |
| **LDR/CDS** | A**0** | Analog | ✅ Đọc 10-bit, map 12-bit (0-4095) gửi qua UART |
| **ESP32 (UART)** | RX=D**11**, TX=D**12** | SoftwareSerial | ✅ |

> ⚠️ **Lưu ý thực tế:**
> - MOSI/MISO của RFID bị hoán đổi so với sơ đồ gốc: MOSI=23, MISO=19 (đã sửa trong code `SPI.begin(18, 23, 19, SS_PIN)`)
> - PIR dùng **polling** (không phải interrupt như README mô tả) — cần HIGH liên tục 200ms mới xác nhận
> - Relay logic: `on=true → HIGH` (đã sửa từ lúc ban đầu là LOW=bật)
> - GPIO 0 và GPIO 2 (Keypad Row 4 & 3) là strapping pins — không bấm phím lúc cấp nguồn

---

## 🔗 Cấu hình Firebase thực tế

```
Project: smart-home-iot-d1c77
URL: [MASKED_URL]
WiFi SSID: [MASKED_WIFI]
```

---

## 📡 Schema Firebase thực dùng

```
/sensors/
  temp          → float     (LM35, push mỗi 30s)
  light         → int       (LDR, 0–4095)
  humidity      → float     (DHT11, %)
  time          → string    ("HH:MM:SS DD/MM/YY")

/relay/
  ch1           → bool      (trạng thái thực tế relay 1)
  ch3           → bool      (trạng thái thực tế relay 3)

/commands/
  relay_1       → bool      (dashboard ghi, ESP32 poll 5s)
  relay_3       → bool

/schedules/
  ch1/
    on_time     → "HH:MM"
    off_time    → "HH:MM"
    enabled     → bool
    mode        → "daily"
  ch3/ (như trên)

/security/
  mode          → "always" | "night_only" | "disabled"
  alarm_status  → bool
  motion_detected → bool

/access_logs/
  {auto-key}/
    created_at     → int (timestamp ms)
    display_time   → "DD/MM/YYYY HH:MM:SS"
    auth_method    → "RFID" | "KEYPAD"
    identity_type  → "RFID" | "PIN"
    identity_value → UID hex hoặc PIN
    actor_id       → "user_001" | "unknown"
    actor_name     → "Vo Nguyen Thien Phu" | "Unknown User"
    result         → "Success" | "Failed"
    granted        → bool
```

---

## ✅ Tính năng ĐÃ hoàn thiện

### Firmware (ESP32)

| Tính năng | File | Chi tiết |
|---|---|---|
| Đọc nhiệt độ LM35 | `sensor.ino` | Trung bình 50 mẫu ADC (50ms blocking), 10mV/°C |
| Đọc ánh sáng LDR | `sensor.ino` | `analogRead(36)`, 0–4095 |
| Đọc độ ẩm DHT11 | `sensor.ino` | `readHumidity()`, validate NaN + range |
| Đồng hồ RTC DS1307 | `sensor.ino` | `RTC_ENABLED` define → dùng DS1307 + NTP fallback |
| Cập nhật giờ fallback | `sensor.ino` | Test mode: tính từ `millis()` |
| Hiển thị LCD | `display.ino` | Dòng 0: HH:MM:SS, Dòng 1: T:xx.x°C, throttle 1s, không flicker |
| Servo mở cửa | `actuator.ino` | 0°=mở, 90°=đóng, tự đóng sau 3 giây (non-blocking) |
| Relay 2 kênh | `actuator.ino` | CH1=GPIO32, CH3=GPIO33, on→HIGH |
| Còi buzzer | `actuator.ino` | State machine non-blocking, 3 beeps mặc định |
| RFID RC522 | `security.ino` | Đọc UID hex, so khớp `validUIDs[]`, clone FM17522 fix |
| Keypad 4×4 PIN | `security.ino` | PIN 6 ký tự, lock 30s sau 3 lần sai |
| PIR chống trộm | `security.ino` | Polling + confirm 200ms HIGH, cooldown ngày/đêm |
| Access log | `security.ino` + `network.ino` | Tạo struct đầy đủ + push Firebase ngay khi có sự kiện |
| WiFi + NTP | `network.ino` | Kết nối, sync NTP GMT+7, fallback compile-time → RTC |
| Firebase push sensor | `network.ino` | Mỗi 30s: temp, light, humidity, time |
| Firebase push log | `network.ino` | Event-based: push khi `newLogAvailable == true` |
| Firebase listen relay | `network.ino` | Poll mỗi 5s: `/commands/relay_1`, `/commands/relay_3` |
| Hẹn giờ tự động | `network.ino` | Đọc `/schedules/ch1,ch3`, hỗ trợ lịch qua đêm |
| Chế độ an ninh | `network.ino` | Đọc `/security/mode` → always / night_only / disabled |
| Push motion detected | `network.ino` | Push `/security/motion_detected` khi PIR kích hoạt |
| Push relay state | `network.ino` | Sync `/relay/ch1,ch3` về Firebase sau khi thay đổi |
| Đèn thông minh tự động | `actuator.ino` | Tự bật/tắt đèn CH1 dựa theo giờ (Tối/Ngủ/Ngày), PIR và ánh sáng LDR |

### Dashboard (Web)

| Tính năng | File | Chi tiết |
|---|---|---|
| Đăng nhập cục bộ | `auth.js` | Mock session localStorage, không dùng Firebase Auth thật |
| Đăng xuất | `auth.js` | Xóa session cục bộ |
| Dark/Light mode | `app.js` + `ui.js` | Toggle + lưu localStorage + theo system preference |
| Sidebar responsive | `app.js` + `ui.js` | Collapse desktop, overlay mobile |
| Hiển thị sensor realtime | `home.js` | Listen `/sensors`: temp, light, humidity |
| Điều khiển relay thủ công | `home.js` | Write `/commands/relay_1,3` → Firebase |
| Hiển thị trạng thái relay | `home.js` | Listen `/relay/ch1,3` → cập nhật nút ON/OFF |
| Hẹn giờ tự động | `schedule.js` | Nhập HH:MM, lưu `/schedules/ch1,ch3`, bật/tắt, hỗ trợ lịch qua đêm |
| Hẹn giờ Mock mode | `schedule.js` | Lưu localStorage khi không có Firebase thật |
| Chế độ an ninh | `security.js` | Chọn always/night_only/disabled → write `/security/mode` |
| Hiển thị motion PIR | `security.js` | Listen `/security/motion_detected` → animate pulse |
| Kích hoạt/tắt còi thủ công | `security.js` | Write `/security/alarm_status` |
| Reset cảnh báo | `security.js` | Clear `alarm_status` + `motion_detected` |
| Log truy cập realtime | `logs.js` | Listen `/access_logs` + legacy `/access_log`, normalize schema |
| Xóa log | `logs.js` | Confirm modal → remove Firebase node |
| Weather widget | `weather.js` | API open-meteo.com (free, không cần key), geolocation + reverse geocode, fallback TP.HCM, refresh 10 phút |
| Mock mode toàn bộ | `firebase.js` | Khi config có "YOUR_" → chạy offline với localStorage |

---

## ⏳ Tính năng CÒN THIẾU / CHƯA HOÀN THIỆN

### Firmware

| Tính năng | Vấn đề |
|---|---|
| `weather.ino` bị đổi thành `weather.ino.bak` | File tồn tại nhưng **không được compile** — tính năng fetch thời tiết từ OpenWeatherMap trên ESP32 **chưa hoạt động** |
| Hiển thị thời tiết trên LCD | Phụ thuộc vào `weather.ino` — chưa implement |
| `validUIDs[]` hardcode 1 thẻ | Chỉ có `"4362F506"` — cần quét thêm UID thật |
| `correctPIN` hardcode | Đã được chuyển qua config.h (SECURITY_PIN) |
| `actorName` hardcode | Granted luôn ghi `"Vo Nguyen Thien Phu"`, Denied luôn ghi `"Unknown User"` — chưa có quản lý user thật |
| Relay 3, 4 | GPIO 18, 23 đã xung đột với SPI RFID — không dùng được. Code chỉ hỗ trợ 2 relay |
| `readTemperature()` blocking | 50 × `delay(1ms)` = 50ms blocking mỗi lần gọi từ `updateDisplay()` — chưa sửa |
| IR Remote fallback | Linh kiện IR Receiver (GPIO 36) không có trong code firmware hiện tại |
| `fetchWeather` từ `loop()` | Không có trong `main.ino` — đã bị xóa khi đổi weather.ino thành .bak |

### Dashboard

| Tính năng | Vấn đề |
|---|---|
| Firebase Authentication thật | Hiện chỉ dùng **mock login** (localStorage), không có Firebase Auth thật. Account `hkpbSmartHome@gmail.com` là giả |
| Quản lý UID/PIN từ dashboard | Chưa có UI để thêm/xóa UID thẻ RFID hoặc đổi PIN từ xa |
| Humidity hiển thị ô "air" | `home.js` map `sensors.air` → "PPM" nhưng firmware không push field `air` — ô **Air Quality luôn hiện "--"** |
| Relay 3, 4 trên dashboard | Code chỉ định nghĩa 2 relay (`ch1`, `ch3`), không có UI cho relay 3, 4 |
| Lịch hẹn giờ nhiều kênh | Schedule chỉ hỗ trợ ch1, ch3 — không mở rộng cho relay khác |
| Thông báo push (notification) | Chưa implement browser notification khi có cảnh báo PIR |
| Biểu đồ lịch sử sensor | Chưa có chart nhiệt độ/ánh sáng theo thời gian |
| Export log | Chưa có tính năng xuất CSV/PDF lịch sử truy cập |

---

## 🔄 Loop chính (thực tế trong code)

```
Mỗi vòng loop:
  ├─ updateTemperatureSensor() — lấy mẫu LM35 không chặn (2ms) để tính trung bình
  ├─ handleUnoCommunication()  — xử lý dữ liệu UART từ Uno (PIR, LDR, Keypad), check watchdog 5s
  ├─ updateTime()              — cập nhật currentHour từ RTC hoặc millis
  ├─ checkRFID()               — quét SPI RFID
  ├─ checkKeypad()             — xử lý khóa phím (lockout timeout)
  ├─ checkPIR(hour)            — xử lý trạng thái báo động PIR, cooldown
  ├─ updateDoor()              — đóng cửa sau 3 giây
  ├─ updateBuzzer()            — state machine còi
  ├─ updateDisplay()           — hiển thị LCD (hiển thị lỗi Uno Err nếu mất UART, đọc temp không chặn)
  │
  ├─ pushSensors()             mỗi 30s — temp, light, humidity, time → Firebase
  ├─ listenCommands()          mỗi 5s  — relay manual + security mode + schedule
  └─ pushAccessLog()           event   — khi newLogAvailable == true
  
  ❌ fetchWeather()            — KHÔNG CÓ trong loop (weather.ino.bak bị loại)
```

---

## 📁 File thực tế trong repo

### Firmware (`firmware/main/`)

| File | Trạng thái |
|---|---|
| `main.ino` | ✅ Hoàn chỉnh |
| `sensor.ino` | ✅ Hoàn chỉnh (LM35 + CDS + DHT11 + RTC) |
| `display.ino` | ✅ Hoàn chỉnh |
| `security.ino` | ✅ Hoàn chỉnh |
| `actuator.ino` | ✅ Hoàn chỉnh |
| `network.ino` | ✅ Hoàn chỉnh |
| `weather.ino.bak` | ❌ Bị đổi .bak — không compile |
| `types.h` | ✅ Hoàn chỉnh (SensorData, AccessLog, RelayScheduleConfig) |
| `config.h` | ✅ Đã dọn dẹp và chuyển key thật qua `.env` |

### Dashboard (`dashboard/`)

| File | Trạng thái |
|---|---|
| `index.html` | ✅ Hoàn chỉnh |
| `js/app.js` | ✅ Entry point (navigation, theme, init modules) |
| `js/core/firebase.js` | ✅ Firebase SDK + Mock mode |
| `js/core/ui.js` | ✅ Utilities (toast, modal, theme, sidebar) |
| `js/features/auth.js` | ✅ Mock login/logout |
| `js/features/home.js` | ✅ Sensor display + relay control |
| `js/features/schedule.js` | ✅ Hẹn giờ 2 kênh |
| `js/features/security.js` | ✅ PIR + còi + chế độ an ninh |
| `js/features/logs.js` | ✅ Access log realtime + clear |
| `js/features/weather.js` | ✅ Open-Meteo API + geolocation |
| `app.js` (gốc dashboard/) | ⚠️ Legacy file — entry point thực là `js/app.js` |

---

## 🔑 Điểm cần chú ý trước khi demo/nộp

1. **`weather.ino.bak`** — Đổi lại thành `.ino` nếu muốn có thời tiết trên LCD. Phải thêm lại lời gọi `fetchWeather()` vào `main.ino`.
2. **PIN hardcode** — Đã được chuyển qua `config.h` (cần khai báo).
3. **UID thẻ RFID** — Đã được chuyển qua `config.h` (cần khai báo).
4. **Ô Air Quality trên dashboard** — Luôn hiển thị "--" vì firmware không push field `air`. Bỏ ô này hoặc map sang `humidity`.
5. **Mock login** — Dashboard không dùng Firebase Auth thật. Tài khoản demo được cấu hình qua `.env`.
6. **Relay logic** — Đã sửa thành `on=true → HIGH`. Kiểm tra lại phần cứng nếu đèn bị ngược.


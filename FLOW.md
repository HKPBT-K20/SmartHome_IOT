# 📡 Smart Home — Nghiệp vụ & Flow Code

> Tài liệu mô tả các tính năng đang hoạt động và luồng xử lý của firmware ESP32.

---

## 🗺️ Kiến trúc tổng quan

Hệ thống chạy trên **một vòng `loop()` duy nhất**, không có RTOS hay thread. Mọi tác vụ đều được thiết kế **non-blocking** bằng `millis()` timer hoặc interrupt flag, ngoại trừ `setupWiFi()` có timeout 10 giây lúc boot.

```
┌─────────────────────────────────────────────────────────┐
│                        ESP32                            │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │  sensor  │  │ security │  │       network        │  │
│  │ display  │  │ actuator │  │  weather · firebase  │  │
│  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │
│       │              │                   │              │
│       └──────────────┴───────────────────┘              │
│                      main.ino                           │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Boot Sequence (`setup`)

```
Serial.begin(115200)
  │
  ├─ setupSensors()   — ADC 12-bit, LM35 + CDS
  ├─ setupRTC()       — DS1307 I2C, fallback millis() nếu chưa cắm
  ├─ setupDisplay()   — Wire.begin(21,22), LCD init, hiện "System Ready"
  │
  ├─ setupActuator()  — Relay HIGH (tắt), Servo 90° (đóng), Buzzer OUTPUT
  ├─ setupSecurity()  — SPI.begin(), RFID init, Keypad debounce 5ms
  │                     + attachInterrupt PIR GPIO 13 RISING
  │
  ├─ setupWiFi()      — WiFi.begin(), chờ tối đa 10 giây
  └─ setupFirebase()  — auth bằng Database Secret, không cần email/pass
```

---

## 🔄 Loop — Lịch chạy các tác vụ

```
Mỗi vòng loop (< 1ms):
  ├─ updateTime()         luôn chạy   — cập nhật currentHour từ RTC/millis
  ├─ checkRFID()          luôn chạy   — quét SPI
  ├─ checkKeypad()        luôn chạy   — đọc phím 4x4
  ├─ checkPIR(hour)       luôn chạy   — đọc interrupt flag
  ├─ updateDoor()         luôn chạy   — đóng cửa sau 3 giây
  ├─ updateBuzzer()       luôn chạy   — state machine còi
  ├─ updateDisplay()      mỗi 1s      — throttle nội bộ
  │
  ├─ pushSensors()        mỗi 30s     — timer millis
  ├─ fetchWeather()       mỗi 15 phút — timer millis
  ├─ listenCommands()     mỗi 5s      — timer millis
  └─ pushAccessLog()      event-based — khi cờ newLogAvailable == true
```

---

## 🔐 Nghiệp vụ 1 — Kiểm soát ra vào

### 1a. RFID

```
Quét thẻ
  → Đọc UID (hex string, toUpperCase)
  → So khớp với validUIDs[]
      GRANTED → openDoor()
      DENIED  → alertBuzzer()
  → Ghi lastLog { uid, "RFID", time, granted }
  → newLogAvailable = true   ← TV3 sẽ push lên Firebase
```

### 1b. Keypad

```
Nhập phím (tối đa 6 ký tự)
  '*'  → xóa buffer
  '#'  → xác nhận
          so khớp với correctPIN ("123456")
          GRANTED → openDoor(), reset wrongAttempts
          DENIED  → wrongAttempts++
                    ≥ 3 lần → lock 30 giây + alertBuzzer()
  → Ghi lastLog { inputPIN, "KEYPAD", time, granted }
  → newLogAvailable = true
```

### Trạng thái cửa

```
openDoor()
  doorOpen == true? → return (idempotent)
  Servo.write(0°)   → mở
  doorOpenedAt = millis()

updateDoor() — mỗi vòng loop:
  millis() - doorOpenedAt ≥ 3000ms?
    → closeDoor(): Servo.write(90°)
```

---

## 🚨 Nghiệp vụ 2 — Cảnh báo chuyển động (PIR)

```
Hardware: GPIO 13 RISING edge → ISR onPIR() (debounce 500ms)
  pirTriggered = true

checkPIR(currentHour):
  pirTriggered == false? → return

  Tính cooldown theo giờ:
    22:00 – 05:59 (đêm) → cooldown 30 giây
    06:00 – 21:59 (ngày) → cooldown 5 phút

  Còn trong cooldown? → bỏ qua

  Ban đêm → alertBuzzer(3 tiếng)  "Intruder detected!"
  Ban ngày → log Serial            "Motion detected"
```

---

## 🔔 Nghiệp vụ 3 — Còi báo (Non-blocking)

```
alertBuzzer(n)          — set state, trả về ngay (không block)
  _buz.active = true
  _buz.beepsTotal = n

updateBuzzer()          — gọi mỗi vòng loop
  Chưa tới nextToggle? → return
  Đang LOW  → digitalWrite HIGH, nextToggle += 200ms
  Đang HIGH → digitalWrite LOW,  beepsDone++, nextToggle += 200ms
  beepsDone >= beepsTotal → active = false
```

RFID, Keypad, PIR **vẫn hoạt động bình thường** trong lúc còi đang kêu.

---

## 📺 Nghiệp vụ 4 — Hiển thị LCD

```
updateDisplay() — throttle 1 giây:
  Dòng 0 (col 0): HH:MM:SS
  Dòng 1 (col 0): T:28.5°C

Ghi đè từng ký tự thay vì lcd.clear()
→ không có flicker
```

---

## 🌡️ Nghiệp vụ 5 — Đọc cảm biến

### LM35 (GPIO 34)
```
Lấy trung bình 50 mẫu ADC (delay 1ms giữa mỗi mẫu)
  adcValue = sum / 50
  milliVolt = adcValue × (3300 / 4095)
  temperature = milliVolt / 10.0    ← LM35: 10mV/°C
```

### CDS / Quang trở (GPIO 36)
```
lightLevel = analogRead(CDS_PIN)    ← 0 (tối) đến 4095 (sáng)
```

### RTC DS1307 (I2C 21/22)
```
#ifdef RTC_ENABLED
  currentHour = rtc.now().hour()
  getTimeString() → "HH:MM:SS DD/MM/YY"
#else                               ← test mode không cần phần cứng
  currentHour = (millis/3600s) % 24
  getTimeString() → "HH:MM:SS 01/07/26"
```

---

## ☁️ Nghiệp vụ 6 — Cloud (Firebase + Weather)

### Push sensor (mỗi 30 giây)
```
/sensors/temp   ← readTemperature()
/sensors/light  ← readLightLevel()
/sensors/time   ← getTimeString()
```

### Push access log (event-driven)
```
Khi newLogAvailable == true:
  Firebase.RTDB.pushJSON("/access_log", {
    uid:     lastLog.uid,
    method:  "RFID" | "KEYPAD",
    time:    "HH:MM:SS DD/MM/YY",
    granted: true | false
  })
  → Firebase tự tạo key "-NxXXXX" theo timestamp server
```

### Listen relay commands (mỗi 5 giây)
```
GET /commands/relay_1 → setRelay(1, val)
GET /commands/relay_2 → setRelay(2, val)

setRelay(ch, on):
  digitalWrite(RELAY_ch, on ? LOW : HIGH)
  ← relay kích mức thấp: LOW = bật, HIGH = tắt
```

### Fetch thời tiết (mỗi 15 phút)
```
GET api.openweathermap.org/data/2.5/weather?id=1580578
  → parse JSON bằng ArduinoJson
  → currentWeather.temperature
  → currentWeather.weatherDesc
  (timeout HTTP: 5 giây)
```

---

## 🗄️ Schema Firebase Realtime Database

```
/
├─ sensors/
│   ├─ temp    : float   (°C)
│   ├─ light   : int     (0–4095)
│   └─ time    : string  ("HH:MM:SS DD/MM/YY")
│
├─ access_log/
│   └─ {auto-key}/
│       ├─ uid     : string  (UID thẻ hoặc PIN đã nhập)
│       ├─ method  : string  ("RFID" | "KEYPAD")
│       ├─ time    : string  ("HH:MM:SS DD/MM/YY")
│       └─ granted : bool
│
└─ commands/
    ├─ relay_1 : bool   (dashboard ghi, ESP32 đọc)
    └─ relay_2 : bool
```

---

## 🧩 Phân công module

| File | Owner | Trạng thái |
|---|---|---|
| `sensor.ino` | Khuyên | ✅ Hoàn chỉnh (test mode) |
| `display.ino` | Khuyên | ✅ Hoàn chỉnh |
| `security.ino` | Phú | ✅ Hoàn chỉnh |
| `actuator.ino` | Phú | ✅ Hoàn chỉnh |
| `network.ino` | Bảo | ✅ Hoàn chỉnh |
| `weather.ino` | Bảo | ✅ Hoàn chỉnh |
| `dashboard/` | Huy | ⏳ Chưa implement |

---

## ⚠️ Ghi chú kỹ thuật

| Vấn đề | Chi tiết |
|---|---|
| `readTemperature()` | `delay(1ms) × 50` = 50ms blocking mỗi lần gọi từ `updateDisplay()` |
| `correctPIN` | Hardcode `"123456"` trong `security.ino` — cần đổi trước khi dùng thật |
| `validUIDs[]` | Placeholder — đọc UID thật qua Serial Monitor rồi điền vào |
| `listenCommands()` | Poll mỗi 5s, không real-time. Firebase Stream có thể thay thế nếu cần phản hồi nhanh hơn |
| `RTC_ENABLED` | Chưa define → chạy test mode. Thêm `#define RTC_ENABLED` vào `config.h` khi cắm RTC thật |

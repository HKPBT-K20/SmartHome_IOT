# 🏠 Smart Home Automation System
> IoT Integration and Time-Based Control 

---

## 📋 Mô tả dự án

H? th?ng nh� th�ng minh s? d?ng **ESP32** l�m vi di?u khi?n trung t�m, x? l� d?ng th?i 3 nh�m t�c v?:

- **Time-Critical** — Hẹn giờ bật/tắt thiết bị dựa trên DS1307 RTC
- **Event-Driven** — Kiểm soát vào/ra bằng RFID + Keypad, cảnh báo PIR
- **Networking** — Đồng bộ Firebase, fetch API thời tiết, điều khiển từ xa qua web

---

## 🗂️ Cấu trúc thư mục

```
SmartHome_IOT/
│
├── firmware/                  # Code chạy trên ESP32 (Arduino IDE)
│   ├── main/                  # Sketch chính — mở folder này bằng Arduino IDE
│   │   ├── main.ino           # Loop chính, gọi các module
│   │   ├── sensor.ino         # Khuyên: LM35, quang trở, DS1307
│   │   ├── display.ino        # Khuyên: LCD hiển thị
│   │   ├── security.ino       # Phú: RFID, Keypad, PIR
│   │   ├── actuator.ino       # Phú: Servo, Relay, Còi
│   │   ├── network.ino        # Bảo: WiFi, Firebase push/listen
│   │   └── weather.ino        # Bảo: Fetch API thời tiết
�   +-- config.h               # ? KH�NG push l�n Git (d� gitignore)
│   ├── config.example.h       # Template cấu hình — copy thành config.h
│   └── types.h                # Struct dùng chung cho cả nhóm
│
├── dashboard/                 # Web app — Huy
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js             # Firebase init, realtime listener
│       ├── relay.js           # Nút điều khiển relay
│       └── accesslog.js       # Trang lịch sử vào/ra
│
├── docs/
│   ├── SmartHome_PhanCong.docx
�   +-- schematic.png          # So d? k?t n?i ch�n GPIO
│   └── firebase_schema.md     # Schema Firebase
│
├── .gitignore
└── README.md
```

---

## ⚙️ Yêu cầu phần cứng

| Linh ki?n | Giao ti?p | Ch�n ESP32 | Ghi ch� |
|---|---|---|---|
| DS1307 RTC | I2C | GPIO 21 (SDA), 22 (SCL) | Chia bus với LCD |
| LCD1602 I2C | I2C | GPIO 21 (SDA), 22 (SCL) | Địa chỉ 0x27 hoặc 0x3F |
| RFID RC522 | SPI | SS=5, RST=27, SCK=18, MOSI=23, MISO=19 | SPI mặc định ESP32 |
| Servo SG90 | PWM | **GPIO 26** | Mô phỏng khóa cửa (0°=mở, 90°=đóng) |
| LM35 | ADC | GPIO 34 | Input only, 12-bit ADC |
| Quang trở CDS | ADC | GPIO 35 | Chia áp điện trở 10K |
| PIR HC-SR501 | Interrupt | GPIO 13 | RISING edge, debounce 500ms |
| Relay 4 kênh | Digital | GPIO 32, 33, 18, 23 | LOW = bật, HIGH = tắt |
| Keypad 4x4 Rows | Digital | GPIO 12, 15, 2, 0 | Cẩn thận GPIO 0 (boot) |
| Keypad 4x4 Cols | Digital | **GPIO 4, 16, 17, 25** | Tránh GPIO 21/22 (I2C) |
| Còi buzzer | Digital | **GPIO 14** | Tránh GPIO 4 (Keypad Row) |
| IR Receiver 1838T | Digital | GPIO 36 | Fallback khi mất WiFi |

> ⚠ GPIO 6–11: KHÔNG dùng (kết nối flash nội). GPIO 34–39: chỉ INPUT.

---

## 🛠️ Cài đặt môi trường

### 1. Arduino IDE 2.x

Tải tại: https://www.arduino.cc/en/software

Thêm board ESP32:
- Mở **File → Preferences → Additional Boards Manager URLs**, thêm:
```
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
```
- Mở **Tools → Board → Boards Manager** → tìm `esp32` → Install
- Chọn board: **Tools → Board → ESP32 Arduino → ESP32 Dev Module**

### 2. Thư viện cần cài

Vào **Sketch → Include Library → Manage Libraries**, cài các thư viện sau:

| Thư viện | Dùng cho | Tác giả |
|---|---|---|
| RTClib | DS1307 RTC | Adafruit |
| LiquidCrystal I2C | LCD I2C | Frank de Brabander |
| MFRC522 | RFID RC522 | miguelbalboa |
| ESP32Servo | Servo SG90 | Kevin Harrington |
| Keypad | Keypad 4x4 | Mark Stanley |
| IRremoteESP8266 | Remote hồng ngoại | crankyoldgit |
| Firebase ESP32 Client | Firebase | mobizt |
| **ArduinoJson** | **Parse JSON thời tiết** | **Benoit Blanchon** |
| MD_MAX72XX + MD_Parola | Matrix LED (nếu dùng) | MajicDesigns |

### 3. Cấu hình dự án

```bash
# Copy file cấu hình mẫu
cp firmware/config.example.h firmware/config.h
```

Mở `firmware/config.h` và điền thông tin thật:

```cpp
#define WIFI_SSID     "tên_wifi_của_bạn"
#define WIFI_PASS     "mật_khẩu_wifi"
#define FIREBASE_URL  "https://your-project.firebaseio.com"
#define FIREBASE_KEY  "your_api_key"
#define WEATHER_KEY   "your_openweather_key"
#define CITY_ID       "1580578"  // TP.HCM
```

> ? `config.h` d� du?c th�m v�o `.gitignore` � **kh�ng bao gi? push file n�y l�n Git**.

### 4. Firebase setup

- Tạo project tại https://firebase.google.com
- Bật **Realtime Database**
- Cấu trúc database:

```
/sensors/
  temp        → float
  light       → int
/relay/
  ch1..ch2    → bool
/access_log/
  {timestamp}/
    uid       → string
    method    → "RFID" | "KEYPAD"
    time      → "HH:MM:SS DD/MM/YY"
    granted   → bool
/commands/
  relay_1..4  → bool
```

### 5. OpenWeatherMap API

- Đăng ký tại https://openweathermap.org
- Lấy API key → điền vào `WEATHER_KEY` trong `config.h`
- City ID mặc định TP.HCM: `1580578`

---

## ?? Ph�n c�ng

| Thành viên | Mảng phụ trách | File chính |
|---|---|---|
| Khuyên | Cảm biến & hiển thị | `sensor.ino`, `display.ino` |
| Phú | Bảo mật & điều khiển vật lý | `security.ino`, `actuator.ino` |
| Bảo | Networking & Cloud | `network.ino`, `weather.ino` |
| Huy | Dashboard & tích hợp | `dashboard/` |

### Git workflow

```bash
# Mỗi người làm trên branch riêng
git checkout -b tv1/sensor

# Commit thường xuyên
git add sensor.ino
git commit -m "tv1: add LM35 temperature reading"

# Khi xong thì tạo Pull Request vào main
git push origin tv1/sensor
```

> Không push thẳng vào `main`. Tạo Pull Request, ít nhất 1 người review trước khi merge.

---

## 📐 Struct dữ liệu dùng chung

Định nghĩa trong `types.h` — tất cả thành viên dùng chung, không tự ý sửa format:

```cpp
struct SensorData {
  float temperature;   // Nhiệt độ (°C) từ LM35
  int   lightLevel;    // Độ sáng từ quang trở (0–4095)
  char  time[20];      // "HH:MM:SS DD/MM/YY"
};

struct AccessLog {
  char uid[20];        // UID th? RFID ho?c m� PIN
  char method[10];     // "RFID" hoặc "KEYPAD"
  char time[20];       // "HH:MM:SS DD/MM/YY"
  bool granted;        // true = mở cửa, false = từ chối
};

struct WeatherData {
  float temperature;      // Nhiệt độ ngoài trời (°C) từ OpenWeatherMap
  char  weatherDesc[32];  // Mô tả, ví dụ: "mưa nhẹ"
};
```

> ⚠ Không tự ý thay đổi layout của struct — sẽ phá vỡ serialization Firebase và compatibility giữa các module.

---

## 🔧 Lưu ý kỹ thuật

**Không dùng `delay()`** — dùng `millis()` để tránh blocking:

```cpp
unsigned long lastSensor = 0, lastFirebase = 0, lastWeather = 0;

void loop() {
  unsigned long now = millis();
  if (now - lastSensor   >= 5000)   { readSensors();    lastSensor   = now; }
  if (now - lastFirebase >= 30000)  { pushToFirebase(); lastFirebase = now; }
  if (now - lastWeather  >= 900000) { fetchWeather();   lastWeather  = now; }
  checkRFID();    // không có delay bên trong
  checkPIR();     // kiểm tra interrupt flag
  checkKeypad();  // quét phím không blocking
}
```

**Test trước khi ghép** — dùng Wokwi (https://wokwi.com) để mô phỏng ESP32 online, không cần phần cứng thật.

---

## 📦 Công việc có thể làm ngay (chưa cần linh kiện)

- Bảo: Tạo Firebase project, setup Realtime Database
- Bảo: Đăng ký OpenWeatherMap API key
- Huy: Dựng khung Web Dashboard
- Khuyên, Phú: Code logic trên Wokwi

---

## Cấu trúc source hiện tại

Dashboard d� du?c t�ch r� theo l?p:

```text
dashboard/
  index.html
  js/
    app.js
    core/
      firebase.js
      ui.js
    features/
      auth.js
      logs.js
      schedule.js
      security.js
      weather.js
```

`dashboard/js/app.js` l� entry point m?ng, c�n to�n b? logic d� du?c chia theo t?ng module ch?c nang.

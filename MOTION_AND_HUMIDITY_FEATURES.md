# Tài liệu chi tiết: PIR và độ ẩm DHT11

Tài liệu này mô tả đúng theo source hiện tại của project SmartHome_IOT, tập trung vào:

- cảm biến chuyển động PIR trong phần an ninh,
- cảm biến độ ẩm DHT11 trong phần cảm biến môi trường,
- luồng dữ liệu từ sensor -> firmware ESP32 -> Firebase Realtime Database -> dashboard.

Mục tiêu:

- giải thích đúng theo code đang chạy,
- chỉ ra hàm nào gọi hàm nào,
- làm rõ dữ liệu được lưu lên Firebase ở path nào và theo cơ chế gì.

## 0. Kết luận ngắn

Hai cảm biến này được xử lý rất khác nhau:

- PIR là dữ liệu sự kiện. Nó đi qua board phụ UNO extension, được xác nhận HIGH liên tục 200ms, sau đó ESP32 xử lý theo mode an ninh, cooldown và đẩy trạng thái lên Firebase.
- DHT11 là dữ liệu môi trường. ESP32 đọc trực tiếp bằng thư viện DHT, kiểm tra hợp lệ, rồi mỗi 30 giây đẩy giá trị độ ẩm lên Firebase.

Điểm quan trọng nhất:

- PIR trong code hiện tại không đọc trực tiếp bằng interrupt trên ESP32.
- PIR được UNO extension đọc ở chân 10 và gửi qua Serial2 sang ESP32 dưới dạng `PIR:1` hoặc `PIR:0`.
- Firebase chủ yếu lưu trạng thái hiện tại, không lưu lịch sử cho 2 cảm biến này.

## 1. Các file liên quan

- `firmware/main/main.ino`
- `firmware/main/security.ino`
- `firmware/main/sensor.ino`
- `firmware/main/network.ino`
- `firmware/uno_extension/uno_extension.ino`
- `dashboard/js/features/home.js`
- `dashboard/js/features/security.js`
- `dashboard/js/core/firebase.js`

## 2. Bức tranh tổng thể

### 2.1. Luồng PIR

PIR đi theo chuỗi này:

```text
PIR sensor -> UNO extension đọc pin 10
-> confirm HIGH 200ms
-> gửi chuỗi "PIR:1" / "PIR:0" qua Serial
-> ESP32 nhận trong handleUnoCommunication()
-> gán currentPIRState
-> loop() gọi checkPIR(currentHour)
-> nếu hợp lệ thì pushSecurityMotion(true) và pushSecurityAlarm(true)
-> sau 5000ms tự trả về false
-> dashboard nghe /security/motion_detected
```

### 2.2. Luồng DHT11

Độ ẩm đi theo chuỗi này:

```text
DHT11 trên GPIO 27
-> readHumidity(float &humidity)
-> pushSensors() gọi mỗi 30 giây
-> Firebase.setFloat("/sensors/humidity", humidity)
-> dashboard nghe /sensors
-> hiển thị txt-humidity
```

## 3. PIR: cơ chế hiện tại trong source

### 3.1. PIR đang được đọc ở đâu

Trong source hiện tại, PIR không nằm ở `security.ino` như README cũ mô tả. Nó nằm ở `firmware/uno_extension/uno_extension.ino`.

UNO extension làm 3 việc:

- đọc keypad,
- đọc PIR ở chân `10`,
- đọc LDR và nhiệt độ analog để gửi sang ESP32.

Đoạn xử lý PIR trên UNO extension:

```cpp
unsigned long now = millis();
bool pinState = (digitalRead(10) == HIGH);
static unsigned long pirCandidateStart = 0;
static bool confirmedState = false;
static bool lastSentPIR = false;

if (pinState) {
  if (pirCandidateStart == 0) {
    pirCandidateStart = now;
  } else if (!confirmedState && (now - pirCandidateStart >= 200)) {
    confirmedState = true;
  }
} else {
  pirCandidateStart = 0;
  confirmedState = false;
}

static unsigned long lastSentPIRTime = 0;
if (confirmedState != lastSentPIR || (now - lastSentPIRTime >= 5000)) {
  lastSentPIR = confirmedState;
  lastSentPIRTime = now;
  Serial.print("PIR:");
  Serial.println(lastSentPIR ? "1" : "0");
}
```

Ý nghĩa:

- nếu chân 10 lên HIGH, UNO không báo ngay,
- nó chờ 200ms liên tục,
- nếu vẫn HIGH thì coi là đã xác nhận motion,
- sau đó gửi `PIR:1`,
- khi mất tín hiệu thì gửi `PIR:0`.

### 3.2. ESP32 nhận PIR như thế nào

ESP32 không đọc pin PIR trực tiếp. Nó đọc chuỗi từ `Serial2` trong `handleUnoCommunication()` ở `firmware/main/security.ino`.

```cpp
void handleUnoCommunication() {
  static String inputBuffer = "";
  while (Serial2.available() > 0) {
    char c = Serial2.read();
    if (c == '\n') {
      inputBuffer.trim();
      if (inputBuffer.length() > 0) {
        lastUnoMessageTime = millis();
        if (!unoOnline) {
          unoOnline = true;
          pushUnoOnlineStatus(true);
        }

        if (inputBuffer.startsWith("KEY:")) {
          if (inputBuffer.length() > 4) {
            processKey(inputBuffer.charAt(4));
          }
        } else if (inputBuffer.startsWith("PIR:")) {
          if (inputBuffer.length() > 4) {
            currentPIRState = (inputBuffer.charAt(4) == '1');
          }
        } else if (inputBuffer.startsWith("LDR:")) {
          ...
        } else if (inputBuffer.startsWith("TEMP:")) {
          ...
        }
      }
      inputBuffer = "";
    } else if (c != '\r') {
      inputBuffer += c;
      if (inputBuffer.length() >= 64) {
        inputBuffer = "";
      }
    }
  }

  if (unoOnline && (millis() - lastUnoMessageTime > 5000)) {
    unoOnline = false;
    currentPIRState = false;
    pushUnoOnlineStatus(false);
  }
}
```

Ở đây:

- `PIR:1` -> `currentPIRState = true`
- `PIR:0` -> `currentPIRState = false`

Ngoài ra nếu 5 giây không nhận được gì từ UNO:

- hệ thống coi UNO bị mất kết nối,
- reset `currentPIRState = false`,
- push `/security/uno_online = false`.

### 3.3. PIR được xử lý ở đâu trong ESP32 loop

Trong `firmware/main/main.ino`, hàm `loop()` gọi:

```cpp
handleUnoCommunication();
updateTime();
checkRFID();
checkKeypad();
checkPIR(currentHour);
updateDoor();
updateBuzzer();
updateDisplay();
```

Nghĩa là:

1. ESP32 nhận dữ liệu từ UNO trước.
2. Sau đó gọi `checkPIR(currentHour)` để quyết định có kích hoạt cảnh báo hay không.

### 3.4. Logic checkPIR()

Trong `firmware/main/security.ino`:

```cpp
#define PIR_COOLDOWN_NIGHT 30000
#define PIR_COOLDOWN_DAY   300000
#define PIR_ACTIVE_MS      5000

char securityMode[16] = "always";
unsigned long lastPIRAlert = 0;
bool motionDetected = false;
unsigned long motionDetectedUntil = 0;
bool currentPIRState = false;
```

Hàm `checkPIR(int currentHour)` làm các bước sau:

1. In log debug mỗi 1 giây.
2. Nếu `motionDetected == true` và đã quá `motionDetectedUntil`, tự tắt motion, tắt còi, push Firebase về false.
3. Nếu `securityMode == "disabled"` thì bỏ qua.
4. Xác định ban đêm hay ban ngày.
5. Chỉ cho PIR hoạt động khi mode cho phép:
   - `always` -> luôn cho phép
   - `night_only` -> chỉ ban đêm
   - `disabled` -> không cho phép
6. Nếu `currentPIRState == false` thì bỏ qua.
7. Nếu còn trong cooldown thì bỏ qua.
8. Nếu hợp lệ:
   - `lastPIRAlert = now`
   - `motionDetected = true`
   - `motionDetectedUntil = now + 5000`
   - gọi `alertBuzzer(9999)`
   - gọi `pushSecurityMotion(true)`
   - gọi `pushSecurityAlarm(true)`

Đoạn chính:

```cpp
if (motionDetected && now >= motionDetectedUntil) {
  motionDetected = false;
  stopBuzzer();
  pushSecurityMotion(false);
  pushSecurityAlarm(false);
}

if (strcmp(securityMode, "disabled") == 0) {
  return;
}

bool isNight = (currentHour >= 22 || currentHour < 6);
bool modeAllowsMotion = (strcmp(securityMode, "always") == 0) ||
                        (strcmp(securityMode, "night_only") == 0 && isNight);
unsigned long cooldown = isNight ? PIR_COOLDOWN_NIGHT : PIR_COOLDOWN_DAY;

if (!modeAllowsMotion) {
  return;
}

if (!currentPIRState) {
  return;
}

if (lastPIRAlert != 0 && now - lastPIRAlert < cooldown) {
  return;
}

lastPIRAlert = now;
motionDetected = true;
motionDetectedUntil = now + PIR_ACTIVE_MS;

alertBuzzer(9999);
pushSecurityMotion(true);
pushSecurityAlarm(true);
```

### 3.5. PIR được lưu lên Firebase như nào

`pushSecurityMotion(bool detected)` trong `firmware/main/network.ino`:

```cpp
void pushSecurityMotion(bool detected) {
  if (!firebaseReady || !Firebase.ready()) return;

  if (Firebase.setBool(fbdo, "/security/motion_detected", detected)) {
    Serial.println(String("Security motion pushed: ") + (detected ? "true" : "false"));
  } else {
    Serial.println("Security motion push error: " + fbdo.errorReason());
  }
}
```

`pushSecurityAlarm(bool active)`:

```cpp
void pushSecurityAlarm(bool active) {
  if (!firebaseReady || !Firebase.ready()) return;
  Firebase.setBool(fbdo, "/security/alarm_status", active);
}
```

Vậy PIR không tạo log dạng nhiều record. Nó chỉ overwrite trạng thái hiện tại ở:

- `/security/motion_detected`
- `/security/alarm_status`

### 3.6. Dashboard đọc PIR như nào

`dashboard/js/features/security.js` lắng nghe node `/security`:

```js
onValue(ref(db, "security"), snapshot => {
    renderSecurityUi(snapshot.val() || {});
});
```

Trong `renderSecurityUi()`:

- `motionDetected = Boolean(state.motion_detected)`
- `alarmActive = Boolean(state.alarm_status)`
- `mode = state.mode || "always"`

Sau đó UI đổi màu, đổi text và animate dựa trên `motion_detected` và `alarm_status`.

## 4. DHT11 độ ẩm: cơ chế hiện tại trong source

### 4.1. DHT11 nằm ở đâu

Trong `firmware/main/sensor.ino`:

```cpp
#define DHT_PIN  27
#define DHT_TYPE  DHT11

RTC_DS1307 rtc;
DHT dht(DHT_PIN, DHT_TYPE);
```

Ở code hiện tại, DHT11 được gắn ở GPIO 27.

### 4.2. Setup DHT11

Trong `setupSensors()`:

```cpp
void setupSensors() {
  analogReadResolution(12);
  dht.begin();
  Serial.println("Sensor module ready.");
}
```

Hàm này chỉ cần gọi `dht.begin()` một lần lúc boot.

### 4.3. Hàm đọc độ ẩm

```cpp
bool readHumidity(float &humidity) {
  float value = dht.readHumidity();
  if (isnan(value) || value < 0.0f || value > 100.0f) {
    return false;
  }

  humidity = value;
  return true;
}
```

Ý nghĩa:

- `dht.readHumidity()` trả về giá trị độ ẩm,
- nếu dữ liệu lỗi thì trả `false`,
- nếu hợp lệ thì gán ra biến `humidity` và trả `true`.

Hàm này chỉ là hàm đọc. Nó chưa ghi Firebase.

### 4.4. DHT11 được đẩy lên Firebase ở đâu

Trong `firmware/main/network.ino`, hàm `pushSensors()`:

```cpp
void pushSensors() {
  if (!firebaseReady || !Firebase.ready()) return;

  float temp  = readTemperature();
  int   light = readLightLevel();
  float humidity = 0.0f;
  bool  hasHumidity = readHumidity(humidity);
  char  timeStr[20];
  getTimeString(timeStr);

  bool ok = true;
  ok &= Firebase.setFloat (fbdo, "/sensors/temp",  temp);
  ok &= Firebase.setInt   (fbdo, "/sensors/light", light);
  ok &= Firebase.setString(fbdo, "/sensors/time",  timeStr);

  if (hasHumidity) {
    ok &= Firebase.setFloat(fbdo, "/sensors/humidity", humidity);
  }
}
```

Điểm quan trọng:

- nếu `hasHumidity == false` thì `/sensors/humidity` không bị ghi,
- tức là code tránh ghi giá trị lỗi lên Firebase,
- chỉ khi đọc hợp lệ mới set float lên path đó.

### 4.5. pushSensors() được gọi ở đâu

Trong `firmware/main/main.ino`:

```cpp
if (now - lastSensorPush >= 30000) {
  pushSensors();
  lastSensorPush = now;
}
```

Nghĩa là:

- mỗi 30 giây, ESP32 gom dữ liệu môi trường một lần,
- rồi mới đẩy lên Firebase.

### 4.6. DHT11 được lưu lên Firebase như nào

Dữ liệu môi trường đang lưu tại:

- `/sensors/temp`
- `/sensors/light`
- `/sensors/time`
- `/sensors/humidity`

Trong đó humidity là `float`.

Đây cũng là lưu kiểu trạng thái hiện tại, không phải log lịch sử.

### 4.7. Dashboard đọc độ ẩm như nào

`dashboard/js/features/home.js` lắng nghe node `/sensors`:

```js
onValue(ref(db, "sensors"), snapshot => {
    const sensors = snapshot.val() || {};
    setMetric("txt-temp", sensors.temp ?? sensors.temperature, " °C");
    setMetric("txt-light", sensors.light ?? sensors.lightLevel, " Lux");
    setMetric("txt-humidity", sensors.humidity ?? sensors.humid, " %");
    setMetric("txt-air", sensors.air ?? sensors.airQuality ?? sensors.ppm, " PPM");
});
```

Nghĩa là:

- ưu tiên đọc `sensors.humidity`,
- nếu DB cũ có key `humid` thì vẫn nhận,
- UI chỉ hiển thị giá trị đã được Firebase lưu.

## 5. Flow chi tiết theo hàm cho từng cảm biến

### 5.1. Flow PIR theo đúng source

```text
PIR sensor on UNO pin 10
-> uno_extension.ino đọc digitalRead(10)
-> nếu HIGH liên tục 200ms thì confirmedState = true
-> UNO gửi "PIR:1" qua Serial
-> ESP32 handleUnoCommunication() đọc Serial2
-> currentPIRState = true
-> loop() gọi checkPIR(currentHour)
-> checkPIR() kiểm tra:
   - motionDetected timeout
   - securityMode
   - ban đêm / ban ngày
   - cooldown
-> nếu hợp lệ:
   - motionDetected = true
   - motionDetectedUntil = now + 5000
   - alertBuzzer(9999)
   - pushSecurityMotion(true)
   - pushSecurityAlarm(true)
-> dashboard/security.js nghe /security
-> UI đổi trạng thái motion_detected và alarm_status
-> sau 5000ms checkPIR() tự push false
```

Các hàm đi qua theo thứ tự:

1. `loop()`
2. `handleUnoCommunication()`
3. `checkPIR(currentHour)`
4. `pushSecurityMotion(true/false)`
5. `pushSecurityAlarm(true/false)`
6. Dashboard `onValue(ref(db, "security"), ...)`

### 5.2. Flow DHT11 theo đúng source

```text
DHT11 trên GPIO 27
-> setupSensors() gọi dht.begin()
-> readHumidity(float &humidity) gọi dht.readHumidity()
-> pushSensors() gọi readHumidity(humidity)
-> nếu hợp lệ thì Firebase.setFloat("/sensors/humidity", humidity)
-> dashboard/home.js nghe /sensors
-> txt-humidity cập nhật ngay
```

Các hàm đi qua theo thứ tự:

1. `setupSensors()`
2. `pushSensors()` trong `main.ino` mỗi 30 giây
3. `readHumidity(humidity)`
4. `Firebase.setFloat("/sensors/humidity", humidity)`
5. Dashboard `onValue(ref(db, "sensors"), ...)`

## 6. So sánh ngắn để dễ nhớ

| Tiêu chí | PIR | DHT11 |
|---|---|---|
| Bản chất | Sự kiện chuyển động | Giá trị môi trường |
| Nơi đọc sensor | UNO extension | ESP32 trực tiếp |
| Cơ chế lọc | Confirm HIGH 200ms + cooldown | Kiểm tra hợp lệ NaN/range |
| Tần suất | Theo sự kiện + polling loop | Mỗi 30 giây |
| Firebase path | `/security/motion_detected`, `/security/alarm_status` | `/sensors/humidity` |
| Dashboard | `dashboard/js/features/security.js` | `dashboard/js/features/home.js` |

## 7. Các điểm dễ hiểu nhầm trong tài liệu cũ

- Tài liệu cũ nói PIR dùng interrupt. Source hiện tại không phải vậy.
- PIR hiện tại đi qua UNO extension và Serial2.
- DHT11 không được push ngay mỗi lần đọc, mà nằm trong `pushSensors()` chạy định kỳ.
- Firebase không lưu lịch sử độ ẩm hay motion theo kiểu nhiều record, mà lưu trạng thái hiện tại ở node cố định.

## 8. Kết luận

Nếu nhìn theo đúng source hiện tại:

- PIR là luồng sự kiện, bắt đầu từ UNO extension, đi qua `handleUnoCommunication()`, được quyết định ở `checkPIR()`, rồi lưu trạng thái lên `/security/*`.
- DHT11 là luồng đọc định kỳ, bắt đầu từ `readHumidity()`, đi qua `pushSensors()`, rồi lưu lên `/sensors/humidity`.

Nếu bạn muốn, mình có thể làm tiếp một bản sơ đồ mũi tên cực ngắn kiểu:

```text
Hàm -> Hàm -> Firebase -> UI
```

cho riêng PIR và riêng DHT11 để bạn nhìn 10 giây là hiểu.

# Luồng Hoạt Động Dashboard - Firebase - IoT

Tài liệu này mô tả chi tiết cách dashboard web, Firebase Realtime Database và firmware ESP32 tương tác với nhau trong source hiện tại. Nội dung tập trung vào:

- luồng dữ liệu đi qua từng lớp
- các tính năng được liên kết như thế nào
- firmware thực thi ra sao
- dashboard nhận phản hồi và hiển thị như thế nào

## 1. Tổng Quan Hệ Thống

Hệ thống có 3 lớp chính:

1. Dashboard web
2. Firebase Realtime Database
3. Firmware ESP32

Vai trò của từng lớp:

- Dashboard là nơi người dùng thao tác và xem trạng thái.
- Firebase là lớp trung gian đồng bộ dữ liệu thời gian thực.
- ESP32 là nơi thực thi thật trên phần cứng.

Nguyên tắc hoạt động chung:

- Người dùng thao tác trên dashboard.
- Dashboard ghi dữ liệu lên Firebase.
- Firmware đọc Firebase để thực thi.
- Firmware cập nhật trạng thái ngược lại lên Firebase.
- Dashboard nghe realtime để cập nhật giao diện.

## 2. Cấu Trúc Source Đang Dùng

Dashboard đang chạy theo bản modular:

- `dashboard/index.html`
- `dashboard/js/app.js`
- `dashboard/js/core/firebase.js`
- `dashboard/js/core/ui.js`
- `dashboard/js/features/home.js`
- `dashboard/js/features/schedule.js`
- `dashboard/js/features/security.js`
- `dashboard/js/features/logs.js`
- `dashboard/js/features/weather.js`

Firmware nằm trong:

- `firmware/main/main.ino`
- `firmware/main/sensor.ino`
- `firmware/main/security.ino`
- `firmware/main/actuator.ino`
- `firmware/main/network.ino`
- `firmware/main/display.ino`

Entry point của dashboard là:

- `dashboard/index.html` load `js/app.js`

## 3. Vai Trò Của Firebase

Firebase Realtime Database đóng vai trò như một bus đồng bộ giữa UI và ESP32.

Các nhóm dữ liệu chính:

- `/sensors`
- `/relay`
- `/commands`
- `/schedules`
- `/security`
- `/access_logs`

Firebase được dùng để:

- lưu cấu hình người dùng
- lưu trạng thái thiết bị
- truyền lệnh điều khiển
- push log truy cập
- push cảnh báo chuyển động

## 4. Luồng Khởi Động Hệ Thống

### 4.1 Dashboard

Khi mở web:

1. `dashboard/js/app.js` khởi tạo các module.
2. `dashboard/js/core/firebase.js` khởi tạo Firebase app và database.
3. Các feature module đăng ký listener `onValue(...)`.
4. Dashboard sẵn sàng nhận dữ liệu realtime từ Firebase.

### 4.2 Firmware

Khi ESP32 boot:

1. `setupSensors()` khởi tạo cảm biến.
2. `setupRTC()` khởi tạo DS1307 nếu bật `RTC_ENABLED`.
3. `setupDisplay()` khởi tạo LCD.
4. `setupActuator()` khởi tạo relay, servo, buzzer.
5. `setupSecurity()` khởi tạo RFID, keypad, PIR.
6. `setupFirebase()` kết nối WiFi, NTP và Firebase.

Sau đó `loop()` chạy liên tục:

- `updateTime()`
- `checkRFID()`
- `checkKeypad()`
- `checkPIR(currentHour)`
- `updateDoor()`
- `updateBuzzer()`
- `updateDisplay()`
- `pushSensors()` mỗi 30 giây
- `listenCommands()` mỗi 5 giây
- `pushAccessLog()` khi có log mới

## 5. Luồng Dữ Liệu Chung

Mẫu luồng tổng quát:

```text
User -> Dashboard UI -> Firebase -> ESP32 -> Firebase -> Dashboard UI
```

Ví dụ:

- user bật lịch đèn trên dashboard
- dashboard lưu cấu hình vào Firebase
- ESP32 đọc cấu hình đó
- ESP32 bật relay theo thời gian
- ESP32 đẩy trạng thái relay về Firebase
- dashboard cập nhật giao diện theo trạng thái mới

## 6. Luồng Từng Tính Năng

### 6.1 Điều Khiển Relay Thủ Công

File liên quan:

- `dashboard/js/features/home.js`
- `firmware/main/network.ino`
- `firmware/main/actuator.ino`

Relay hiện tại là 2 đèn:

- `ch1` = đèn phòng làm việc
- `ch2` = đèn phòng khách

Luồng:

1. Người dùng bấm ON/OFF trên dashboard.
2. Dashboard ghi lệnh vào `/commands/relay_1` hoặc `/commands/relay_2`.
3. Firmware `listenCommands()` đọc lệnh mỗi 5 giây.
4. Firmware gọi `setRelay(...)`.
5. Firmware push trạng thái thật lên `/relay/ch1` hoặc `/relay/ch2`.
6. Dashboard nghe `/relay` và cập nhật nút trạng thái.

### 6.2 Hẹn Giờ Tự Động

File liên quan:

- `dashboard/js/features/schedule.js`
- `dashboard/js/core/ui.js`
- `firmware/main/network.ino`
- `firmware/main/actuator.ino`

Hiện dashboard chỉ giữ 2 đèn:

- `ch1`
- `ch2`

Người dùng có thể:

- nhập giờ bật `on_time`
- nhập giờ tắt `off_time`
- lưu lịch
- bật/tắt lịch

Schema lưu trên Firebase:

- `/schedules/ch1`
- `/schedules/ch2`

Các field chính:

- `on_time`
- `off_time`
- `enabled`
- `mode`

Luồng:

1. Người dùng nhập giờ ON/OFF trên dashboard.
2. Dashboard kiểm tra định dạng `HH:MM`.
3. Dashboard ghi cấu hình vào Firebase.
4. Firmware `listenCommands()` đọc `/schedules/ch1` và `/schedules/ch2`.
5. Firmware lấy giờ hiện tại từ NTP, RTC hoặc fallback `millis()`.
6. Firmware xác định xem hiện tại có nằm trong khung giờ active hay không.
7. Nếu đang trong khung giờ, firmware bật relay.
8. Nếu không còn trong khung giờ, firmware tắt relay.
9. Firmware push trạng thái relay ngược lại Firebase.

Lưu ý:

- Lịch có hỗ trợ qua đêm.
- Nếu `on_time > off_time`, hệ thống hiểu là khung qua đêm.
- Chỉ áp dụng cho 2 relay đèn.

### 6.3 Chế Độ Chống Trộm

File liên quan:

- `dashboard/js/features/security.js`
- `firmware/main/security.ino`
- `firmware/main/network.ino`

Dashboard cho phép chọn:

- `always`
- `night_only`
- `disabled`

Dashboard lưu giá trị vào:

- `/security/mode`

Luồng:

1. Người dùng chọn chế độ an ninh.
2. Dashboard lưu `security.mode` lên Firebase.
3. Firmware định kỳ đọc `security.mode`.
4. PIR chỉ được chấp nhận khi mode cho phép.
5. Nếu mode là `disabled`, PIR bị bỏ qua.
6. Nếu mode là `night_only`, PIR chỉ hợp lệ ban đêm.
7. Nếu mode là `always`, PIR luôn hoạt động.

### 6.4 Cảm Biến PIR

File liên quan:

- `firmware/main/security.ino`
- `firmware/main/network.ino`
- `dashboard/js/features/security.js`

Logic PIR hiện tại:

- đọc bằng polling `digitalRead(PIR_PIN)`
- phải giữ `HIGH` liên tục `200ms` mới xác nhận
- nếu tụt xuống `LOW` trước 200ms thì bỏ qua
- sau khi xác nhận vẫn có cooldown ngày/đêm

Luồng:

1. PIR lên `HIGH`.
2. Firmware ghi nhận `candidateStart = millis()`.
3. Nếu sau `200ms` vẫn `HIGH`, xác nhận có chuyển động.
4. Firmware kiểm tra cooldown và `security.mode`.
5. Nếu hợp lệ, firmware:
   - push `/security/motion_detected = true`
   - bật buzzer
6. Sau `PIR_ACTIVE_MS`, firmware reset motion về `false`.

### 6.5 RFID và Keypad

File liên quan:

- `firmware/main/security.ino`
- `firmware/main/network.ino`

Luồng RFID:

1. Quét thẻ RFID.
2. Firmware đọc UID.
3. So khớp UID với danh sách hợp lệ.
4. Nếu đúng:
   - mở cửa
   - tạo log thành công
5. Nếu sai:
   - bật buzzer
   - tạo log thất bại

Luồng Keypad:

1. Người dùng nhập PIN.
2. Bấm `#` để xác nhận.
3. Firmware so khớp với PIN đúng.
4. Nếu đúng:
   - mở cửa
   - tạo log thành công
5. Nếu sai:
   - tăng số lần sai
   - nếu quá 3 lần thì lock 30 giây

### 6.6 Log Truy Cập

File liên quan:

- `firmware/main/security.ino`
- `firmware/main/network.ino`
- `dashboard/js/features/logs.js`

Luồng:

1. Có sự kiện RFID hoặc keypad.
2. Firmware tạo `AccessLog`.
3. `pushAccessLog()` đẩy dữ liệu lên `/access_logs`.
4. Dashboard nghe log realtime.
5. Bảng lịch sử cập nhật ngay.

Các trường log:

- `created_at`
- `display_time`
- `auth_method`
- `identity_type`
- `identity_value`
- `actor_id`
- `actor_name`
- `result`
- `granted`

### 6.7 Sensors

File liên quan:

- `firmware/main/sensor.ino`
- `dashboard/js/features/home.js`

Firmware định kỳ push:

- nhiệt độ
- ánh sáng
- độ ẩm không khí
- thời gian

Dashboard hiển thị realtime theo `/sensors`.

Hiện firmware đọc:

- `LM35` để đo nhiệt độ
- `CDS/LDR` để đo ánh sáng
- `DHT11` để đo độ ẩm không khí

Luồng sensor:

1. `setupSensors()` khởi tạo `dht.begin()`.
2. `readTemperature()` đọc LM35.
3. `readLightLevel()` đọc CDS.
4. `readHumidity()` đọc DHT11.
5. `pushSensors()` đẩy `/sensors/temp`, `/sensors/light`, `/sensors/humidity`, `/sensors/time` lên Firebase.
6. Dashboard nghe `/sensors` và cập nhật ô độ ẩm.

### 6.8 Weather

File liên quan:

- `dashboard/js/features/weather.js`
- source firmware weather trong repo

Tính năng này lấy dữ liệu thời tiết từ API ngoài và hiển thị trên dashboard. Nó không điều khiển IoT trực tiếp, nhưng vẫn nằm trong hệ dashboard tổng thể.

## 7. Firebase Schema Thực Dùng

Schema nên hiểu như sau:

```text
/sensors
  temp
  light
  humidity
  time

/relay
  ch1
  ch2

/commands
  relay_1
  relay_2

/schedules
  ch1
    on_time
    off_time
    enabled
    mode
  ch2
    on_time
    off_time
    enabled
    mode

/security
  mode
  alarm_status
  motion_detected

/access_logs
  {auto_key}
    created_at
    display_time
    auth_method
    identity_type
    identity_value
    actor_id
    actor_name
    result
    granted
```

## 8. Cơ Chế Mock Mode

Dashboard có mock mode để demo khi không có Firebase thật.

File:

- `dashboard/js/core/firebase.js`

LocalStorage keys:

- `smarthomeMockSession`
- `smarthomeMockSchedules`
- `smarthomeMockSecurity`
- `smarthomeMockAccessLogs`

Mục đích:

- cho phép demo UI
- không cần kết nối Firebase thật
- không ảnh hưởng firmware

## 9. Điểm Kỹ Thuật Quan Trọng

- Hệ thống chạy trên một `loop()` duy nhất.
- Không dùng RTOS.
- Các tác vụ chính được thiết kế non-blocking.
- PIR không còn dùng interrupt, mà dùng polling + xác nhận HIGH liên tục.
- Schedule và security mode được đọc từ Firebase, không hardcode trong dashboard.
- Dashboard và firmware không giao tiếp trực tiếp với nhau, mà thông qua Firebase.
- File `dashboard/app.js` còn tồn tại như legacy, nhưng entry point thực tế là `dashboard/js/app.js`.

## 10. Tóm Tắt Theo Tính Năng

### Home

- hiển thị sensor
- điều khiển relay thủ công
- đọc trạng thái relay từ Firebase

### Schedule

- cấu hình giờ bật/tắt cho 2 đèn
- firmware tự chạy theo lịch
- hỗ trợ lịch qua đêm

### Security

- chọn chế độ an ninh
- bật/tắt còi
- hiển thị motion realtime
- firmware kiểm tra PIR theo mode

### Logs

- ghi và hiển thị lịch sử truy cập

### Weather

- hiển thị thời tiết trên dashboard

## 11. Kết Luận

Toàn bộ hệ thống có thể hiểu theo sơ đồ:

```text
User -> Dashboard UI -> Firebase -> ESP32 firmware -> Firebase -> Dashboard UI
```

Dashboard là nơi cấu hình và hiển thị.
Firebase là lớp đồng bộ trung gian.
ESP32 là nơi thực thi thực tế.

Nếu muốn mở rộng thêm tính năng, chỉ cần:

- thêm UI trên dashboard
- thêm node dữ liệu tương ứng trong Firebase
- thêm logic đọc/ghi trong firmware

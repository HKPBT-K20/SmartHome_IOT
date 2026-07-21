# Smart Home IoT

Hệ thống nhà thông minh gồm 3 phần chính:

- `firmware/`: code chạy trên ESP32
- `dashboard/`: web dashboard quản lý và giám sát
- `api/`: endpoint runtime để cấp cấu hình cho dashboard

Thiết kế hiện tại xoay quanh Firebase Realtime Database. ESP32 đẩy dữ liệu cảm biến, trạng thái an ninh, log truy cập và trạng thái relay lên Firebase; dashboard đọc trực tiếp dữ liệu đó để hiển thị và điều khiển.

## Tổng quan

Các nhóm chức năng chính:

- Giám sát cảm biến: nhiệt độ, ánh sáng, độ ẩm, chất lượng không khí
- Điều khiển relay từ xa qua dashboard
- Lập lịch tự động cho relay theo khung giờ
- Quản lý an ninh: RFID, keypad, PIR, còi báo động
- Quản lý thẻ RFID: duyệt, từ chối, khôi phục, xoá vĩnh viễn
- Ghi nhận nhật ký ra/vào
- Hiển thị thời tiết
- Chế độ mock/demo khi chưa cấu hình Firebase

## Cấu trúc dự án

```text
SmartHome_IOT/
├── api/
│   └── config.js
├── dashboard/
│   ├── index.html
│   ├── api/
│   │   └── config.js
│   ├── env.js
│   ├── app.js
│   └── js/
│       ├── app.js
│       ├── core/
│       │   ├── firebase.js
│       │   └── ui.js
│       └── features/
│           ├── auth.js
│           ├── home.js
│           ├── logs.js
│           ├── rfid_manager.js
│           ├── schedule.js
│           ├── security.js
│           └── weather.js
├── firmware/
│   ├── config.example.h
│   ├── main/
│   │   ├── actuator.ino
│   │   ├── config.h
│   │   ├── display.ino
│   │   ├── main.ino
│   │   ├── network.ino
│   │   ├── security.ino
│   │   ├── sensor.ino
│   │   └── types.h
│   ├── rtc_setup/
│   └── uno_extension/
└── README.md
```

## Tính năng theo từng phần

### Firmware ESP32

`firmware/main/main.ino` là entry point. Khi chạy, firmware:

- Khởi tạo cảm biến, hiển thị, cơ cấu chấp hành và module an ninh
- Kết nối Wi-Fi và Firebase
- Đồng bộ thời gian bằng NTP
- Đọc và đẩy dữ liệu cảm biến lên Firebase theo chu kỳ
- Lắng nghe lệnh relay, trạng thái báo động và lịch hẹn giờ
- Xử lý RFID, PIR, keypad qua luồng xử lý an ninh
- Ghi nhật ký truy cập ngay khi có sự kiện

### Dashboard web

Dashboard là SPA JavaScript thuần, không có framework build riêng. Entry point là `dashboard/js/app.js`, được nạp từ `dashboard/index.html`.

Các module chính:

- `auth.js`: đăng nhập mock/local
- `home.js`: hiển thị cảm biến và điều khiển relay
- `schedule.js`: cấu hình lịch bật/tắt relay
- `security.js`: theo dõi PIR và trạng thái báo động
- `logs.js`: xem và xoá nhật ký truy cập
- `rfid_manager.js`: quản lý vòng đời thẻ RFID
- `weather.js`: widget thời tiết

Dashboard có 2 chế độ:

- Cấu hình thật: dùng Firebase Realtime Database
- Mock/demo: tự bật khi cấu hình Firebase còn placeholder `YOUR_*`

### API runtime

`dashboard/index.html` sẽ gọi `GET /api/config` để lấy cấu hình runtime và gán vào `window.__SMARTHOME_ENV__`.

Hai file `api/config.js` và `dashboard/api/config.js` cùng trả về dữ liệu cấu hình theo biến môi trường, phù hợp cho môi trường deploy khác nhau.

## Firebase Data Model

Các node hiện dùng trong code:

```text
/sensors/
  temp
  light
  humidity
  air
  time

/relay/
  ch1
  ch3

/commands/
  relay_1
  relay_3

/schedules/
  ch1/
    on_time
    off_time
    enabled
    mode
  ch3/
    on_time
    off_time
    enabled
    mode

/security/
  mode
  motion_detected
  alarm_status
  uno_online
  time_synced

/access_logs/
  {auto_id}/
    created_at
    display_time
    auth_method
    identity_type
    identity_value
    actor_id
    actor_name
    result
    granted

/pending_cards/
  {uid}/
    status
    timestamp
    display_time
    reject_rescan

/authorized_cards/
  {uid}/
    added_at
    label
    locked
    deleted

/revoked_cards/
  {uid}/

/local_cards/
  {uid}/

/system/
  time_synced
```

## Chạy dự án

### 1. Dashboard

Dashboard không có bước build. Chỉ cần mở bằng web server tĩnh hoặc môi trường có endpoint `/api/config`.

Luồng chạy phù hợp:

1. Cung cấp endpoint `GET /api/config`
2. Mở `dashboard/index.html`
3. Dashboard sẽ tự import `dashboard/js/app.js`

Nếu Firebase chưa được cấu hình đúng, dashboard sẽ tự chuyển sang mock mode.

### 2. Firmware ESP32

Mở folder `firmware/main/` bằng Arduino IDE và nạp sketch `main.ino`.

Trước khi nạp:

- Copy `firmware/config.example.h` thành `firmware/main/config.h` nếu cần dùng template
- Điền Wi-Fi, Firebase và các thông tin định danh thật của dự án
- Cài đúng board ESP32 trong Arduino IDE
- Cài các thư viện Arduino mà code đang dùng

## Cấu hình firmware

File `firmware/main/config.h` là file cấu hình cục bộ. Không nên đẩy thông tin thật lên repo công khai.

Các giá trị thường cần cấu hình:

```cpp
#define WIFI_SSID     "your_wifi"
#define WIFI_PASS     "your_password"
#define FIREBASE_URL  "https://your-project.firebaseio.com"
#define FIREBASE_KEY  "your_api_key"
#define SECURITY_PIN  "123456"
#define RFID_UID      "4362F506"
```

## Cấu hình dashboard

Dashboard đọc biến runtime từ `window.__SMARTHOME_ENV__`, được nạp qua endpoint `/api/config`.

Nếu chưa có config thật, file `dashboard/env.js` sẽ dùng giá trị mặc định và bật mock mode.

## Cách hoạt động của dashboard

### Home

- Hiển thị nhiệt độ, độ sáng, độ ẩm, chất lượng không khí
- Cho phép bật/tắt relay qua Firebase

### Schedule

- Quản lý lịch bật/tắt cho `ch1` và `ch3`
- Chỉ cho bật lịch khi ESP32 đã đồng bộ NTP
- Hỗ trợ lịch chạy qua đêm

### Security

- Theo dõi trạng thái `motion_detected`
- Điều khiển `alarm_status`
- Chọn chế độ bảo vệ: `always`, `night_only`, `disabled`

### Logs

- Đọc log từ `/access_logs`
- Hỗ trợ đọc thêm node legacy `/access_log` nếu có dữ liệu cũ
- Có nút xoá toàn bộ log đang hiển thị

### RFID Manager

- Danh sách thẻ chờ duyệt
- Thẻ đã duyệt
- Thẻ bị từ chối
- Thẻ đã xoá

Các thao tác hỗ trợ:

- Duyệt thẻ
- Từ chối thẻ
- Khoá/mở khoá
- Khôi phục
- Xoá vĩnh viễn

## Giao tiếp phần cứng

Từ code hiện tại:

- ESP32 kết nối Firebase qua `FirebaseESP32`
- ESP32 dùng `Serial2` để giao tiếp với UNO extension
- RFID RC522 được đọc trực tiếp trên ESP32
- PIR kích hoạt cảnh báo theo mode an ninh
- Relay được đồng bộ hai chiều giữa firmware và dashboard

Các chân phần cứng cụ thể nên xem trực tiếp trong source của từng module vì có thể thay đổi theo phiên bản phần cứng.

## Ghi chú kỹ thuật

- Code dùng `millis()` để tránh blocking thay vì lạm dụng `delay()`
- Lịch tự động phụ thuộc vào trạng thái đồng bộ thời gian
- Khi mất NTP, lịch sẽ tạm dừng
- Khi Firebase chưa cấu hình đúng, dashboard vẫn chạy ở mock mode để demo UI và luồng thao tác

## Khuyến nghị khi phát triển

- Giữ cấu trúc node Firebase ổn định giữa firmware và dashboard
- Nếu đổi tên node, sửa đồng thời cả firmware và dashboard
- Test luồng RFID, schedule và logs sau mỗi thay đổi lớn
- Không lưu secret thật trực tiếp trong repo nếu dự án được chia sẻ công khai

## Các file nên đọc trước khi sửa

- [`firmware/main/main.ino`](firmware/main/main.ino)
- [`firmware/main/network.ino`](firmware/main/network.ino)
- [`firmware/main/security.ino`](firmware/main/security.ino)
- [`dashboard/js/app.js`](dashboard/js/app.js)
- [`dashboard/js/core/firebase.js`](dashboard/js/core/firebase.js)
- [`dashboard/index.html`](dashboard/index.html)


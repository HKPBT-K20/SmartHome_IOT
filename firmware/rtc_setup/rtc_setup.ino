// ============================================================
// RTC SETUP SKETCH — nạp MỘT LẦN duy nhất để set giờ DS1307
// Sau khi Serial in đúng giờ → xoá sketch này, nạp lại firmware chính
// ============================================================
#include <Wire.h>
#include <RTClib.h>

RTC_DS1307 rtc;

void setup() {
  Serial.begin(115200);
  delay(1000);

  if (!rtc.begin()) {
    Serial.println("ERROR: DS1307 not found — check wiring (SDA/SCL)");
    while (1);
  }

  // __DATE__ / __TIME__ là giờ máy tính lúc compile (local = GMT+7)
  // RTC lưu giờ local — khớp với configTime(7*3600, ...) trong firmware chính
  rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));

  DateTime now = rtc.now();
  Serial.printf("RTC set to: %04d-%02d-%02d %02d:%02d:%02d (GMT+7)\n",
    now.year(), now.month(), now.day(),
    now.hour(), now.minute(), now.second());

  if (now.year() < 2024) {
    Serial.println("WARNING: year looks wrong — rebuild and re-upload");
  } else {
    Serial.println("RTC OK — upload firmware main now");
  }
}

void loop() {}

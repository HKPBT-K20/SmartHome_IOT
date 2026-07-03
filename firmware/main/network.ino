// Bảo: WiFi, Firebase Realtime Database
#include <WiFi.h>
#include <RTClib.h>
#include <FirebaseESP32.h>
#include "config.h"
#include "types.h"

// ── FIREBASE OBJECTS ──────────────────────────────────────────
FirebaseData   fbdo;
FirebaseAuth   auth;
FirebaseConfig fbConfig;

static bool firebaseReady = false;

// Các biến này được định nghĩa trong security.ino
extern AccessLog lastLog;
extern bool      newLogAvailable;

// ── SETUP ─────────────────────────────────────────────────────
void setupFirebase() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > 15000) {
      Serial.println("\nWiFi timeout — check SSID/password in config.h");
      return;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected: " + WiFi.localIP().toString());

  // NTP là nguồn thời gian ưu tiên — SSL cần notBefore/notAfter hợp lệ
  configTime(7 * 3600, 0, "time.google.com", "pool.ntp.org");
  delay(2000);

  struct tm t;
  if (getLocalTime(&t) && t.tm_year > 120) {
    Serial.printf("NTP synced: %04d-%02d-%02d %02d:%02d:%02d\n",
      t.tm_year + 1900, t.tm_mon + 1, t.tm_mday,
      t.tm_hour, t.tm_min, t.tm_sec);

  } else {
    // Fallback 1: compile-time — đủ dùng cho dev/test, đúng trong vài phút sau Upload
    // DateTime(__DATE__,__TIME__) parse local time (GMT+7) → trừ 7h ra UTC cho settimeofday()
    Serial.println("NTP unavailable — using compile-time fallback (DEV ONLY)");
    DateTime compileTime(F(__DATE__), F(__TIME__));
    time_t utc = (time_t)compileTime.unixtime() - 7UL * 3600UL; // GMT+7 local → UTC
    struct timeval tv = { utc, 0 };
    settimeofday(&tv, nullptr);

    // Xác nhận lại
    getLocalTime(&t);
    Serial.printf("Compile-time set: %04d-%02d-%02d %02d:%02d:%02d (GMT+7)\n",
      t.tm_year + 1900, t.tm_mon + 1, t.tm_mday,
      t.tm_hour, t.tm_min, t.tm_sec);

#ifdef RTC_ENABLED
    // Fallback 2 (production): validate và dùng RTC nếu compile-time quá cũ
    extern RTC_DS1307 rtc;
    DateTime rtcNow = rtc.now();
    if (rtcNow.year() >= 2024 && rtcNow.year() <= 2099) {
      time_t rtcUtc = (time_t)rtcNow.unixtime() - 7UL * 3600UL;
      struct timeval tvRtc = { rtcUtc, 0 };
      settimeofday(&tvRtc, nullptr);
      Serial.printf("RTC override: %04d-%02d-%02d %02d:%02d:%02d\n",
        rtcNow.year(), rtcNow.month(), rtcNow.day(),
        rtcNow.hour(), rtcNow.minute(), rtcNow.second());
    }
#endif
  }


  fbConfig.database_url               = FIREBASE_URL;
  fbConfig.signer.tokens.legacy_token = FIREBASE_KEY;

  Firebase.begin(&fbConfig, &auth);
  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(4096);

  firebaseReady = true;
  Serial.println("Firebase ready");
}

// ── PUSH SENSORS ──────────────────────────────────────────────
// Gọi mỗi 30 giây từ main loop
void pushSensors() {
  if (!firebaseReady || !Firebase.ready()) return;

  float temp  = readTemperature();
  int   light = readLightLevel();
  char  timeStr[20];
  getTimeString(timeStr);

  bool ok = true;
  ok &= Firebase.setFloat (fbdo, "/sensors/temp",  temp);
  ok &= Firebase.setInt   (fbdo, "/sensors/light", light);
  ok &= Firebase.setString(fbdo, "/sensors/time",  timeStr);

  if (ok) {
    Serial.printf("Sensors pushed: %.1f C, light=%d\n", temp, light);
  } else {
    Serial.println("Sensor push error: " + fbdo.errorReason());
  }
}

// ── PUSH ACCESS LOG ───────────────────────────────────────────
// Gọi ngay khi newLogAvailable == true
void pushAccessLog() {
  if (!newLogAvailable) return;

  // Reset cờ trước để không gọi lại nếu Firebase lỗi
  newLogAvailable = false;

  if (!firebaseReady || !Firebase.ready()) return;

  FirebaseJson json;
  json.set("uid",     lastLog.uid);
  json.set("method",  lastLog.method);
  json.set("time",    lastLog.time);
  json.set("granted", lastLog.granted);

  if (Firebase.pushJSON(fbdo, "/access_log", json)) {
    Serial.println("AccessLog pushed: " + String(lastLog.uid)
                   + " [" + String(lastLog.method) + "] "
                   + (lastLog.granted ? "GRANTED" : "DENIED"));
  } else {
    Serial.println("AccessLog push error: " + fbdo.errorReason());
  }
}

// ── LISTEN COMMANDS ───────────────────────────────────────────
// Gọi mỗi 5 giây — poll /commands/relay_1 và relay_2
void listenCommands() {
  if (!firebaseReady || !Firebase.ready()) return;

  bool val;

  if (Firebase.getBool(fbdo, "/commands/relay_1", &val)) {
    setRelay(1, val);
    pushRelayState(1, val);
  }

  if (Firebase.getBool(fbdo, "/commands/relay_2", &val)) {
    setRelay(2, val);
    pushRelayState(2, val);
  }
}

// ── PUSH RELAY STATE ─────────────────────────────────────────
// Sync trạng thái relay lên /relay/ch1|ch2 để dashboard đọc được
void pushRelayState(int ch, bool on) {
  if (!firebaseReady || !Firebase.ready()) return;
  if (ch == 1) {
    Firebase.setBool(fbdo, "/relay/ch1", on);
  } else if (ch == 2) {
    Firebase.setBool(fbdo, "/relay/ch2", on);
  }
}

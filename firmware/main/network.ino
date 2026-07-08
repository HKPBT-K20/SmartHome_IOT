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
extern bool      relayState[3];
extern char      securityMode[16];
void pushRelayState(int ch, bool on);

struct RelayScheduleConfig {
  char onTime[6];
  char offTime[6];
  bool enabled;
  bool valid;
};

static RelayScheduleConfig relaySchedules[3] = {
  {{0}, {0}, false, false},
  {{0}, {0}, false, false},
  {{0}, {0}, false, false}
};

static bool copyFirebaseString(const char* path, char* out, size_t outSize) {
  if (!Firebase.getString(fbdo, path)) {
    return false;
  }

  String value = fbdo.stringData();
  value.trim();
  strncpy(out, value.c_str(), outSize - 1);
  out[outSize - 1] = '\0';
  return true;
}

static bool parseTimeToMinutes(const char* text, int &minutesOfDay) {
  int hour = -1;
  int minute = -1;
  if (sscanf(text, "%d:%d", &hour, &minute) != 2) {
    return false;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return false;
  }

  minutesOfDay = hour * 60 + minute;
  return true;
}

static bool getCurrentMinutesOfDay(int &minutesOfDay) {
  struct tm t;
  if (getLocalTime(&t) && t.tm_year > 120) {
    minutesOfDay = t.tm_hour * 60 + t.tm_min;
    return true;
  }

#ifdef RTC_ENABLED
  extern RTC_DS1307 rtc;
  DateTime now = rtc.now();
  if (now.year() >= 2024) {
    minutesOfDay = now.hour() * 60 + now.minute();
    return true;
  }
#endif

  minutesOfDay = (millis() / 60000UL) % 1440;
  return false;
}

static bool isScheduleActive(const RelayScheduleConfig &cfg, int minutesOfDay) {
  int onMinutes = 0;
  int offMinutes = 0;
  if (!cfg.valid) {
    return false;
  }
  if (!parseTimeToMinutes(cfg.onTime, onMinutes) || !parseTimeToMinutes(cfg.offTime, offMinutes)) {
    return false;
  }

  if (onMinutes == offMinutes) {
    return false;
  }

  if (onMinutes < offMinutes) {
    return minutesOfDay >= onMinutes && minutesOfDay < offMinutes;
  }

  return minutesOfDay >= onMinutes || minutesOfDay < offMinutes;
}

static void syncSecurityMode() {
  if (!firebaseReady || !Firebase.ready()) return;

  if (!Firebase.getString(fbdo, "/security/mode")) return;

  String mode = fbdo.stringData();
  mode.trim();
  if (mode.length() == 0) {
    mode = "always";
  }

  strncpy(securityMode, mode.c_str(), sizeof(securityMode) - 1);
  securityMode[sizeof(securityMode) - 1] = '\0';
}

static void syncScheduleChannel(int ch, int minutesOfDay) {
  if (!firebaseReady || !Firebase.ready()) return;
  if (ch < 1 || ch > 2) return;

  char path[40];
  bool enabled = false;

  snprintf(path, sizeof(path), "/schedules/ch%d/enabled", ch);
  if (!Firebase.getBool(fbdo, path, &enabled)) {
    relaySchedules[ch].enabled = false;
    relaySchedules[ch].valid = false;
    return;
  }

  relaySchedules[ch].enabled = enabled;

  snprintf(path, sizeof(path), "/schedules/ch%d/on_time", ch);
  if (!copyFirebaseString(path, relaySchedules[ch].onTime, sizeof(relaySchedules[ch].onTime))) {
    relaySchedules[ch].valid = false;
    return;
  }

  snprintf(path, sizeof(path), "/schedules/ch%d/off_time", ch);
  if (!copyFirebaseString(path, relaySchedules[ch].offTime, sizeof(relaySchedules[ch].offTime))) {
    relaySchedules[ch].valid = false;
    return;
  }

  relaySchedules[ch].valid = true;

  if (!relaySchedules[ch].enabled) {
    return;
  }

  bool desiredOn = isScheduleActive(relaySchedules[ch], minutesOfDay);
  if (relayState[ch] != desiredOn) {
    setRelay(ch, desiredOn);
    pushRelayState(ch, desiredOn);
  }
}

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
  pushRelayState(1, relayState[1]);
  pushRelayState(2, relayState[2]);
  Serial.println("Firebase ready");
}

// ── PUSH SENSORS ──────────────────────────────────────────────
// Gọi mỗi 30 giây từ main loop
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

  if (ok) {
    if (hasHumidity) {
      Serial.printf("Sensors pushed: %.1f C, light=%d, humidity=%.1f%%\n", temp, light, humidity);
    } else {
      Serial.printf("Sensors pushed: %.1f C, light=%d, humidity=N/A\n", temp, light);
    }
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
  json.set("created_at",     (double)lastLog.createdAt);
  json.set("display_time",   lastLog.displayTime);
  json.set("auth_method",    lastLog.authMethod);
  json.set("identity_type",  lastLog.identityType);
  json.set("identity_value", lastLog.identityValue);
  json.set("actor_id",       lastLog.actorId);
  json.set("actor_name",     lastLog.actorName);
  json.set("result",         lastLog.result);
  json.set("granted",        lastLog.granted);

  if (Firebase.pushJSON(fbdo, "/access_logs", json)) {
    Serial.println("AccessLog pushed: " + String(lastLog.identityValue)
                   + " [" + String(lastLog.authMethod) + "] "
                   + String(lastLog.result));
  } else {
    Serial.println("AccessLog push error: " + fbdo.errorReason());
  }
}

// Gọi khi PIR đổi trạng thái để dashboard cập nhật phần an ninh
void pushSecurityMotion(bool detected) {
  if (!firebaseReady || !Firebase.ready()) return;

  if (Firebase.setBool(fbdo, "/security/motion_detected", detected)) {
    Serial.println(String("Security motion pushed: ") + (detected ? "true" : "false"));
  } else {
    Serial.println("Security motion push error: " + fbdo.errorReason());
  }
}

// ── LISTEN COMMANDS ───────────────────────────────────────────
// Gọi mỗi 5 giây — poll relay manual, security mode, và lịch tự động
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

  syncSecurityMode();

  int minutesOfDay = 0;
  getCurrentMinutesOfDay(minutesOfDay);
  syncScheduleChannel(1, minutesOfDay);
  syncScheduleChannel(2, minutesOfDay);
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

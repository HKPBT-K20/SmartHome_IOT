// Bảo: WiFi, Firebase Realtime Database
#include <WiFi.h>
#include <FirebaseESP32.h>
#include <vector>
#include <algorithm>
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
extern bool      relayState[4];
extern char      securityMode[16];
extern std::vector<String> authorizedUIDs;
void pushRelayState(int ch, bool on);

static RelayScheduleConfig relaySchedules[4] = {
  {{0}, {0}, false, false},
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

static bool scheduleActivePeriod[4] = {false, false, false, false};
static int  scheduleSkipDay[4] = {-1, -1, -1, -1};

static int getCurrentDayOfYear() {
  struct tm t;
  if (getLocalTime(&t)) {
    return t.tm_yday;
  }
  return -2;
}

static void syncScheduleChannel(int ch, int minutesOfDay) {
  if (!firebaseReady || !Firebase.ready()) return;
  if (ch != 1 && ch != 3) return;

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
    scheduleActivePeriod[ch] = false;
    return;
  }

  int today = getCurrentDayOfYear();
  bool isInsideWindow = isScheduleActive(relaySchedules[ch], minutesOfDay);

  if (isInsideWindow) {
    if (scheduleSkipDay[ch] == today) {
      return;
    }

    if (!scheduleActivePeriod[ch]) {
      setRelay(ch, true);
      pushRelayState(ch, true);
      scheduleActivePeriod[ch] = true;
    } else {
      if (!relayState[ch]) {
        scheduleSkipDay[ch] = today;
        scheduleActivePeriod[ch] = false;
        Serial.printf("Schedule: Manual override OFF on CH%d for today only.\n", ch);
      }
    }
  } else {
    if (scheduleActivePeriod[ch]) {
      setRelay(ch, false);
      pushRelayState(ch, false);
      scheduleActivePeriod[ch] = false;
    }
    if (scheduleSkipDay[ch] != -1 && scheduleSkipDay[ch] != today) {
      scheduleSkipDay[ch] = -1;
    }
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
    Serial.println("NTP unavailable — using compile-time fallback (DEV ONLY)");
    
    int year = 0, day = 0, hour = 0, min = 0, sec = 0;
    char monthName[4] = {0};
    const char monthNames[] = "JanFebMarAprMayJunJulAugSepOctNovDec";
    sscanf(__DATE__, "%s %d %d", monthName, &day, &year);
    sscanf(__TIME__, "%d:%d:%d", &hour, &min, &sec);

    int month = 0;
    for (int i = 0; i < 12; i++) {
      if (strncmp(&monthNames[i * 3], monthName, 3) == 0) {
        month = i;
        break;
      }
    }

    struct tm compileTm;
    compileTm.tm_year = year - 1900;
    compileTm.tm_mon = month;
    compileTm.tm_mday = day;
    compileTm.tm_hour = hour;
    compileTm.tm_min = min;
    compileTm.tm_sec = sec;
    compileTm.tm_isdst = -1;

    time_t utc = mktime(&compileTm) - 7UL * 3600UL; // GMT+7 local → UTC
    struct timeval tv = { utc, 0 };
    settimeofday(&tv, nullptr);

    // Xác nhận lại
    getLocalTime(&t);
    Serial.printf("Compile-time set: %04d-%02d-%02d %02d:%02d:%02d (GMT+7)\n",
      t.tm_year + 1900, t.tm_mon + 1, t.tm_mday,
      t.tm_hour, t.tm_min, t.tm_sec);
  }


  fbConfig.database_url               = FIREBASE_URL;
  fbConfig.signer.tokens.legacy_token = FIREBASE_KEY;
  fbConfig.timeout.socketConnection   = 1500; // Giới hạn timeout 1.5s để tránh block loop khi SSL lỗi

  Serial.printf("[Debug] Free Heap before Firebase: %u bytes\n", ESP.getFreeHeap());

  Firebase.begin(&fbConfig, &auth);
  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(4096);

  firebaseReady = true;
  pushRelayState(1, relayState[1]);
  pushRelayState(3, relayState[3]);
  pushSecurityMotion(false);
  pushSecurityAlarm(false);
  pushLocalCards();
  syncAuthorizedCards();
  Serial.println("Firebase ready");
}

void pushAirQuality() {
  if (!firebaseReady || !Firebase.ready()) return;

  extern int readAirQualityPPM();
  int airVal = readAirQualityPPM();
  if (Firebase.setInt(fbdo, "/sensors/air", airVal)) {
    Serial.printf("Air quality pushed: %d PPM\n", airVal);
  } else {
    Serial.println("Air quality push error: " + fbdo.errorReason());
  }

  if (airVal > 600) {
    extern void alertBuzzer(int beeps);
    alertBuzzer(5);
  }
}

void pushSensors() {
  if (!firebaseReady || !Firebase.ready()) return;

  float temp  = readTemperature();
  int   light = readLightLevel();
  float humidity = 0.0f;
  bool  hasHumidity = readHumidity(humidity);
  char  timeStr[20];
  getTimeString(timeStr);

  bool ok = true;
  if (temp != -999.0f) {
    ok &= Firebase.setFloat(fbdo, "/sensors/temp",
     temp);
  }
  ok &= Firebase.setInt   (fbdo, "/sensors/light", light);
  ok &= Firebase.setString(fbdo, "/sensors/time",  timeStr);

  if (hasHumidity) {
    ok &= Firebase.setFloat(fbdo, "/sensors/humidity", humidity);
  }

  if (ok) {
    if (temp != -999.0f) {
      Serial.printf("Sensors pushed: DHT11_Temp=%.1f C, light=%d, humidity=%s\n",
        temp, light, hasHumidity ? String(humidity, 1).c_str() : "N/A");
    } else {
      Serial.printf("Sensors pushed: DHT11_Temp=ERR, light=%d, humidity=%s\n",
        light, hasHumidity ? String(humidity, 1).c_str() : "N/A");
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

void pushSecurityMotion(bool detected) {
  if (!firebaseReady || !Firebase.ready()) return;

  if (Firebase.setBool(fbdo, "/security/motion_detected", detected)) {
    Serial.println(String("Security motion pushed: ") + (detected ? "true" : "false"));
  } else {
    Serial.println("Security motion push error: " + fbdo.errorReason());
  }
}

void pushUnoOnlineStatus(bool online) {
  if (!firebaseReady || !Firebase.ready()) return;

  if (Firebase.setBool(fbdo, "/security/uno_online", online)) {
    Serial.println(String("Uno online status pushed: ") + (online ? "true" : "false"));
  } else {
    Serial.println("Uno online status push error: " + fbdo.errorReason());
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

  if (Firebase.getBool(fbdo, "/commands/relay_3", &val)) {
    setRelay(3, val);
    pushRelayState(3, val);
  }

  syncSecurityMode();

  static bool lastAlarmStatus = false;
  if (Firebase.getBool(fbdo, "/security/alarm_status", &val)) {
    if (val != lastAlarmStatus) {
      lastAlarmStatus = val;
      extern void alertBuzzer(int beeps);
      extern void stopBuzzer();
      if (val) {
        alertBuzzer(9999);
      } else {
        stopBuzzer();
      }
    }
  }

  int minutesOfDay = 0;
  getCurrentMinutesOfDay(minutesOfDay);
  syncScheduleChannel(1, minutesOfDay);
  syncScheduleChannel(3, minutesOfDay);
}

// ── PUSH RELAY STATE ─────────────────────────────────────────
// Sync trạng thái relay lên /relay/ch1|ch2 để dashboard đọc được
void pushRelayState(int ch, bool on) {
  if (!firebaseReady || !Firebase.ready()) return;
  if (ch == 1) {
    Firebase.setBool(fbdo, "/relay/ch1", on);
  } else if (ch == 3) {
    Firebase.setBool(fbdo, "/relay/ch3", on);
  }
}

// ── PUSH SECURITY ALARM STATUS ───────────────────────────────
void pushSecurityAlarm(bool active) {
  if (!firebaseReady || !Firebase.ready()) return;
  Firebase.setBool(fbdo, "/security/alarm_status", active);
}

// ── RFID SELF-REGISTRATION ────────────────────────────────────

void pushPendingCard(String uid) {
  if (!firebaseReady || !Firebase.ready()) return;

  struct tm t;
  char displayTime[32] = "Unknown time";
  if (getLocalTime(&t) && t.tm_year > 120) {
    snprintf(displayTime, sizeof(displayTime), "%02d/%02d/%04d %02d:%02d:%02d",
             t.tm_mday, t.tm_mon + 1, t.tm_year + 1900,
             t.tm_hour, t.tm_min, t.tm_sec);
  }

  FirebaseJson json;
  json.set("status", "pending");
  json.set("timestamp", (int)(millis()));
  json.set("display_time", displayTime);
  json.set("reject_rescan", false);

  String path = "/pending_cards/" + uid;
  if (Firebase.setJSON(fbdo, path, json)) {
    Serial.println("[RFID] Pushed pending card: " + uid);
  } else {
    Serial.println("[RFID] Push pending error: " + fbdo.errorReason());
  }
}

void pushRejectedRescan(String uid) {
  if (!firebaseReady || !Firebase.ready()) return;

  String path = "/pending_cards/" + uid + "/reject_rescan";
  if (Firebase.setBool(fbdo, path, true)) {
    Serial.println("[RFID] Flagged reject_rescan for: " + uid);
  } else {
    Serial.println("[RFID] Reject rescan flag error: " + fbdo.errorReason());
  }
}

String getCardStatus(String uid) {
  if (!firebaseReady || !Firebase.ready()) return "none";

  String path = "/pending_cards/" + uid + "/status";
  if (Firebase.getString(fbdo, path)) {
    String status = fbdo.stringData();
    status.trim();
    return status;
  }
  return "none";
}

void pushLocalCards() {
  if (!firebaseReady || !Firebase.ready()) return;

  extern String validUIDs[];
  extern int uidCount;
  for (int i = 0; i < uidCount; i++) {
    String path = "/local_cards/" + validUIDs[i];
    FirebaseJson json;
    json.set("label", "Thẻ mặc định");
    json.set("source", "firmware");
    Firebase.setJSON(fbdo, path, json);
  }
  Serial.println("[Local] Pushed " + String(uidCount) + " local UIDs to Firebase");
}

void syncAuthorizedCards() {
  if (!firebaseReady || !Firebase.ready()) return;

  if (!Firebase.getJSON(fbdo, "/authorized_cards")) {
    // Node chưa tồn tại = chưa có thẻ nào được duyệt — không phải lỗi thật
    const String& reason = fbdo.errorReason();
    if (reason.indexOf("not exist") < 0 && reason.indexOf("path not found") < 0) {
      Serial.println("[Sync] authorized_cards error: " + reason);
    }
    authorizedUIDs.clear();
    return;
  }

  // Collect keys trước khi gọi bất kỳ Firebase operation nào khác
  // (mỗi Firebase call overwrite fbdo.jsonObject())
  FirebaseJson& json = fbdo.jsonObject();
  size_t count = json.iteratorBegin();

  std::vector<String> fetched;
  int skipped = 0;
  for (size_t i = 0; i < count && (int)fetched.size() < 20; i++) {
    String key, value;
    int type = 0;
    json.iteratorGet(i, type, key, value);
    if (key.length() > 0) {
      FirebaseJson childJson;
      childJson.setJsonData(value);
      FirebaseJsonData lockedData, deletedData;
      childJson.get(lockedData, "locked");
      childJson.get(deletedData, "deleted");

      bool isLocked = lockedData.success && lockedData.boolValue;
      bool isDeleted = deletedData.success && deletedData.boolValue;

      if (isLocked || isDeleted) {
        skipped++;
      } else {
        fetched.push_back(key);
      }
    }
  }
  json.iteratorEnd();

  authorizedUIDs = fetched;
  Serial.println("[Sync] " + String(authorizedUIDs.size()) + " authorized UIDs loaded (" + String(skipped) + " skipped — locked/deleted)");
}

void checkRevokedCards() {
  if (!firebaseReady || !Firebase.ready()) return;
  // Fast-path: nếu không có gì trong vector thì bỏ qua luôn
  // Vẫn phải check Firebase vì có thể card được add xong bị revoke trước lần sync đầu tiên

  if (!Firebase.getJSON(fbdo, "/revoked_cards")) {
    // Node không tồn tại = không có revocation nào đang pending
    return;
  }

  FirebaseJson& json = fbdo.jsonObject();
  size_t count = json.iteratorBegin();

  // Collect tất cả UID bị thu hồi trước khi gọi deleteNode
  // (deleteNode sẽ overwrite fbdo)
  std::vector<String> toRevoke;
  for (size_t i = 0; i < count; i++) {
    String key, value;
    int type = 0;
    json.iteratorGet(i, type, key, value);
    if (key.length() > 0) {
      toRevoke.push_back(key);
    }
  }
  json.iteratorEnd();

  if (toRevoke.empty()) return;

  for (const String& uid : toRevoke) {
    // Xóa khỏi authorizedUIDs vector ngay lập tức
    auto it = std::find(authorizedUIDs.begin(), authorizedUIDs.end(), uid);
    if (it != authorizedUIDs.end()) {
      authorizedUIDs.erase(it);
      Serial.println("[Revoke] Removed " + uid + " from authorized list — access denied immediately");
    }
    // Xóa node /revoked_cards/{uid} sau khi đã xử lý
    Firebase.deleteNode(fbdo, "/revoked_cards/" + uid);
  }
}


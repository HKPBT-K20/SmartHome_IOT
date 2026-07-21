// Báº£o: WiFi, Firebase Realtime Database
#include <WiFi.h>
#include <FirebaseESP32.h>
#include <vector>
#include <algorithm>
#include "config.h"
#include "types.h"

// â”€â”€ FIREBASE OBJECTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
FirebaseData   fbdo;
FirebaseAuth   auth;
FirebaseConfig fbConfig;

static bool firebaseReady = false;

// CÃ¡c biáº¿n nÃ y Ä‘Æ°á»£c Ä‘á»‹nh nghÄ©a trong security.ino
extern AccessLog lastLog;
extern bool      newLogAvailable;
extern bool      relayState[4];
extern char      securityMode[16];
extern std::vector<String> authorizedUIDs;
static std::vector<String> authorizedCardLabels;
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

  minutesOfDay = -1;
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
static bool lastTimeSyncStatus = false;
static bool lastTimeSyncStatusInitialized = false;

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
  if (!timeSynced) return;

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

static void pauseScheduleRelaysDueToTimeLoss() {
  for (int ch : {1, 3}) {
    if (scheduleActivePeriod[ch]) {
      setRelay(ch, false);
      pushRelayState(ch, false);
      scheduleActivePeriod[ch] = false;
    }
  }
}

static void pushTimeSyncStatus(bool synced) {
  if (!firebaseReady || !Firebase.ready()) return;
  if (lastTimeSyncStatusInitialized && lastTimeSyncStatus == synced) {
    return;
  }

  lastTimeSyncStatus = synced;
  lastTimeSyncStatusInitialized = true;

  if (Firebase.setBool(fbdo, "/system/time_synced", synced)) {
    Serial.println(String("[Time] Sync status pushed: ") + (synced ? "true" : "false"));
  } else {
    Serial.println("Time sync push error: " + fbdo.errorReason());
  }
}

// â”€â”€ SETUP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
void setupFirebase() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > 15000) {
      Serial.println("\nWiFi timeout - check SSID/password in config.h");
      return;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected: " + WiFi.localIP().toString());

  configTime(7 * 3600, 0, "time.google.com", "pool.ntp.org");
  delay(2000);

  struct tm t;
  timeSynced = getLocalTime(&t) && t.tm_year > 120;
  if (timeSynced) {
    Serial.printf("NTP synced: %04d-%02d-%02d %02d:%02d:%02d\n",
      t.tm_year + 1900, t.tm_mon + 1, t.tm_mday,
      t.tm_hour, t.tm_min, t.tm_sec);
  } else {
    Serial.println("NTP unavailable - schedules paused until time sync succeeds");
  }

  fbConfig.database_url               = FIREBASE_URL;
  fbConfig.signer.tokens.legacy_token = FIREBASE_KEY;
  fbConfig.timeout.socketConnection   = 1500;

  Serial.printf("[Debug] Free Heap before Firebase: %u bytes\n", ESP.getFreeHeap());

  Firebase.begin(&fbConfig, &auth);
  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(4096);

  firebaseReady = true;
  pushRelayState(1, relayState[1]);
  pushRelayState(3, relayState[3]);
  pushSecurityMotion(false);
  pushSecurityAlarm(false);
  pushTimeSyncStatus(timeSynced);
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

// â”€â”€ PUSH ACCESS LOG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Gá»i ngay khi newLogAvailable == true
void pushAccessLog() {
  if (!newLogAvailable) return;

  // Reset cá» trÆ°á»›c Ä‘á»ƒ khÃ´ng gá»i láº¡i náº¿u Firebase lá»—i
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

// â”€â”€ LISTEN COMMANDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Gá»i má»—i 5 giÃ¢y â€” poll relay manual, security mode, vÃ  lá»‹ch tá»± Ä‘á»™ng
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
  bool syncedNow = getCurrentMinutesOfDay(minutesOfDay);
  if (syncedNow != timeSynced) {
    timeSynced = syncedNow;
    pushTimeSyncStatus(timeSynced);
    if (!timeSynced) {
      pauseScheduleRelaysDueToTimeLoss();
      Serial.println("Schedule paused: time is not synchronized.");
    }
  }

  if (timeSynced) {
    syncScheduleChannel(1, minutesOfDay);
    syncScheduleChannel(3, minutesOfDay);
  }
}

// â”€â”€ PUSH RELAY STATE' â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Sync tráº¡ng thÃ¡i relay lÃªn /relay/ch1|ch2 Ä‘á»ƒ dashboard Ä‘á»c Ä‘Æ°á»£c
void pushRelayState(int ch, bool on) {
  if (!firebaseReady || !Firebase.ready()) return;
  if (ch == 1) {
    Firebase.setBool(fbdo, "/relay/ch1", on);
  } else if (ch == 3) {
    Firebase.setBool(fbdo, "/relay/ch3", on);
  }
}

// â”€â”€ PUSH SECURITY ALARM STATUS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
void pushSecurityAlarm(bool active) {
  if (!firebaseReady || !Firebase.ready()) return;
  Firebase.setBool(fbdo, "/security/alarm_status", active);
}

// â”€â”€ RFID SELF-REGISTRATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    json.set("label", "Tháº» máº·c Ä‘á»‹nh");
    json.set("source", "firmware");
    Firebase.setJSON(fbdo, path, json);
  }
  Serial.println("[Local] Pushed " + String(uidCount) + " local UIDs to Firebase");
}

String getAuthorizedCardLabel(const String &uid) {
  for (size_t i = 0; i < authorizedUIDs.size() && i < authorizedCardLabels.size(); i++) {
    if (authorizedUIDs[i] == uid) {
      return authorizedCardLabels[i];
    }
  }
  return "";
}

void syncAuthorizedCards() {
  if (!firebaseReady || !Firebase.ready()) return;

  if (!Firebase.getJSON(fbdo, "/authorized_cards")) {
    // Node chÆ°a tá»“n táº¡i = chÆ°a cÃ³ tháº» nÃ o Ä‘Æ°á»£c duyá»‡t â€” khÃ´ng pháº£i lá»—i tháº­t
    const String& reason = fbdo.errorReason();
    if (reason.indexOf("not exist") < 0 && reason.indexOf("path not found") < 0) {
      Serial.println("[Sync] authorized_cards error: " + reason);
    }
    authorizedUIDs.clear();
    authorizedCardLabels.clear();
    return;
  }

  // Collect keys trÆ°á»›c khi gá»i báº¥t ká»³ Firebase operation nÃ o khÃ¡c
  // (má»—i Firebase call overwrite fbdo.jsonObject())
  FirebaseJson& json = fbdo.jsonObject();
  size_t count = json.iteratorBegin();

  std::vector<String> fetched;
  std::vector<String> fetchedLabels;
  int skipped = 0;
  for (size_t i = 0; i < count && (int)fetched.size() < 20; i++) {
    String key, value;
    int type = 0;
    json.iteratorGet(i, type, key, value);
    if (key.length() > 0) {
      FirebaseJson childJson;
      childJson.setJsonData(value);
      FirebaseJsonData lockedData, deletedData, labelData;
      childJson.get(lockedData, "locked");
      childJson.get(deletedData, "deleted");
      childJson.get(labelData, "label");

      bool isLocked = lockedData.success && lockedData.boolValue;
      bool isDeleted = deletedData.success && deletedData.boolValue;

      if (isLocked || isDeleted) {
        skipped++;
      } else {
        fetched.push_back(key);
        String label = labelData.success ? labelData.stringValue : "";
        label.trim();
        if (label.length() == 0) {
          label = "Tháº» " + key.substring(max(0, (int)key.length() - 4));
        }
        fetchedLabels.push_back(label);
      }
    }
  }
  json.iteratorEnd();

  authorizedUIDs = fetched;
  authorizedCardLabels = fetchedLabels;
  Serial.println("[Sync] " + String(authorizedUIDs.size()) + " authorized UIDs loaded (" + String(skipped) + " skipped â€” locked/deleted)");
}

void checkRevokedCards() {
  if (!firebaseReady || !Firebase.ready()) return;
  // Fast-path: náº¿u khÃ´ng cÃ³ gÃ¬ trong vector thÃ¬ bá» qua luÃ´n
  // Váº«n pháº£i check Firebase vÃ¬ cÃ³ thá»ƒ card Ä‘Æ°á»£c add xong bá»‹ revoke trÆ°á»›c láº§n sync Ä‘áº§u tiÃªn

  if (!Firebase.getJSON(fbdo, "/revoked_cards")) {
    // Node khÃ´ng tá»“n táº¡i = khÃ´ng cÃ³ revocation nÃ o Ä‘ang pending
    return;
  }

  FirebaseJson& json = fbdo.jsonObject();
  size_t count = json.iteratorBegin();

  // Collect táº¥t cáº£ UID bá»‹ thu há»“i trÆ°á»›c khi gá»i deleteNode
  // (deleteNode sáº½ overwrite fbdo)
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
    // XÃ³a khá»i authorizedUIDs vector ngay láº­p tá»©c
    auto it = std::find(authorizedUIDs.begin(), authorizedUIDs.end(), uid);
    if (it != authorizedUIDs.end()) {
      size_t index = (size_t)std::distance(authorizedUIDs.begin(), it);
      authorizedUIDs.erase(it);
      if (index < authorizedCardLabels.size()) {
        authorizedCardLabels.erase(authorizedCardLabels.begin() + index);
      }
      Serial.println("[Revoke] Removed " + uid + " from authorized list â€” access denied immediately");
    }
    // XÃ³a node /revoked_cards/{uid} sau khi Ä‘Ã£ xá»­ lÃ½
    Firebase.deleteNode(fbdo, "/revoked_cards/" + uid);
  }
}


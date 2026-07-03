// Bảo: WiFi, Firebase Realtime Database
#include <Firebase_ESP_Client.h>
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
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Firebase: no WiFi — skip");
    return;
  }

  // Dùng Database Secret (legacy token) — không cần email/password
  fbConfig.database_url              = FIREBASE_URL;
  fbConfig.signer.tokens.legacy_token = FIREBASE_KEY;

  Firebase.begin(&fbConfig, &auth);
  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(2048);

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
  ok &= Firebase.RTDB.setFloat (&fbdo, "/sensors/temp",  temp);
  ok &= Firebase.RTDB.setInt   (&fbdo, "/sensors/light", light);
  ok &= Firebase.RTDB.setString(&fbdo, "/sensors/time",  timeStr);

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

  // pushJSON tự tạo key dạng "-NxXXXXXX" theo timestamp Firebase
  FirebaseJson json;
  json.set("uid",     lastLog.uid);
  json.set("method",  lastLog.method);
  json.set("time",    lastLog.time);
  json.set("granted", lastLog.granted);

  if (Firebase.RTDB.pushJSON(&fbdo, "/access_log", &json)) {
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

  if (Firebase.RTDB.getBool(&fbdo, "/commands/relay_1", &val)) {
    setRelay(1, val);
  }

  if (Firebase.RTDB.getBool(&fbdo, "/commands/relay_2", &val)) {
    setRelay(2, val);
  }
}

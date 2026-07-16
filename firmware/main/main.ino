#include "types.h"

extern int  currentHour;
extern bool newLogAvailable;

extern void handleUnoCommunication();

static unsigned long lastSensorPush   = 0;
static unsigned long lastAirPush      = 0;
static unsigned long lastCmdPoll      = 0;

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, 16, 17);
  delay(1000);
  Serial.println("=== Smart Home Booting ===");

  setupSensors();
  setupRTC();
  setupDisplay();
  setupActuator();
  setupSecurity();

  setupFirebase();

  extern unsigned long lastUnoMessageTime;
  lastUnoMessageTime = millis();

  Serial.println("=== Boot complete ===");
}

void loop() {
  unsigned long now = millis();

  handleUnoCommunication();

  updateTime();
  checkRFID();
  checkKeypad();
  checkPIR(currentHour);
  updateDoor();
  updateBuzzer();
  updateDisplay();

  if (now - lastAirPush >= 5000) {
    extern void pushAirQuality();
    pushAirQuality();
    lastAirPush = now;
  }

  if (now - lastSensorPush >= 30000) {
    pushSensors();
    lastSensorPush = now;
  }



  // ── Poll lệnh relay từ Firebase mỗi 5 giây ──────────────────
  if (now - lastCmdPoll >= 5000) {
    listenCommands();
    lastCmdPoll = now;
  }

  // ── Push access log ngay khi có sự kiện ─────────────────────
  if (newLogAvailable) {
    pushAccessLog();
  }
}

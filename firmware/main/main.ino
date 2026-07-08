#include "types.h"

extern int  currentHour;      // sensor.ino
extern bool newLogAvailable;  // security.ino

// ── millis() TIMERS ───────────────────────────────────────────
static unsigned long lastSensorPush   = 0;
static unsigned long lastCmdPoll      = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("=== Smart Home Booting ===");

  setupSensors();   // TV1: LM35, CDS, analogReadResolution
  setupRTC();       // TV1: DS1307
  setupDisplay();   // TV1: LCD I2C — Wire.begin() gọi bên trong
  setupActuator();  // TV2: Servo, Relay, Buzzer
  setupSecurity();  // TV2: SPI, RFID, Keypad + PIR polling

  setupFirebase();  // TV3: Firebase Realtime Database

  Serial.println("=== Boot complete ===");
}

void loop() {
  unsigned long now = millis();

  // ── Luôn chạy mỗi vòng ──────────────────────────────────────
  updateTime();
  checkRFID();
  checkKeypad();
  checkPIR(currentHour);
  updateDoor();
  updateBuzzer();
  updateDisplay();

  // ── Push sensor mỗi 30 giây ─────────────────────────────────
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

// Phú: Relay, Còi, Servo cửa
#include <ESP32Servo.h>
#include "types.h"

// ── PIN DEFINITIONS ───────────────────────────────────────────
// SERVO: GPIO 25
// BUZZER: GPIO 14
// RELAY: CH1=32, CH2=33
// Lưu ý: relay kích mức THẤP → HIGH = tắt, LOW = bật
#define SERVO_PIN  25
#define BUZZER     14
#define RELAY_1    32
#define RELAY_2    33

Servo doorServo;

bool          doorOpen     = false;
unsigned long doorOpenedAt = 0;
extern const unsigned long DOOR_OPEN_MS = 3000;

bool relayState[4] = {false, false, false, false};

void setupActuator() {
  pinMode(BUZZER,  OUTPUT);
  pinMode(RELAY_1, OUTPUT);
  pinMode(RELAY_2, OUTPUT);

  digitalWrite(RELAY_1, LOW);
  digitalWrite(RELAY_2, LOW);
  relayState[1] = false;
  relayState[3] = false;

  // Timer 2 & 3 — tránh xung đột với WiFi/BT stack chiếm Timer 0 & 1
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  doorServo.setPeriodHertz(50); // Servo tiêu chuẩn 50Hz
  doorServo.write(90); // Ban đầu: 90° (Cửa đóng) - Thiết lập trước để tránh giật/mở cửa khi reset
  doorServo.attach(SERVO_PIN, 500, 2400);
  
  Serial.println("Actuator module ready");
}

// Gọi mỗi vòng loop() — tự đóng cửa sau DOOR_OPEN_MS không blocking
void updateDoor() {
  if (doorOpen && millis() - doorOpenedAt >= DOOR_OPEN_MS) {
    closeDoor();
  }
}

void openDoor() {
  Serial.println("Door: Opening... (Servo -> 0 deg)");
  doorServo.write(0); // 0° = mở cửa
  doorOpen     = true;
  doorOpenedAt = millis();
}

void closeDoor() {
  Serial.println("Door: Closing... (Servo -> 90 deg)");
  doorServo.write(90); // 90° = đóng cửa
  doorOpen = false;
}

// Dùng chung — TV3 gọi khi nhận lệnh từ Firebase
void setRelay(int ch, bool on) {
  int pins[] = {0, RELAY_1, 0, RELAY_2};
  if (ch != 1 && ch != 3) return;
  if (relayState[ch] == on) return;
  digitalWrite(pins[ch], on ? HIGH : LOW);
  relayState[ch] = on;
  Serial.println("Relay " + String(ch) + ": " + (on ? "ON" : "OFF"));
}

// ── BUZZER STATE MACHINE (non-blocking) ───────────────────────
static struct {
  bool          active     = false;
  int           beepsDone  = 0;
  int           beepsTotal = 0;
  bool          high       = false;
  unsigned long nextToggle = 0;
} _buz;

void alertBuzzer(int beeps) {
  _buz.active     = true;
  _buz.beepsDone  = 0;
  _buz.beepsTotal = beeps;
  _buz.high       = false;
  _buz.nextToggle = millis();
}

void stopBuzzer() {
  _buz.active     = false;
  _buz.high       = false;
  digitalWrite(BUZZER, LOW);
}

// Gọi mỗi vòng loop() — xử lý toggle không blocking
void updateBuzzer() {
  if (!_buz.active) return;

  unsigned long now = millis();
  if (now < _buz.nextToggle) return;

  if (!_buz.high) {
    digitalWrite(BUZZER, HIGH);
    _buz.high       = true;
    _buz.nextToggle = now + 200;
  } else {
    digitalWrite(BUZZER, LOW);
    _buz.high       = false;
    _buz.beepsDone++;
    _buz.nextToggle = now + 200;
    if (_buz.beepsDone >= _buz.beepsTotal) {
      _buz.active = false;
    }
  }
}

// ── SMART LIGHTING AUTOMATION ────────────────────────────────────
extern bool currentPIRState;
extern int  currentHour;
extern int  currentLightLevel;

#define LDR_DARK_THRESHOLD 2000

void updateSmartLighting() {
  static unsigned long lastMotionTime = 0;
  static bool autoLightOn = false;
  unsigned long now = millis();

  if (currentHour < 0) {
    return;
  }

  if (currentPIRState) {
    lastMotionTime = now;
  }

  // Nếu chưa từng có chuyển động từ lúc bật máy, bỏ qua
  if (lastMotionTime == 0 && !currentPIRState) {
    return;
  }

  unsigned long timeSinceLastMotion = now - lastMotionTime;
  bool shouldBeOn = false;
  unsigned long timeoutMs = 0;

  bool isEvening = (currentHour >= 18 && currentHour < 22);
  bool isSleep   = (currentHour >= 22 || currentHour < 6);
  bool isDay     = (currentHour >= 6  && currentHour < 18);

  if (isEvening) {
    timeoutMs = 15UL * 60UL * 1000UL; // 15 phút
    if (timeSinceLastMotion < timeoutMs) shouldBeOn = true;
  } 
  else if (isSleep) {
    timeoutMs = 3UL * 60UL * 1000UL; // 3 phút
    if (timeSinceLastMotion < timeoutMs) shouldBeOn = true;
  } 
  else if (isDay) {
    timeoutMs = 15UL * 60UL * 1000UL; // Dùng 15 phút cho ban ngày để tránh chớp nháy
    bool isDark = (currentLightLevel > LDR_DARK_THRESHOLD);
    if (isDark && (timeSinceLastMotion < timeoutMs)) shouldBeOn = true;
  }

  // Điều khiển Relay 1 (Kênh đèn chính)
  if (shouldBeOn && !autoLightOn) {
    setRelay(1, true);
    autoLightOn = true;
    Serial.println("SmartLighting: Auto Turn ON CH1");
  } else if (!shouldBeOn && autoLightOn) {
    setRelay(1, false);
    autoLightOn = false;
    Serial.println("SmartLighting: Auto Turn OFF CH1");
  }
}

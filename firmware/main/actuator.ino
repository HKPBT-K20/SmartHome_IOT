// Phú: Relay, Còi, Servo cửa
#include <ESP32Servo.h>

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
#define       DOOR_OPEN_MS 3000

void setupActuator() {
  pinMode(BUZZER,  OUTPUT);
  pinMode(RELAY_1, OUTPUT);
  pinMode(RELAY_2, OUTPUT);

  // Mặc định ban đầu: Tắt Relay (LOW)
  digitalWrite(RELAY_1, LOW);
  digitalWrite(RELAY_2, LOW);

  // Cấp phát Timer phần cứng ESP32 cho PWM của Servo
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  doorServo.setPeriodHertz(50); // Servo tiêu chuẩn 50Hz
  doorServo.attach(SERVO_PIN, 500, 2400);
  doorServo.write(90); // Ban đầu: 90° (Cửa đóng)
  
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
  int pins[] = {0, RELAY_1, RELAY_2};
  if (ch < 1 || ch > 2) return;
  // Đã sửa logic: on = true -> HIGH (bật đèn), on = false -> LOW (tắt đèn)
  digitalWrite(pins[ch], on ? HIGH : LOW);
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

// Gọi để kích hoạt còi — trả về ngay, không block
void alertBuzzer(int beeps = 3) {
  _buz.active     = true;
  _buz.beepsDone  = 0;
  _buz.beepsTotal = beeps;
  _buz.high       = false;
  _buz.nextToggle = millis();
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
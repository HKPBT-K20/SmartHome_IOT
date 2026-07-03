// Phú: Relay, Còi, Servo cửa
#include <ESP32Servo.h>

// ── PIN DEFINITIONS ───────────────────────────────────────────
// SERVO: GPIO 26 (tránh GPIO 25 bị Keypad Col4 dùng)
// BUZZER: GPIO 14
// RELAY: CH1=32, CH2=33
// Lưu ý: relay kích mức THẤP → HIGH = tắt, LOW = bật
#define SERVO_PIN  26
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

  digitalWrite(RELAY_1, HIGH);
  digitalWrite(RELAY_2, HIGH);

  // ESP32Servo cần setPeriodHertz trước attach
  doorServo.setPeriodHertz(50);
  doorServo.attach(SERVO_PIN, 500, 2400);
  doorServo.write(90); // 90° = cửa đóng (0° = cửa mở)
  Serial.println("Actuator module ready");
}

// Gọi mỗi vòng loop() — tự đóng cửa sau DOOR_OPEN_MS không blocking
void updateDoor() {
  if (doorOpen && millis() - doorOpenedAt >= DOOR_OPEN_MS) {
    closeDoor();
  }
}

void openDoor() {
  if (doorOpen) return;
  Serial.println("Door: Opening...");
  doorServo.write(0); // 0° = mở cửa
  doorOpen     = true;
  doorOpenedAt = millis();
}

void closeDoor() {
  Serial.println("Door: Closed");
  doorServo.write(90); // 90° = đóng cửa
  doorOpen = false;
}

// Dùng chung — TV3 gọi khi nhận lệnh từ Firebase
void setRelay(int ch, bool on) {
  int pins[] = {0, RELAY_1, RELAY_2};
  if (ch < 1 || ch > 2) return;
  digitalWrite(pins[ch], on ? LOW : HIGH);
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
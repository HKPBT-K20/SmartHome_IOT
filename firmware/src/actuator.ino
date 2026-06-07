// Phú: Relay, Còi
#include <ESP32Servo.h>

#define SERVO_PIN 25
#define BUZZER    12  // đổi từ 33 sang 12 — tránh xung đột RELAY_3
#define RELAY_1   26
#define RELAY_2   32
#define RELAY_3   33  // giờ không còn trùng BUZZER
#define RELAY_4   14

Servo doorServo;

// millis() tracking cho openDoor non-blocking
bool     doorOpen     = false;
unsigned long doorOpenedAt = 0;
#define  DOOR_OPEN_MS  3000

void setupActuator() {
  pinMode(BUZZER,  OUTPUT);
  pinMode(RELAY_1, OUTPUT);
  pinMode(RELAY_2, OUTPUT);
  pinMode(RELAY_3, OUTPUT);
  pinMode(RELAY_4, OUTPUT);

  digitalWrite(RELAY_1, HIGH);
  digitalWrite(RELAY_2, HIGH);
  digitalWrite(RELAY_3, HIGH);
  digitalWrite(RELAY_4, HIGH);

  doorServo.attach(SERVO_PIN);
  doorServo.write(0);
  Serial.println("Actuator module ready");
}

// Gọi trong loop() — tự đóng cửa sau 3 giây không blocking
void updateDoor() {
  if (doorOpen && millis() - doorOpenedAt >= DOOR_OPEN_MS) {
    doorServo.write(0);
    doorOpen = false;
    Serial.println("Door: Closed");
  }
}

void openDoor() {
  Serial.println("Door: Opening...");
  doorServo.write(90);
  doorOpen      = true;
  doorOpenedAt  = millis();
}

// Dùng chung — TV3 gọi khi nhận lệnh từ Firebase
void setRelay(int ch, bool on) {
  int pins[] = {0, RELAY_1, RELAY_2, RELAY_3, RELAY_4};
  if (ch < 1 || ch > 4) return;
  digitalWrite(pins[ch], on ? LOW : HIGH);
  Serial.println("Relay " + String(ch) + ": " + (on ? "ON" : "OFF"));
}

void alertBuzzer() {
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER, HIGH); delay(200);
    digitalWrite(BUZZER, LOW);  delay(200);
  }
}
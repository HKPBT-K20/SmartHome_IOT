// Phú: Relay, Còi
#include <ESP32Servo.h>

#define SERVO_PIN 25
#define BUZZER    33
#define RELAY_1   26
#define RELAY_2   32
#define RELAY_3   33
#define RELAY_4   14

Servo doorServo;

void setupActuator() {
  pinMode(BUZZER,  OUTPUT);
  pinMode(RELAY_1, OUTPUT);
  pinMode(RELAY_2, OUTPUT);
  pinMode(RELAY_3, OUTPUT);
  pinMode(RELAY_4, OUTPUT);

  // Tắt tất cả relay mặc định (relay kích mức thấp)
  digitalWrite(RELAY_1, HIGH);
  digitalWrite(RELAY_2, HIGH);
  digitalWrite(RELAY_3, HIGH);
  digitalWrite(RELAY_4, HIGH);

  doorServo.attach(SERVO_PIN);
  doorServo.write(0); // đóng cửa mặc định
}

// Hàm dùng chung — Bảo cũng gọi khi nhận lệnh từ Firebase
void setRelay(int ch, bool on) {
  int pins[] = {0, RELAY_1, RELAY_2, RELAY_3, RELAY_4};
  if (ch < 1 || ch > 4) return;
  digitalWrite(pins[ch], on ? LOW : HIGH);
}

void openDoor() {
  Serial.println("Door: Opening...");
  doorServo.write(90); // mở
  delay(3000);         // giữ 3 giây
  doorServo.write(0);  // đóng lại
  Serial.println("Door: Closed");
}

void alertBuzzer() {
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER, HIGH); delay(200);
    digitalWrite(BUZZER, LOW);  delay(200);
  }
}
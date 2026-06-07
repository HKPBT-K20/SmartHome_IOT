#include "types.h"

extern int currentHour; // Khuyên cung cấp từ DS1307

void setup() {
  Serial.begin(115200);
  SPI.begin();
  rfid.PCD_Init();
  setupPIR();
  setupActuator();
}

void loop() {
  checkRFID();
  checkKeypad();
  checkPIR(currentHour); // giờ thật từ Khuyên
}
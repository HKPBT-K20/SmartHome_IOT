#include "types.h"

extern int currentHour; // Khuyên cung cấp từ DS1307

void setup() {
  Serial.begin(115200);
  SPI.begin();
  rfid.PCD_Init();
  setupPIR();
  setupActuator();
  setupSensors();
  setupRTC();
   setupDisplay();
}

void loop() {
  updateTime();
  checkRFID();
  checkKeypad();
  checkPIR(currentHour); // giờ thật từ Khuyên
  updateDoor();
  updateDisplay();
}
// Khuyên: Hiển thị LCD I2C 16x2
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "types.h"

// SDA=GPIO 21, SCL=GPIO 22 (I2C mặc định ESP32, chia bus với DS1307)
#define LCD_SDA     21
#define LCD_SCL     22
#define LCD_ADDRESS 0x27

LiquidCrystal_I2C lcd(LCD_ADDRESS, 16, 2);

void setupDisplay() {
  Wire.begin(LCD_SDA, LCD_SCL);

  lcd.init();
  lcd.backlight();

  lcd.setCursor(0, 0); lcd.print("Smart Home      ");
  lcd.setCursor(0, 1); lcd.print("System Ready    ");
  delay(1000);

  Serial.println("Display module ready");
}

void updateDisplay() {
  static unsigned long lastUpdate = 0;
  if (millis() - lastUpdate < 1000) return;
  lastUpdate = millis();

  char timeBuffer[20];
  getTimeString(timeBuffer);
  float temperature = readTemperature();

  // Ghi đè từng dòng thay vì lcd.clear() để tránh flicker
  lcd.setCursor(0, 0);
  // Hiển thị HH:MM:SS (8 ký tự) + khoảng trắng pad
  for (int i = 0; i < 8; i++) lcd.print(timeBuffer[i]);
  lcd.print("        "); // pad phần còn lại

  lcd.setCursor(0, 1);
  lcd.print("T:");
  lcd.print(temperature, 1);
  lcd.print((char)223); // ký tự °
  lcd.print("C         ");
}
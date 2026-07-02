#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "types.h"

// =====================================================
// LCD Configuration
// =====================================================

#define LCD_ADDRESS 0x27

LiquidCrystal_I2C lcd(LCD_ADDRESS, 16, 2);

// =====================================================
// Initialization
// =====================================================

void setupDisplay() {

  Wire.begin();

  lcd.init();
  lcd.backlight();

  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Smart Home");

  lcd.setCursor(0, 1);
  lcd.print("System Ready");

  delay(1000);

  lcd.clear();

  Serial.println("Display module ready.");
}

// =====================================================
// LCD Update
// =====================================================

void updateDisplay() {

  static unsigned long lastUpdate = 0;

  if (millis() - lastUpdate < 1000)
    return;

  lastUpdate = millis();

  char timeBuffer[20];

  getTimeString(timeBuffer);

  float temperature = readTemperature();

  float humidity = 0.0;

  lcd.clear();

  // First line: HH:MM:SS
  lcd.setCursor(0, 0);

  for (int i = 0; i < 8; i++)
    lcd.print(timeBuffer[i]);

  // Second line: Temperature and humidity
  lcd.setCursor(0, 1);

  lcd.print("T:");
  lcd.print(temperature, 1);
  lcd.print((char)223);
  lcd.print("C ");

  lcd.print("H:");
  lcd.print(humidity, 0);
  lcd.print("%");
}
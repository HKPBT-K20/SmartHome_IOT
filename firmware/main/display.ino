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

  float temperature = readTemperature();
  float humidity = 0.0f;
  bool hasHumidity = readHumidity(humidity);
  int light = readLightLevel();
  extern int readAirQualityPPM();
  int air = readAirQualityPPM();

  char line0[17];
  char tempStr[10];
  extern bool unoOnline;
  if (unoOnline) {
    char tVal[10];
    dtostrf(temperature, 4, 1, tVal);
    snprintf(tempStr, sizeof(tempStr), "%s%c", tVal, 223);
  } else {
    strcpy(tempStr, "ERR ");
  }

  char humStr[10];
  if (hasHumidity) {
    dtostrf(humidity, 4, 1, humStr);
  } else {
    strcpy(humStr, "ERR ");
  }

  snprintf(line0, sizeof(line0), "T:%-5s  H:%-4s%%", tempStr, humStr);

  char line1[17];
  char lightStr[10];
  if (unoOnline) {
    snprintf(lightStr, sizeof(lightStr), "%-4d", light);
  } else {
    strcpy(lightStr, "ERR ");
  }

  char airStr[10];
  snprintf(airStr, sizeof(airStr), "%-4d", air);

  snprintf(line1, sizeof(line1), "L:%-4s    A:%-4s", lightStr, airStr);

  lcd.setCursor(0, 0);
  lcd.print(line0);
  lcd.setCursor(0, 1);
  lcd.print(line1);
}
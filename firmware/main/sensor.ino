#include <Wire.h>
#include <RTClib.h>
#include <DHT.h>
#include "types.h"

// =====================================================
// Pin Definitions
// =====================================================

#define LM35_PIN 34
#define DHT_PIN  26
#define DHT_TYPE  DHT11

RTC_DS1307 rtc;
DHT dht(DHT_PIN, DHT_TYPE);

int currentHour = 0;
int currentLightLevel = 500;
float cachedTemperature = 0.0f;

void setupSensors() {
  analogReadResolution(12);
  dht.begin();

  long sum = 0;
  for (int i = 0; i < 50; i++) {
    sum += analogRead(LM35_PIN);
    delay(1);
  }
  int adcValue = sum / 50;
  float milliVolt = adcValue * (3300.0 / 4095.0);
  cachedTemperature = milliVolt / 10.0;

  Serial.println("Sensor module ready.");
}

void setupRTC() {

#ifdef RTC_ENABLED
  if (!rtc.begin()) {
    Serial.println("WARNING: RTC module not found — running in test mode");
    return; // fallback, không treo hệ thống
  }

  if (!rtc.isrunning()) {
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }

  Serial.println("RTC initialized.");
#else
  Serial.println("RTC: TEST MODE (define RTC_ENABLED to activate)");
#endif
}

void updateTemperatureSensor() {
  static unsigned long lastSampleTime = 0;
  static long sum = 0;
  static int sampleCount = 0;

  unsigned long now = millis();
  if (now - lastSampleTime >= 2) {
    sum += analogRead(LM35_PIN);
    sampleCount++;
    lastSampleTime = now;

    if (sampleCount >= 50) {
      int adcValue = sum / 50;
      float milliVolt = adcValue * (3300.0 / 4095.0);
      cachedTemperature = milliVolt / 10.0;
      sum = 0;
      sampleCount = 0;
    }
  }
}

float readTemperature() {
  return cachedTemperature;
}

int readLightLevel() {
  return currentLightLevel;
}

// =====================================================
// Air Humidity Sensor (DHT11)
// =====================================================

bool readHumidity(float &humidity) {
  float value = dht.readHumidity();
  if (isnan(value) || value < 0.0f || value > 100.0f) {
    return false;
  }

  humidity = value;
  return true;
}

// =====================================================
// Time Update
// =====================================================

void updateTime() {
#ifdef RTC_ENABLED
  DateTime now = rtc.now();
  currentHour = now.hour();
#else
  unsigned long totalSeconds = millis() / 1000;
  currentHour = (totalSeconds / 3600) % 24;
#endif
}

// =====================================================
// Time String
// =====================================================

void getTimeString(char *buffer) {
#ifdef RTC_ENABLED
  DateTime now = rtc.now();
  sprintf(buffer,
          "%02d:%02d:%02d %02d/%02d/%02d",
          now.hour(), now.minute(), now.second(),
          now.day(), now.month(), now.year() % 100);
#else
  unsigned long totalSeconds = millis() / 1000;
  int hours   = (totalSeconds / 3600) % 24;
  int minutes = (totalSeconds / 60) % 60;
  int seconds = totalSeconds % 60;
  sprintf(buffer, "%02d:%02d:%02d 01/07/26", hours, minutes, seconds);
#endif
}

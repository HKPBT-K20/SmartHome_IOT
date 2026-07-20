#include <Wire.h>
#include <DHT.h>
#include "types.h"

// =====================================================
// Pin Definitions
// =====================================================

#define DHT_PIN  27
#define DHT_TYPE  DHT11

DHT dht(DHT_PIN, DHT_TYPE);

int currentHour = 0;
int currentLightLevel = 500;

void setupSensors() {
  analogReadResolution(12);
  dht.begin();
  Serial.println("Sensor module ready.");
}



float readTemperature() {
  float t = dht.readTemperature();
  if (isnan(t)) return -999.0f;
  return t;
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

bool readDHTTemperature(float &tempVal) {
  float value = dht.readTemperature();
  if (isnan(value)) {
    return false;
  }
  tempVal = value;
  return true;
}

// =====================================================
// Time Update
// =====================================================

void updateTime() {
  struct tm t;
  if (getLocalTime(&t) && t.tm_year > 120) {
    currentHour = t.tm_hour;
  } else {
    unsigned long totalSeconds = millis() / 1000;
    currentHour = (totalSeconds / 3600) % 24;
  }
}

// =====================================================
// Time String
// =====================================================

void getTimeString(char *buffer) {
  struct tm t;
  if (getLocalTime(&t) && t.tm_year > 120) {
    sprintf(buffer,
            "%02d:%02d:%02d %02d/%02d/%02d",
            t.tm_hour, t.tm_min, t.tm_sec,
            t.tm_mday, t.tm_mon + 1, t.tm_year % 100);
  } else {
    unsigned long totalSeconds = millis() / 1000;
    int hours   = (totalSeconds / 3600) % 24;
    int minutes = (totalSeconds / 60) % 60;
    int seconds = totalSeconds % 60;
    sprintf(buffer, "%02d:%02d:%02d 01/07/26", hours, minutes, seconds);
  }
}

int readAirQualityPPM() {
  int raw = analogRead(35);
  float voltage = raw * (3.3f / 4095.0f);
  float ppm = (voltage / 3.3f) * 1600.0f;
  if (ppm < 350.0f) ppm = 350.0f;
  if (ppm > 2000.0f) ppm = 2000.0f;
  return (int)ppm;
}

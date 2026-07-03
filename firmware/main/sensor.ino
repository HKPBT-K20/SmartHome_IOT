#include <Wire.h>
#include <RTClib.h>
#include "types.h"

// =====================================================
// Pin Definitions
// =====================================================

#define LM35_PIN 34
#define CDS_PIN  36  // GPIO 36 (VP) — dời từ 35 để nhường cho PIR

RTC_DS1307 rtc;

// Shared with other modules
int currentHour = 0;

// =====================================================
// Initialization
// =====================================================

void setupSensors() {

  analogReadResolution(12);

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

// =====================================================
// Temperature Sensor (LM35)
// =====================================================

float readTemperature() {

  long sum = 0;

  // Average multiple samples to reduce ADC noise
  for (int i = 0; i < 50; i++) {
    sum += analogRead(LM35_PIN);
    delay(1);
  }

  int adcValue = sum / 50;

  float milliVolt = adcValue * (3300.0 / 4095.0);

  // LM35 outputs 10mV per °C
  return milliVolt / 10.0;
}

// =====================================================
// Light Sensor (LDR)
// =====================================================

int readLightLevel() {

  return analogRead(CDS_PIN);
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
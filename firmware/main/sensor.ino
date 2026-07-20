#include <Wire.h>
#include <RTClib.h>
#include <DHT.h>
#include <IRremoteESP8266.h>
#include <IRrecv.h>
#include <IRutils.h>
#include "types.h"

// =====================================================
// Pin Definitions
// =====================================================

#define DHT_PIN  27
#define DHT_TYPE  DHT11
#define IR_REMOTE_PIN 13

RTC_DS1307 rtc;
DHT dht(DHT_PIN, DHT_TYPE);
IRrecv irrecv(IR_REMOTE_PIN);
decode_results irResults;

int currentHour = 0;
int currentLightLevel = 500;

// Một số remote NEC phổ biến: nút 1 và 2.
// Nếu remote của bạn khác mã, xem Serial để lấy raw code rồi đổi ở đây.
static const uint32_t IR_KEY_1_RAW = 0x00FF30CF;
static const uint32_t IR_KEY_2_RAW = 0x00FF18E7;

static void handleIRKey(uint32_t rawValue) {
  extern void setRelay(int ch, bool on);
  extern void pushRelayState(int ch, bool on);
  extern bool relayState[4];

  if (rawValue == IR_KEY_1_RAW) {
    bool nextState = !relayState[3];
    setRelay(3, nextState);
    pushRelayState(3, nextState);
    Serial.printf("IR key 1 -> living room relay CH3 %s\n", nextState ? "ON" : "OFF");
  } else if (rawValue == IR_KEY_2_RAW) {
    bool nextState = !relayState[1];
    setRelay(1, nextState);
    pushRelayState(1, nextState);
    Serial.printf("IR key 2 -> working room relay CH1 %s\n", nextState ? "ON" : "OFF");
  } else {
    Serial.print("IR raw unknown: 0x");
    Serial.println(rawValue, HEX);
  }
}

void setupSensors() {
  analogReadResolution(12);
  dht.begin();
  irrecv.enableIRIn();
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

int readAirQualityPPM() {
  int raw = analogRead(35);
  float voltage = raw * (3.3f / 4095.0f);
  float ppm = (voltage / 3.3f) * 1600.0f;
  if (ppm < 350.0f) ppm = 350.0f;
  if (ppm > 2000.0f) ppm = 2000.0f;
  return (int)ppm;
}

void updateIRRemote() {
  if (!irrecv.decode(&irResults)) {
    return;
  }

  uint32_t rawValue = irResults.value;
  if (rawValue != 0) {
    handleIRKey(rawValue);
  }

  irrecv.resume();
}

#include <Wire.h>
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

#define LIGHT_SENSOR_PIN 34
DHT dht(DHT_PIN, DHT_TYPE);
IRrecv irrecv(IR_REMOTE_PIN);
decode_results irResults;

int currentHour = 0;
int currentLightLevel = 500;
bool timeSynced = false;

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
  }
}

static const uint32_t IR_KEY_1_RAW = 0x00FF30CF;
static const uint32_t IR_KEY_2_RAW = 0x00FF18E7;

static void handleIRRemoteKey(uint32_t rawValue) {
  extern bool relayState[4];
  extern void setRelay(int ch, bool on);
  extern void pushRelayState(int ch, bool on);

  if (rawValue == IR_KEY_1_RAW) {
    bool nextState = !relayState[3];
    setRelay(3, nextState);
    pushRelayState(3, nextState);
    Serial.printf("IR key 1 -> living room relay CH3 %s\n", nextState ? "ON" : "OFF");
    return;
  }

  if (rawValue == IR_KEY_2_RAW) {
    bool nextState = !relayState[1];
    setRelay(1, nextState);
    pushRelayState(1, nextState);
    Serial.printf("IR key 2 -> working room relay CH1 %s\n", nextState ? "ON" : "OFF");
    return;
  }

  Serial.print("IR raw unknown: 0x");
  Serial.println(rawValue, HEX);
}

void setupSensors() {
  analogReadResolution(12);
  dht.begin();
  irrecv.enableIRIn();
    analogReadResolution(12);
    pinMode(LIGHT_SENSOR_PIN, INPUT);
  Serial.println("Sensor module ready.");
}



float readTemperature() {
  float t = dht.readTemperature();
  if (isnan(t)) return -999.0f;
  return t;
}

int readLightLevel() {
  return analogRead(LIGHT_SENSOR_PIN);
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
    timeSynced = true;
  } else {
    currentHour = -1;
    timeSynced = false;
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
  float ppm = 400.0f + (voltage / 3.3f) * 1600.0f;
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
    handleIRRemoteKey(rawValue);
  }

  irrecv.resume();
}

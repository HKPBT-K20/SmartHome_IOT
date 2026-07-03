// Phú: RFID, Keypad, PIR
#include <SPI.h>
#include <MFRC522.h>
#include <Keypad.h>
#include "types.h"

// ── PIR ───────────────────────────────────────────────────────
// Khai báo lên đầu file — #define phải có mặt trước khi setupSecurity() dùng
#define PIR_PIN            13
#define PIR_COOLDOWN_NIGHT 30000    // 30 giây ban đêm
#define PIR_COOLDOWN_DAY   300000   // 5 phút ban ngày

volatile bool pirTriggered = false;
unsigned long lastPIRAlert = 0;

void IRAM_ATTR onPIR() {
  static unsigned long lastISR = 0;
  if (millis() - lastISR > 500) {
    pirTriggered = true;
    lastISR = millis();
  }
}

// ── RFID ──────────────────────────────────────────────────────
// SS=5, RST=3V3 (cắm thẳng nguồn, không dùng GPIO → RST_PIN=-1)
// SCK=18, MOSI=23, MISO=19 (SPI mặc định ESP32)
#define SS_PIN  5
#define RST_PIN -1
MFRC522 rfid(SS_PIN, RST_PIN);

// UID thẻ phải viết đúng hex: chỉ gồm 0-9 và A-F
String validUIDs[] = {"A1B2C3D4", "E5F60718"};
int    uidCount    = sizeof(validUIDs) / sizeof(validUIDs[0]);

// ── KEYPAD ────────────────────────────────────────────────────
// Rows: GPIO 4, 15, 2, 0
// Cols: GPIO 27, 16, 17, 25
// ⚠ GPIO 2 (R3) và GPIO 0 (R4) là strapping pins — không bấm phím lúc cấp nguồn
const byte ROWS = 4, COLS = 4;
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[ROWS] = { 4, 15, 2,  0};
byte colPins[COLS] = {27, 16, 17, 13};
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

String        correctPIN    = "123456";
String        inputPIN      = "";
int           wrongAttempts = 0;
bool          isLocked      = false;
unsigned long lockedUntil   = 0;

// ── ACCESS LOG ────────────────────────────────────────────────
AccessLog lastLog;
bool      newLogAvailable = false;

// ── SETUP ─────────────────────────────────────────────────────
void setupSecurity() {
  SPI.begin();
  rfid.PCD_Init();
  keypad.setDebounceTime(5);
  keypad.setHoldTime(500);

  pinMode(PIR_PIN, INPUT_PULLDOWN);
  attachInterrupt(digitalPinToInterrupt(PIR_PIN), onPIR, RISING);

  Serial.println("Security module ready");
}

// ── RFID ──────────────────────────────────────────────────────
void checkRFID() {
  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial())   return;

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  bool granted = false;
  for (int i = 0; i < uidCount; i++) {
    if (uid == validUIDs[i]) { granted = true; break; }
  }

  Serial.println("RFID: " + uid + " → " + (granted ? "GRANTED" : "DENIED"));

  fillAccessLog("RFID", "RFID", uid.c_str(), granted);

  if (granted) openDoor();
  else         alertBuzzer();

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

// ── HELPER POPULATE LOG ───────────────────────────────────────
void fillAccessLog(const char* authMethod, const char* identityType, const char* identityValue, bool granted) {
  struct tm t;
  if (getLocalTime(&t) && t.tm_year > 120) {
    sprintf(lastLog.displayTime, "%02d/%02d/%04d %02d:%02d:%02d",
            t.tm_mday, t.tm_mon + 1, t.tm_year + 1900,
            t.tm_hour, t.tm_min, t.tm_sec);
    lastLog.createdAt = (uint64_t)mktime(&t) * 1000ULL;
  } else {
    getTimeString(lastLog.displayTime);
    lastLog.createdAt = (uint64_t)time(NULL) * 1000ULL;
    if (lastLog.createdAt < 1000000000000ULL) {
      lastLog.createdAt = 1719990000123ULL; // Fallback timestamp
    }
  }

  strncpy(lastLog.authMethod,    authMethod,    sizeof(lastLog.authMethod) - 1);
  strncpy(lastLog.identityType,  identityType,  sizeof(lastLog.identityType) - 1);
  strncpy(lastLog.identityValue, identityValue, sizeof(lastLog.identityValue) - 1);

  if (granted) {
    strcpy(lastLog.actorId, "user_001");
    strcpy(lastLog.actorName, "Vo Nguyen Thien Phu");
    strcpy(lastLog.result, "Success");
  } else {
    strcpy(lastLog.actorId, "unknown");
    strcpy(lastLog.actorName, "Unknown User");
    strcpy(lastLog.result, "Failed");
  }
  lastLog.granted = granted;
  newLogAvailable = true;
}

// ── KEYPAD ────────────────────────────────────────────────────
void checkKeypad() {
  if (isLocked) {
    if (millis() < lockedUntil) {
      return; // không spam Serial
    } else {
      isLocked      = false;
      wrongAttempts = 0;
      Serial.println("Lockout lifted");
    }
  }

  char key = keypad.getKey();
  if (!key) return;

  if (key == '#') {
    bool granted = (inputPIN == correctPIN);

    if (!granted) {
      wrongAttempts++;
      Serial.println("Wrong PIN (" + String(wrongAttempts) + "/3)");
      if (wrongAttempts >= 3) {
        isLocked    = true;
        lockedUntil = millis() + 30000;
        Serial.println("Too many attempts — locked 30s");

        fillAccessLog("KEYPAD", "PIN", inputPIN.c_str(), false);

        alertBuzzer();
        inputPIN = "";
        return;
      }
    }

    fillAccessLog("KEYPAD", "PIN", inputPIN.c_str(), granted);

    Serial.println("PIN: " + inputPIN + " → " + (granted ? "GRANTED" : "DENIED"));

    if (granted) { wrongAttempts = 0; openDoor(); }
    else         alertBuzzer();

    inputPIN = "";
  }
  else if (key == '*') {
    inputPIN = "";
    Serial.println("PIN cleared");
  }
  else {
    if (inputPIN.length() < 6) {
      inputPIN += key;
      Serial.println("Input: " + String(inputPIN.length()) + "/6 digits");
    } else {
      Serial.println("Max 6 digits — press # to confirm or * to clear");
    }
  }
}


void checkPIR(int currentHour) {
  if (!pirTriggered) return;

  unsigned long now = millis();
  bool isNight = (currentHour >= 22 || currentHour < 6);
  unsigned long cooldown = isNight ? PIR_COOLDOWN_NIGHT : PIR_COOLDOWN_DAY;

  if (now - lastPIRAlert < cooldown) {
    pirTriggered = false;
    return;
  }

  pirTriggered = false;
  lastPIRAlert = now;

  if (isNight) {
    Serial.println("PIR: Intruder detected!");
    alertBuzzer();
  } else {
    Serial.println("PIR: Motion detected (daytime)");
  }
}
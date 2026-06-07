// Phú: RFID, Keypad, Servo, PIR
#include <MFRC522.h>
#include <Keypad.h>
#include "types.h"

// ── RFID ──────────────────────────────────────────
#define SS_PIN  5
#define RST_PIN 27
MFRC522 rfid(SS_PIN, RST_PIN);

String validUIDs[] = {"A1B2C3D4", "E5F6G7H8"};
int uidCount = sizeof(validUIDs) / sizeof(validUIDs[0]);

// ── KEYPAD ────────────────────────────────────────
const byte ROWS = 4, COLS = 4;
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[ROWS] = {12, 15, 2,  0};
byte colPins[COLS] = {22,  16, 17, 21};
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

String correctPIN    = "123456";
String inputPIN      = "";
int    wrongAttempts = 0;
bool   isLocked      = false;
unsigned long lockedUntil = 0;

// ── ACCESS LOG ────────────────────────────────────
AccessLog lastLog;
bool newLogAvailable = false;

// ── RFID ──────────────────────────────────────────
void setupSecurity() {
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("Security module ready");
}

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

  uid.toCharArray(lastLog.uid, 20);
  strcpy(lastLog.method, "RFID");
  strcpy(lastLog.time, "00:00:00 01/01/25");
  lastLog.granted  = granted;
  newLogAvailable  = true;

  if (granted) openDoor();
  else         alertBuzzer();

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

// ── KEYPAD ────────────────────────────────────────
void checkKeypad() {
  // Kiểm tra lockout
  if (isLocked) {
    if (millis() < lockedUntil) {
      Serial.println("LOCKED — wait " + String((lockedUntil - millis()) / 1000) + "s");
      return;
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
        lockedUntil = millis() + 30000; // khóa 30 giây
        Serial.println("Too many attempts — locked 30s");
        alertBuzzer();
        inputPIN = "";
        return;
      }
    }

    strncpy(lastLog.uid, inputPIN.c_str(), 20);
    strcpy(lastLog.method, "KEYPAD");
    strcpy(lastLog.time, "00:00:00 01/01/25");
    lastLog.granted = granted;
    newLogAvailable = true;

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
    // Giới hạn 6 ký tự
    if (inputPIN.length() < 6) {
      inputPIN += key;
      Serial.println("Input: " + String(inputPIN.length()) + "/6 digits");
    } else {
      Serial.println("Max 6 digits — press # to confirm or * to clear");
    }
  }
}

// ── PIR ───────────────────────────────────────────
#define PIR_PIN 13
volatile bool pirTriggered = false;
unsigned long lastPIRAlert = 0;
#define PIR_COOLDOWN 30000 // 30 giây

void IRAM_ATTR onPIR() {
  pirTriggered = true;
}

void setupPIR() {
  pinMode(PIR_PIN, INPUT);
  attachInterrupt(digitalPinToInterrupt(PIR_PIN), onPIR, RISING);
}

void checkPIR(int currentHour) {
  if (!pirTriggered) return;
  pirTriggered = false;

  // Cooldown 30 giây
  if (millis() - lastPIRAlert < PIR_COOLDOWN) {
    Serial.println("PIR: cooldown active, skipping");
    return;
  }

  if (currentHour >= 22 || currentHour < 6) {
    Serial.println("PIR: Intruder detected!");
    alertBuzzer();
    lastPIRAlert = millis();
  }
}
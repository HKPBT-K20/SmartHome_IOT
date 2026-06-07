// Phú: RFID, Keypad, Servo, PIR
#include <MFRC522.h>
#include <Keypad.h>
#include "types.h"

// ── RFID ──────────────────────────────────────────
#define SS_PIN  5
#define RST_PIN 27
MFRC522 rfid(SS_PIN, RST_PIN);

// Danh sách thẻ hợp lệ — thêm UID thẻ thật vào đây
String validUIDs[] = {"A1B2C3D4", "E5F6G7H8"};
int uidCount = 2;

// ── KEYPAD ────────────────────────────────────────
const byte ROWS = 4, COLS = 4;
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[ROWS] = {12, 15, 2,  0};
byte colPins[COLS] = {4,  16, 17, 5};
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

String correctPIN = "1234";
String inputPIN   = "";

// ── ACCESS LOG ────────────────────────────────────
AccessLog lastLog; // Bảo đọc cái này để push lên Firebase
bool newLogAvailable = false;

// ── RFID CHECK ────────────────────────────────────
void checkRFID() {
  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial())   return;

  // Đọc UID
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  // Kiểm tra whitelist
  bool granted = false;
  for (int i = 0; i < uidCount; i++) {
    if (uid == validUIDs[i]) { granted = true; break; }
  }

  // Ghi log
  uid.toCharArray(lastLog.uid, 20);
  strcpy(lastLog.method, "RFID");
  strcpy(lastLog.time, "00:00:00 01/01/25"); // TV1 sẽ cung cấp giờ thật sau
  lastLog.granted = granted;
  newLogAvailable = true;

  if (granted) openDoor();
  else         alertBuzzer();

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

// ── KEYPAD CHECK ──────────────────────────────────
void checkKeypad() {
  char key = keypad.getKey();
  if (!key) return;

  if (key == '#') {
    // Nhấn # để xác nhận
    bool granted = (inputPIN == correctPIN);

    strncpy(lastLog.uid, inputPIN.c_str(), 20);
    strcpy(lastLog.method, "KEYPAD");
    strcpy(lastLog.time, "00:00:00 01/01/25");
    lastLog.granted = granted;
    newLogAvailable = true;

    if (granted) openDoor();
    else         alertBuzzer();

    inputPIN = ""; // reset sau khi xác nhận
  }
  else if (key == '*') {
    // Nhấn * để xóa
    inputPIN = "";
    Serial.println("PIN cleared");
  }
  else {
    inputPIN += key;
    Serial.println("Input: " + inputPIN);
  }
}

// ── PIR CHECK ─────────────────────────────────────
#define PIR_PIN 13
volatile bool pirTriggered = false;

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

  // Chỉ cảnh báo ban đêm 22:00 – 06:00
  if (currentHour >= 22 || currentHour < 6) {
    Serial.println("PIR: Intruder detected!");
    alertBuzzer();
    // Bảo sẽ thêm push notification Firebase ở đây sau
  }
}
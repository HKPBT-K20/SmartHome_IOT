// Phú: RFID, Keypad, PIR
#include <SPI.h>
#include <MFRC522.h>
#include <Keypad.h>
#include "types.h"

// ── PIR ───────────────────────────────────────────────────────
// Khai báo lên đầu file — #define phải có mặt trước khi setupSecurity() dùng
#define PIR_PIN            35
#define PIR_CONFIRM_MS     200      // Giữ HIGH liên tục 200ms mới xác nhận
#define PIR_COOLDOWN_NIGHT 30000    // 30 giây ban đêm
#define PIR_COOLDOWN_DAY   300000   // 5 phút ban ngày
#define PIR_ACTIVE_MS      5000     // Giữ trạng thái web trong 5 giây

char securityMode[16] = "always";
unsigned long lastPIRAlert = 0;
bool motionDetected = false;
unsigned long motionDetectedUntil = 0;
void pushSecurityMotion(bool detected);

// ── RFID ──────────────────────────────────────────────────────
// SS=5, RST=3V3 | SCK=18, MOSI=19, MISO=23 (đã hoán đổi so với default ESP32)
#define SS_PIN  5
#define RST_PIN -1  // RST cắm thẳng vào 3V3, soft reset qua SPI
MFRC522 rfid(SS_PIN, RST_PIN);

// UID thẻ phải viết đúng hex: chỉ gồm 0-9 và A-F
String validUIDs[] = {"4362F506"};
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
  SPI.begin(18, 23, 19, SS_PIN);  // MOSI=19, MISO=23 (dây thực tế bị hoán đổi)
  rfid.PCD_Init();
  delay(50);

  // Clone FM17522 (0x82) không tự bật TX trong PCD_Init() — phải force-enable
  byte txCtrl = rfid.PCD_ReadRegister(MFRC522::TxControlReg);
  if ((txCtrl & 0x03) != 0x03) {
    rfid.PCD_WriteRegister(MFRC522::TxControlReg, txCtrl | 0x03);
  }
  rfid.PCD_SetAntennaGain(rfid.RxGain_max);

  byte ver = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  if (ver == 0x00 || ver == 0xFF) {
    Serial.println("ERROR: RFID RC522 not detected — check SPI wiring (SCK=18, MOSI=23, MISO=19, SS=5)");
  } else {
    Serial.print("RFID RC522 detected, firmware version: 0x");
    Serial.println(ver, HEX);  // 0x91 hoặc 0x92 là bình thường
  }

  keypad.setDebounceTime(5);
  keypad.setHoldTime(500);

  pinMode(PIR_PIN, INPUT);  // GPIO 35: input-only, không có internal PD — PIR HC-SR501 tự drive output

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
  unsigned long now = millis();
  static unsigned long candidateStart = 0;
  static bool confirmedForCurrentHigh = false;
  bool pirHigh = (digitalRead(PIR_PIN) == HIGH);

  if (motionDetected && now >= motionDetectedUntil) {
    motionDetected = false;
    pushSecurityMotion(false);
  }

  if (!pirHigh) {
    candidateStart = 0;
    confirmedForCurrentHigh = false;
    return;
  }

  if (strcmp(securityMode, "disabled") == 0) {
    candidateStart = 0;
    confirmedForCurrentHigh = false;
    return;
  }

  bool isNight = (currentHour >= 22 || currentHour < 6);
  bool modeAllowsMotion = (strcmp(securityMode, "always") == 0) ||
                          (strcmp(securityMode, "night_only") == 0 && isNight);
  unsigned long cooldown = isNight ? PIR_COOLDOWN_NIGHT : PIR_COOLDOWN_DAY;

  if (!modeAllowsMotion) {
    candidateStart = 0;
    confirmedForCurrentHigh = false;
    return;
  }

  if (candidateStart == 0) {
    candidateStart = now;
    return;
  }

  if (confirmedForCurrentHigh) {
    return;
  }

  if (now - candidateStart < PIR_CONFIRM_MS) {
    return;
  }

  confirmedForCurrentHigh = true;
  candidateStart = 0;

  if (now - lastPIRAlert < cooldown) {
    return;
  }

  lastPIRAlert = now;
  motionDetected = true;
  motionDetectedUntil = now + PIR_ACTIVE_MS;
  pushSecurityMotion(true);

  Serial.println(isNight ? "PIR: Intruder detected!" : "PIR: Motion detected (daytime)");
  alertBuzzer();
}

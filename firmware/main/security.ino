#include <SPI.h>
#include <MFRC522.h>
#include "types.h"

#define PIR_COOLDOWN_NIGHT 30000
#define PIR_COOLDOWN_DAY   300000
#define PIR_ACTIVE_MS      5000

char securityMode[16] = "always";
unsigned long lastPIRAlert = 0;
bool motionDetected = false;
unsigned long motionDetectedUntil = 0;
void pushSecurityMotion(bool detected);
void pushUnoOnlineStatus(bool online);

#define SS_PIN  5
#define RST_PIN -1
MFRC522 rfid(SS_PIN, RST_PIN);

String validUIDs[] = {"4362F506"};
int    uidCount    = sizeof(validUIDs) / sizeof(validUIDs[0]);

String        correctPIN    = "123456";
String        inputPIN      = "";
int           wrongAttempts = 0;
bool          isLocked      = false;
unsigned long lockedUntil   = 0;

AccessLog lastLog;
bool      newLogAvailable = false;

bool currentPIRState = false;
unsigned long lastUnoMessageTime = 0;
bool unoOnline = true;

void setupSecurity() {
  SPI.begin(18, 23, 19, SS_PIN);
  rfid.PCD_Init();
  delay(50);

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
    Serial.println(ver, HEX);
  }

  lastUnoMessageTime = millis();
  Serial.println("Security module ready");
}

// ── RFID ──────────────────────────────────────────────────────
void checkRFID() {
  extern const unsigned long DOOR_OPEN_MS;
  static unsigned long lastRFIDTime = 0;
  if (millis() - lastRFIDTime < DOOR_OPEN_MS) {
    return;
  }

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

  lastRFIDTime = millis();
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

void checkKeypad() {
  if (isLocked && millis() >= lockedUntil) {
    isLocked      = false;
    wrongAttempts = 0;
    Serial.println("Lockout lifted");
  }
}

void processKey(char key) {
  if (isLocked) {
    if (millis() < lockedUntil) {
      return;
    } else {
      isLocked      = false;
      wrongAttempts = 0;
      Serial.println("Lockout lifted");
    }
  }

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

  static unsigned long lastPIRPrint = 0;
  if (now - lastPIRPrint >= 1000) {
    Serial.printf("[PIR Monitor] State: %d, Mode: %s\n", currentPIRState, securityMode);
    lastPIRPrint = now;
  }

  if (motionDetected && now >= motionDetectedUntil) {
    motionDetected = false;
    stopBuzzer(); // Tắt còi ngay lập tức để không bị delay do mạng
    pushSecurityMotion(false);
    extern void pushSecurityAlarm(bool active);
    pushSecurityAlarm(false);
  }

  if (strcmp(securityMode, "disabled") == 0) {
    return;
  }

  bool isNight = (currentHour >= 22 || currentHour < 6);
  bool modeAllowsMotion = (strcmp(securityMode, "always") == 0) ||
                          (strcmp(securityMode, "night_only") == 0 && isNight);
  unsigned long cooldown = isNight ? PIR_COOLDOWN_NIGHT : PIR_COOLDOWN_DAY;

  if (!modeAllowsMotion) {
    return;
  }

  if (!currentPIRState) {
    return;
  }

  if (lastPIRAlert != 0 && now - lastPIRAlert < cooldown) {
    return;
  }

  lastPIRAlert = now;
  motionDetected = true;
  motionDetectedUntil = now + PIR_ACTIVE_MS;
  
  alertBuzzer(9999); // Bật còi ngay lập tức để không bị trễ do kết nối Firebase

  pushSecurityMotion(true);
  extern void pushSecurityAlarm(bool active);
  pushSecurityAlarm(true);

  Serial.println(isNight ? "PIR: Intruder detected!" : "PIR: Motion detected (daytime)");
}

void handleUnoCommunication() {
  static String inputBuffer = "";
  while (Serial2.available() > 0) {
    char c = Serial2.read();
    if (c == '\n') {
      inputBuffer.trim();
      if (inputBuffer.length() > 0) {
        lastUnoMessageTime = millis();
        if (!unoOnline) {
          unoOnline = true;
          pushUnoOnlineStatus(true);
        }

        if (inputBuffer.startsWith("KEY:")) {
          if (inputBuffer.length() > 4) {
            processKey(inputBuffer.charAt(4));
          }
        } else if (inputBuffer.startsWith("PIR:")) {
          if (inputBuffer.length() > 4) {
            currentPIRState = (inputBuffer.charAt(4) == '1');
          }
        } else if (inputBuffer.startsWith("LDR:")) {
          if (inputBuffer.length() > 4) {
            extern int currentLightLevel;
            currentLightLevel = inputBuffer.substring(4).toInt();
          }
        } else if (inputBuffer.startsWith("TEMP:")) {
          if (inputBuffer.length() > 5) {
            extern float cachedTemperature;
            cachedTemperature = inputBuffer.substring(5).toFloat();
          }
        }
      }
      inputBuffer = "";
    } else if (c != '\r') {
      inputBuffer += c;
      if (inputBuffer.length() >= 64) {
        inputBuffer = "";
      }
    }
  }

  if (unoOnline && (millis() - lastUnoMessageTime > 5000)) {
    unoOnline = false;
    Serial.println("ERROR: Uno hardware extension connection lost! Resetting security status.");
    currentPIRState = false;
    extern int currentLightLevel;
    currentLightLevel = 500;
    extern float cachedTemperature;
    cachedTemperature = 25.0f;
    pushUnoOnlineStatus(false);
  }
}

#include <Keypad.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <EEPROM.h>

#define PIN_LENGTH 6

String correctPIN = "123456";
String passwordInput = "";

int wrongAttempts = 0;

bool isLocked = false;

unsigned long lockedUntil = 0;

const byte ROWS = 4;
const byte COLS = 4;
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[ROWS] = {2, 3, 4, 5};
byte colPins[COLS] = {6, 7, 8, 9};
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

// LCD cửa dùng I2C: SDA=A4, SCL=A5
// Địa chỉ phổ biến: 0x27 hoặc 0x3F
#define DOOR_LCD_ADDRESS 0x27
LiquidCrystal_I2C doorLcd(DOOR_LCD_ADDRESS, 16, 2);

static String lcdLine1 = "";
static String lcdLine2 = "";

static void renderDoorLcd() {
  String line1 = lcdLine1;
  String line2 = lcdLine2;

  if (line1.length() > 16) {
    line1 = line1.substring(0, 16);
  }
  if (line2.length() > 16) {
    line2 = line2.substring(0, 16);
  }

  while (line1.length() < 16) {
    line1 += " ";
  }
  while (line2.length() < 16) {
    line2 += " ";
  }

  doorLcd.setCursor(0, 0);
  doorLcd.print(line1);
  doorLcd.setCursor(0, 1);
  doorLcd.print(line2);
}

void printLine1(String input) {
  lcdLine1 = input;
  renderDoorLcd();
}

void printLine2(String line2) {
  lcdLine2 = line2;
  renderDoorLcd();
}

void appendChar(char keypadInput) {
  passwordInput += keypadInput;
  printLine2(passwordInput);
}

void verifyPIN() {

    if (passwordInput == correctPIN) {

      Serial.println("ACCESS_GRANTED");

      printLine1("Access Granted");
      printLine2("");

      wrongAttempts = 0;
    }
    else {

      wrongAttempts++;

      Serial.println("ACCESS_DENIED");

      printLine1("Wrong PIN");
      printLine2("");

      if (wrongAttempts >= 3) {

        isLocked = true;
        lockedUntil = millis() + 30000;

        printLine1("Locked 30 sec");
      }
    }

    passwordInput = "";
  }

void resetPasswordInput() {
  passwordInput = "";
  printLine2(passwordInput);
}

  void loadPassword() {

    char buf[PIN_LENGTH + 1];

    for (int i = 0; i < PIN_LENGTH; i++) {
      buf[i] = EEPROM.read(i);
    }

    buf[PIN_LENGTH] = '\0';

    bool empty = true;

    for (int i = 0; i < PIN_LENGTH; i++) {
      if (buf[i] != 0xFF) {
        empty = false;
        break;
      }
    }

    if (empty) {

      correctPIN = "123456";

      for (int i = 0; i < PIN_LENGTH; i++) {
        EEPROM.write(i, correctPIN[i]);
      }

    } else {

      correctPIN = String(buf);

    }
  }

void savePassword(String newPIN) {

  correctPIN = newPIN;

  for(int i=0;i<PIN_LENGTH;i++) {
    EEPROM.write(i,newPIN[i]);
  }
}

void clear() {
  resetPasswordInput();
}

void setup() {

  loadPassword();
  Serial.begin(9600);
  pinMode(10, INPUT);

  doorLcd.init();
  doorLcd.backlight();
  printLine1("Door Ready");
  printLine2("");

  doorLcd.init();
  doorLcd.backlight();
  printLine1("Door Ready");
  printLine2("");
}

void loop() {
  char key = keypad.getKey();
  if (key) {

    if (isLocked) {

      if (millis() < lockedUntil) {
        return;
      }

      isLocked = false;
      wrongAttempts = 0;
    }

    if (key == '#') {

      verifyPIN();
    }
    else if (key == '*') {

      resetPasswordInput();
    }
    else {

      appendChar(key);
    }
  }

  unsigned long now = millis();
  bool pinState = (digitalRead(10) == HIGH);
  static unsigned long pirCandidateStart = 0;
  static bool confirmedState = false;
  static bool lastSentPIR = false;

  if (pinState) {
    if (pirCandidateStart == 0) {
      pirCandidateStart = now;
    } else if (!confirmedState && (now - pirCandidateStart >= 200)) {
      confirmedState = true;
    }
  } else {
    pirCandidateStart = 0;
    confirmedState = false;
  }

  static unsigned long lastSentPIRTime = 0;
  if (confirmedState != lastSentPIR || (now - lastSentPIRTime >= 5000)) {
    lastSentPIR = confirmedState;
    lastSentPIRTime = now;
    Serial.print("PIR:");
    Serial.println(lastSentPIR ? "1" : "0");
  }

  static unsigned long lastSentLDRTime = 0;
  if (now - lastSentLDRTime >= 5000) {
    lastSentLDRTime = now;
    int raw = analogRead(A0);
    int currentVal = raw * 4;
    Serial.print("LDR:");
    Serial.println(currentVal);
  }


  static unsigned long lastSentTempTime = 0;
  if (now - lastSentTempTime >= 5000) {
    lastSentTempTime = now;
    long sum = 0;
    for (int i = 0; i < 50; i++) {
      sum += analogRead(A1);
      delay(1);
    }
    float raw = sum / 50.0;
    float mv = raw * (5000.0 / 1023.0);
    float temp = mv / 10.0;
    Serial.print("TEMP:");
    Serial.println(temp, 1);
  }


}

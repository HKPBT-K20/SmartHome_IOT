#include <Keypad.h>
#include <SoftwareSerial.h>

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

SoftwareSerial mySerial(11, 12);

void setup() {
  mySerial.begin(9600);
  pinMode(10, INPUT);
}

void loop() {
  char key = keypad.getKey();
  if (key) {
    mySerial.print("KEY:");
    mySerial.println(key);
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

  if (confirmedState != lastSentPIR) {
    lastSentPIR = confirmedState;
    mySerial.print("PIR:");
    mySerial.println(lastSentPIR ? "1" : "0");
  }

  static unsigned long lastSentTime = 0;
  static int lastSentLDR = -999;
  int raw = analogRead(A0);
  int currentVal = raw * 4;

  if (abs(currentVal - lastSentLDR) >= 50 || (now - lastSentTime >= 5000)) {
    lastSentLDR = currentVal;
    lastSentTime = now;
    mySerial.print("LDR:");
    mySerial.println(currentVal);
  }
}

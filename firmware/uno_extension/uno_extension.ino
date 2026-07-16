#include <Keypad.h>

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

void setup() {
  Serial.begin(9600);
  pinMode(10, INPUT);
}

void loop() {
  char key = keypad.getKey();
  if (key) {
    Serial.print("KEY:");
    Serial.println(key);
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

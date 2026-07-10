// ── RFID RC522 TEST SKETCH ────────────────────────────────────
// Upload sketch này riêng lẻ để chẩn đoán RC522 mà không cần
// WiFi, Firebase hay bất kỳ module nào khác.
//
// Wiring cần kiểm tra:
//   RC522 SDA  → ESP32 GPIO 5
//   RC522 SCK  → ESP32 GPIO 18
//   RC522 MOSI → ESP32 GPIO 23 (default) hoặc 19 (nếu dây ngược)
//   RC522 MISO → ESP32 GPIO 19 (default) hoặc 23 (nếu dây ngược)
//   RC522 RST  → 3V3 (hoặc GPIO tự do)
//   RC522 GND  → GND (phải thông mạch với GND ESP32!)
//   RC522 3V3  → 3V3 (KHÔNG cắm 5V)
// ─────────────────────────────────────────────────────────────

#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN  5
#define RST_PIN -1

// ── Thử lần lượt 2 cấu hình SPI ──────────────────────────────
// Đổi SPI_CONFIG = 1 hoặc 2, upload lại mỗi lần đổi
#define SPI_CONFIG 2
// CONFIG 1: MOSI=23, MISO=19 (default ESP32)
// CONFIG 2: MOSI=19, MISO=23 (nếu dây bị cắm ngược)

MFRC522 rfid(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== RFID RC522 TEST ===");

#if SPI_CONFIG == 1
  Serial.println("SPI Config 1: MOSI=23, MISO=19 (default)");
  SPI.begin(18, 19, 23, SS_PIN);
#else
  Serial.println("SPI Config 2: MOSI=19, MISO=23 (swapped)");
  SPI.begin(18, 23, 19, SS_PIN);
#endif

  rfid.PCD_Init();
  delay(100);

  byte ver = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print("VersionReg raw value: 0x");
  Serial.println(ver, HEX);

  if (ver == 0x00) {
    Serial.println("RESULT: FAIL -- doc duoc 0x00 (MISO stuck LOW hoac GND ho)");
  } else if (ver == 0xFF) {
    Serial.println("RESULT: FAIL -- doc duoc 0xFF (MISO floating hoac SPI sai pin)");
  } else {
    if (ver == 0x91) Serial.println("RESULT: OK -- RC522 chinh hang v1.0");
    else if (ver == 0x92) Serial.println("RESULT: OK -- RC522 chinh hang v2.0");
    else if (ver == 0x82) Serial.println("RESULT: OK -- RC522 clone (FM17522) detected");
    else { Serial.print("RESULT: OK -- clone version 0x"); Serial.println(ver, HEX); }

    rfid.PCD_SetAntennaGain(rfid.RxGain_max);

    // Kiểm tra và force-bật antenna TX (clone có thể không tự bật)
    byte txCtrl = rfid.PCD_ReadRegister(MFRC522::TxControlReg);
    Serial.print("TxControlReg before: 0x");
    Serial.println(txCtrl, HEX);

    if ((txCtrl & 0x03) != 0x03) {
      Serial.println("Antenna TX chua bat! Dang force-enable...");
      rfid.PCD_WriteRegister(MFRC522::TxControlReg, txCtrl | 0x03);
    }

    txCtrl = rfid.PCD_ReadRegister(MFRC522::TxControlReg);
    Serial.print("TxControlReg after: 0x");
    Serial.print(txCtrl, HEX);
    Serial.println(" (can la 0x83)");

    Serial.println("Dua the vao sat module de doc UID...");
    Serial.println("The MIFARE trang tang kem la dung loai, dung cach ~1-2cm");
  }

  Serial.println("------------------------------------");
}

void loop() {
  // Heartbeat mỗi 2 giây — xác nhận loop đang chạy
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint >= 2000) {
    lastPrint = millis();
    bool present = rfid.PICC_IsNewCardPresent();
    Serial.print("Waiting... PICC_IsNewCardPresent=");
    Serial.println(present ? "TRUE" : "false");
  }

  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial())   return;

  Serial.print("Card UID: ");
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      Serial.print("0");
      uid += "0";
    }
    Serial.print(rfid.uid.uidByte[i], HEX);
    uid += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) Serial.print(":");
  }
  uid.toUpperCase();
  Serial.println();
  Serial.print("UID uppercase (copy vao validUIDs): ");
  Serial.println(uid);

  MFRC522::PICC_Type piccType = rfid.PICC_GetType(rfid.uid.sak);
  Serial.print("Card type: ");
  Serial.println(rfid.PICC_GetTypeName(piccType));
  Serial.println("------------------------------------");

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

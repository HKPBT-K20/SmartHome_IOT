#ifndef TYPES_H
#define TYPES_H

struct SensorData {
  float temperature; // Nhiệt độ (°C) từ LM35
  int   lightLevel;  // Mức độ ánh sáng từ quang trở (0–4095)
  char  time[20];    // "HH:MM:SS DD/MM/YY"
};

struct AccessLog {
  char uid[20];     // UID thẻ RFID hoặc mã PIN
  char method[10];  // "RFID" hoặc "KEYPAD"
  char time[20];    // "HH:MM:SS DD/MM/YY"
  bool granted;     // true = mở cửa, false = từ chối
};



#endif // TYPES_H
#ifndef TYPES_H
#define TYPES_H

struct SensorData {
  float temperature; // Nhiệt độ
  int   lightLevel;   // Mức độ ánh sáng
  char  time[20];     // "HH:MM:SS DD/MM/YY"
};

struct AccessLog {
  char uid[20];       // UID của thẻ hoặc mã
  char method[10];    // "RFID" hoặc "KEYPAD"
  char time[20];      // Thời gian mở cửa
  bool granted;       // Cho phép mở cửa hay không
};

#endif // TYPES_H

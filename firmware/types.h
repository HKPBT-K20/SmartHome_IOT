#ifndef TYPES_H
#define TYPES_H

#endif // TYPES_H

struct SensorData {
  float temperature; // Nhiệt độ
  int   lightLevel;  // Mức độ ánh sáng
  char  time[20];    // "HH:MM:SS DD/MM/YY" Thời gian
};

struct AccessLog {
  char uid[20];     // uid của thẻ hoặc mã
  char method[10];  // "RFID" hoặc "KEYPAD" 
                    //cách thức người dùng mở cửa, dùng thẻ hay nhập mật mã
  char time[20];    // thời gian mở cửa
  bool granted;     // cho phép mở cửa hay không
};
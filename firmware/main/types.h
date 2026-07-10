#ifndef TYPES_H
#define TYPES_H

#include <Arduino.h>

struct SensorData {
  float temperature; // Nhiệt độ (°C) từ LM35
  int   lightLevel;  // Mức độ ánh sáng từ quang trở (0–4095)
  char  time[20];    // "HH:MM:SS DD/MM/YY"
};

struct AccessLog {
  uint64_t createdAt;         // Timestamp (ms)
  char     displayTime[32];   // "03/07/2026 14:12:01"
  char     authMethod[16];    // "KEYPAD" hoặc "RFID"
  char     identityType[16];  // "PIN" hoặc "RFID"
  char     identityValue[32]; // Mã PIN hoặc UID thẻ
  char     actorId[32];       // "user_001" hoặc "unknown"
  char     actorName[64];     // "Vo Nguyen Thien Phu" hoặc "Unknown User"
  char     result[16];        // "Success" hoặc "Failed"
  bool     granted;           // true hoặc false
};

struct RelayScheduleConfig {
  char onTime[6];
  char offTime[6];
  bool enabled;
  bool valid;
};

#endif // TYPES_H
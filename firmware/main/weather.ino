// Bảo: Fetch API thời tiết OpenWeatherMap
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"
#include "types.h"

WeatherData currentWeather;

// Kết nối WiFi không blocking — gọi trong setup(), timeout 10 giây
bool setupWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > 10000) {
      Serial.println("\nWiFi timeout — offline mode");
      return false;
    }
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected: " + WiFi.localIP().toString());
  return true;
}

void fetchWeather() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = "http://api.openweathermap.org/data/2.5/weather?id="
               + String(CITY_ID)
               + "&appid=" + String(WEATHER_KEY)
               + "&units=metric&lang=vi";

  http.begin(url);
  http.setTimeout(5000);
  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();

    StaticJsonDocument<2048> doc;
    DeserializationError err = deserializeJson(doc, payload);

    if (!err) {
      currentWeather.temperature = doc["main"]["temp"].as<float>();
      const char* desc = doc["weather"][0]["description"];
      if (desc) strncpy(currentWeather.weatherDesc, desc, sizeof(currentWeather.weatherDesc) - 1);
      currentWeather.weatherDesc[sizeof(currentWeather.weatherDesc) - 1] = '\0';
      Serial.println("Weather: " + String(currentWeather.temperature) + "°C, " + currentWeather.weatherDesc);
    } else {
      Serial.println("Weather JSON parse error: " + String(err.c_str()));
    }
  } else {
    Serial.println("Weather HTTP error: " + String(httpCode));
  }

  http.end();
}

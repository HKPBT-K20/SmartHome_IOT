#include <WiFi.h>
#include <WiFiClientSecure.h>

const char* ssid = "PAULLAP 2551";
const char* pass = "12345678";

void setup() {
  Serial.begin(115200);
  delay(1000);

  WiFi.begin(ssid, pass);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected: " + WiFi.localIP().toString());

  WiFiClientSecure client;
  client.setInsecure();  // bỏ qua cert — chỉ để test TCP+TLS handshake thuần

  Serial.println("Connecting TLS to www.google.com:443 ...");
  if (client.connect("www.google.com", 443)) {
    Serial.println("TLS connected OK!");
    client.println("GET / HTTP/1.1");
    client.println("Host: www.google.com");
    client.println("Connection: close");
    client.println();
    delay(1000);
    while (client.available()) {
      Serial.write(client.read());
    }
  } else {
    Serial.println("TLS connect FAILED");
  }
  client.stop();
}

void loop() {}
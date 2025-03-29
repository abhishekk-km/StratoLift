#include <Wire.h>
#include <SPI.h>
#include <LoRa.h>
#include <Adafruit_BMP280.h>

// **Pin Definitions**
#define TRIG_PIN 3
#define ECHO_PIN 4
#define LED_PIN 7
#define LORA_NSS 10
#define LORA_RST 9
#define LORA_DIO0 2

#define MAX_SAFE_WIND 13.8  
#define MAX_CRITICAL_WIND 20.0 
#define MAX_SAFE_RADIUS 40.0  

Adafruit_BMP280 bmp;
float groundLevelAltitude = 0.0;

void setup() {
    Serial.begin(115200);
    delay(1000); // Small delay to stabilize serial

    // **LED Setup**
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    Serial.println("\n🚀 Starting LoRa Transmitter...");

    // **BMP280 Sensor Initialization**
    if (!bmp.begin(0x76)) {
        Serial.println("⚠ BMP280 Not Found! Check wiring.");
        while (1);
    } else {
        Serial.println("✅ BMP280 Initialized.");
    }

    groundLevelAltitude = bmp.readAltitude(1013.25);  

    // **LoRa Module Initialization**
    Serial.println("🔄 Initializing LoRa...");
    SPI.begin();
    LoRa.setPins(LORA_NSS, LORA_RST, LORA_DIO0);
    if (!LoRa.begin(433E6)) {
        Serial.println("❌ LoRa Init Failed! Check connections.");
        while (1);
    }
    Serial.println("✅ LoRa Ready to Transmit!");
}

void loop() {
    digitalWrite(LED_PIN, HIGH);  // LED ON when transmitting

    // **Read Sensor Data**
    float liftingRadius = getUltrasonicDistance();
    float currentAltitude = bmp.readAltitude(1013.25);
    float craneHeight = max(30.0, (currentAltitude - groundLevelAltitude) * 10.0);  
    float windSpeed = estimateWindSpeed(craneHeight);
    float temperature = bmp.readTemperature();

    // **Constrain Values to Safe Limits**
    liftingRadius = constrain(liftingRadius, 0.0, MAX_SAFE_RADIUS);
    craneHeight = constrain(craneHeight, 30.0, 50.0);
    windSpeed = constrain(windSpeed, 3.0, MAX_CRITICAL_WIND);

    // **Format Data Packet**
    String message = "Lifting Radius = " + String(liftingRadius, 2) + " m, " +
                     "Crane Height = " + String(craneHeight, 2) + " m, " +
                     "Wind Speed = " + String(windSpeed, 2) + " m/s, " +
                     "Temperature = " + String(temperature, 2) + " C";

    // **Debugging Output**
    Serial.println("🔄 Preparing Transmission...");
    Serial.println("🚀 Transmitting Data: " + message);

    // **Send Data via LoRa**
    LoRa.beginPacket();
    LoRa.print(message);
    LoRa.endPacket();

    Serial.println("✅ Transmission Sent!");
    Serial.println("--------------------------");

    digitalWrite(LED_PIN, LOW);  // LED OFF after transmitting
    delay(3000);  // **Ensures perfect 3-second sync**
}

// **Function to Read Ultrasonic Distance**
float getUltrasonicDistance() {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    long duration = pulseIn(ECHO_PIN, HIGH, 30000);
    float distance = duration * 0.0343 / 2;

    // **Check for Invalid Readings**
    if (duration == 0 || distance > 50 || distance < 2) {
        Serial.println("⚠ Ultrasonic Error: Invalid Distance");
        return 0.0;
    }

    Serial.print("📏 Measured Distance: ");
    Serial.print(distance);
    Serial.println(" m");
    return distance;
}

// **Function to Simulate Wind Speed**
float estimateWindSpeed(float craneHeight) {
    float baseWind = (craneHeight / 5.0);  
    float randomFluctuation = (random(-5, 5) / 10.0);  
    float windSpeed = max(3.0, baseWind + randomFluctuation);

    Serial.print("💨 Estimated Wind Speed: ");
    Serial.print(windSpeed);
    Serial.println(" m/s");

    return windSpeed;
}



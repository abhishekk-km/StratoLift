#include <Wire.h> 
#include <SPI.h>
#include <LoRa.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// **OLED Display Config**
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// **LoRa SX1278 Pin Definitions**
#define SS 5
#define RST 22  
#define DIO0 4  

// **Buzzer & RGB LED Pins**
#define BUZZER 13  
#define RED_PIN 25
#define GREEN_PIN 26
#define BLUE_PIN 27  

void setup() {
    Serial.begin(115200);
    while (!Serial);

    // **OLED Setup**
    Wire.begin(21, 15);
    if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
        Serial.println("⚠ OLED Not Found!");
        while (1);
    }

    // **Buzzer & RGB Setup**
    pinMode(BUZZER, OUTPUT);
    pinMode(RED_PIN, OUTPUT);
    pinMode(GREEN_PIN, OUTPUT);
    pinMode(BLUE_PIN, OUTPUT);
    digitalWrite(BUZZER, LOW);
    resetRGB();

    // **Welcome Message**
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(WHITE);
    display.setCursor(10, 10);
    display.println("📡 Crane Safety System");
    display.setCursor(15, 30);
    display.println("🚀 Welcome to Stratolift!");
    display.display();
    delay(2000);  

    // **LoRa Setup**
    Serial.println("Initializing LoRa...");
    SPI.begin(18, 19, 23, SS);
    LoRa.setPins(SS, RST, DIO0);

    if (!LoRa.begin(433E6)) {
        Serial.println("⚠ LoRa Init Failed!");
        while (1);
    }

    Serial.println("✅ LoRa Ready!");
}

void loop() {
    int packetSize = LoRa.parsePacket();
    
    if (packetSize) {
        display.clearDisplay();

        // **Receive Data**
        String receivedData = "";
        while (LoRa.available()) {
            char incomingChar = LoRa.read();
            if (isPrintable(incomingChar)) {  
                receivedData += incomingChar;
            }
        }

        Serial.println("📡 Received Data: " + receivedData);

        // **Extract Parameters**
        float liftingRadius, craneHeight, windSpeed, temperature;
        sscanf(receivedData.c_str(), "Lifting Radius = %f m, Crane Height = %f m, Wind Speed = %f m/s, Temperature = %f C",
               &liftingRadius, &craneHeight, &windSpeed, &temperature);

        // **Calculate Safety Rating (Out of 10)**
        int safetyRating = 10 - (liftingRadius / 3);  // Rating decreases with lifting radius
        if (safetyRating < 1) safetyRating = 1;       // Minimum safety rating = 1 (Critical)

        // **Trigger Buzzer & RGB based on Critical Values**
        bool criticalCondition = (liftingRadius > 10 || windSpeed > 15 || safetyRating == 1);

        if (criticalCondition) {
            triggerBuzzer();
            blinkRedLED();
        } else if (temperature < 5 || temperature > 40) {
            setRGB(255, 165, 0);  // 🟠 Orange (Temperature Alert)
        } else {
            setRGB(0, 255, 0);  // 🟢 Green (Safe)
            digitalWrite(BUZZER, LOW);
        }

        // **Display Data on OLED with Formatting**
        display.setCursor(0, 5);
        display.setTextSize(1);
        display.setTextColor(WHITE);
        display.println("📡 Crane Monitoring");

        display.setCursor(0, 20);
        display.print("Lifting Radius: "); display.print(liftingRadius, 1); display.println("m");
        display.setCursor(0, 30);
        display.print("Crane Height:   "); display.print(craneHeight, 1); display.println("m");
        display.setCursor(0, 40);
        display.print("Wind Speed:     "); display.print(windSpeed, 1); display.println("m/s");
        display.setCursor(0, 50);
        display.print("Temperature:    "); display.print(temperature, 1); display.println("C");

        // **Show Safety Rating**
        display.setCursor(0, 60);
        display.print("Safety Rating:  "); display.print(safetyRating); display.println("/10");

        // **Flashing "CRITICAL" Warning**
        if (criticalCondition) {
            for (int i = 0; i < 3; i++) {
                display.clearDisplay();
                display.setTextSize(2);
                display.setCursor(20, 25);
                display.setTextColor(WHITE);
                display.println("⚠ CRITICAL");
                display.display();
                delay(400);
                display.clearDisplay();
                display.display();
                delay(400);
            }
        }

        display.display();
        delay(1500);  // **Reduced Delay from 3000ms to 1500ms**
    }
}

// **Trigger Buzzer (Beep 3 times for 2 seconds)**
void triggerBuzzer() {
    for (int i = 0; i < 3; i++) {
        digitalWrite(BUZZER, HIGH);
        delay(300);
        digitalWrite(BUZZER, LOW);
        delay(300);
    }
}

// **Blink Red LED (for Danger Alert)**
void blinkRedLED() {
    for (int i = 0; i < 3; i++) {
        setRGB(255, 0, 0);  // 🔴 Red
        delay(300);
        resetRGB();
        delay(300);
    }
}

// **Set RGB Color**
void setRGB(int r, int g, int b) {
    analogWrite(RED_PIN, r);
    analogWrite(GREEN_PIN, g);
    analogWrite(BLUE_PIN, b);
}

// **Reset RGB to OFF**
void resetRGB() {
    analogWrite(RED_PIN, 0);
    analogWrite(GREEN_PIN, 0);
    analogWrite(BLUE_PIN, 0);
}






/*
 * ==============================================================================
 * NeuroGlove — ESP32 Sensor Transmitter Firmware
 * ==============================================================================
 * 
 * Hardware Requirements:
 * - ESP32 Development Board (e.g. ESP32-WROOM-32 / DevKit v1)
 * - MPU6050 (6-axis IMU Accelerometer + Gyroscope)
 * - FSR402 Pressure Sensor (Force Sensitive Resistor for grip)
 * - 2x Flex Sensors (for finger bend measurement)
 * - 3x 10k Ohm Resistors (voltage dividers for analog sensors)
 * 
 * Wiring Pinout:
 * - MPU6050:
 *     VCC -> 3.3V
 *     GND -> GND
 *     SDA -> GPIO 21
 *     SCL -> GPIO 22
 * 
 * - FSR Sensor (Thumb/Palm Grip):
 *     One pin to 3.3V, other pin to GPIO 34 (with 10k resistor to GND)
 * 
 * - Flex Sensor 1 (Index Finger):
 *     One pin to 3.3V, other pin to GPIO 35 (with 10k resistor to GND)
 * 
 * - Flex Sensor 2 (Middle Finger):
 *     One pin to 3.3V, other pin to GPIO 32 (with 10k resistor to GND)
 * 
 * Serial Baud Rate: 115200
 * ==============================================================================
 */

#include <Wire.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// Sensor Pin Definitions
const int PIN_FSR   = 34; // ADC1_CH6
const int PIN_FLEX1 = 35; // ADC1_CH7
const int PIN_FLEX2 = 32; // ADC1_CH4

// MPU6050 I2C Address
const int MPU_ADDR = 0x68;

// BLE UART Service UUIDs (Nordic UART Service)
#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_TX "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

BLEServer *pServer = NULL;
BLECharacteristic *pTxCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// Variables for IMU raw readings
int16_t raw_ax, raw_ay, raw_az;
int16_t raw_temp;
int16_t raw_gx, raw_gy, raw_gz;

// BLE Server Callbacks
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
    }
};

void initMPU6050() {
  Wire.begin(21, 22); // SDA = 21, SCL = 22
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1 register
  Wire.write(0);    // Wake up MPU6050
  Wire.endTransmission(true);
}

void readMPU6050(float &ax, float &ay, float &az, float &gx, float &gy, float &gz) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B); // Starting register for accelerometer data
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 14, true);

  if (Wire.available() >= 14) {
    raw_ax = Wire.read() << 8 | Wire.read();
    raw_ay = Wire.read() << 8 | Wire.read();
    raw_az = Wire.read() << 8 | Wire.read();
    raw_temp = Wire.read() << 8 | Wire.read();
    raw_gx = Wire.read() << 8 | Wire.read();
    raw_gy = Wire.read() << 8 | Wire.read();
    raw_gz = Wire.read() << 8 | Wire.read();

    // Convert accelerometer to m/s^2 (assuming +/- 2g range: 16384 LSB/g)
    ax = (float)raw_ax / 16384.0 * 9.80665;
    ay = (float)raw_ay / 16384.0 * 9.80665;
    az = (float)raw_az / 16384.0 * 9.80665;

    // Convert gyroscope to deg/s (assuming +/- 250 deg/s range: 131 LSB/deg/s)
    gx = (float)raw_gx / 131.0;
    gy = (float)raw_gy / 131.0;
    gz = (float)raw_gz / 131.0;
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Initialize ADC resolution to 12-bit (0-4095)
  analogReadResolution(12);

  // Initialize I2C for MPU6050
  initMPU6050();

  // Initialize BLE
  BLEDevice::init("NeuroGlove_ESP32");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);
  pTxCharacteristic = pService->createCharacteristic(
                        CHARACTERISTIC_UUID_TX,
                        BLECharacteristic::PROPERTY_NOTIFY
                      );
  pTxCharacteristic->addDescriptor(new BLE2902());
  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("{\"status\":\"ESP32 NeuroGlove Ready\"}");
}

void loop() {
  // Read Analog Sensors (FSR and Flex)
  // Scale 12-bit ADC (0-4095) to mV or 0-1023
  int raw_fsr   = analogRead(PIN_FSR);
  int raw_flex1 = analogRead(PIN_FLEX1);
  int raw_flex2 = analogRead(PIN_FLEX2);

  // Normalize FSR to ~0-800 scale for UI
  int fsrReading   = map(raw_fsr, 0, 4095, 0, 800);
  int flexSensor1 = map(raw_flex1, 0, 4095, 0, 90);  // 0 - 90 degrees
  int flexSensor2 = map(raw_flex2, 0, 4095, 0, 90);

  // Read IMU
  float ax = 0.05, ay = 0.02, az = 9.81;
  float gx = 0.5, gy = 0.3, gz = -0.2;
  readMPU6050(ax, ay, az, gx, gy, gz);

  // Format as JSON string
  char jsonBuffer[256];
  snprintf(jsonBuffer, sizeof(jsonBuffer),
    "{\"fsr\":%d,\"flex1\":%d,\"flex2\":%d,\"ax\":%.2f,\"ay\":%.2f,\"az\":%.2f,\"gx\":%.2f,\"gy\":%.2f,\"gz\":%.2f}",
    fsrReading, flexSensor1, flexSensor2, ax, ay, az, gx, gy, gz
  );

  // 1. Output over USB Serial
  Serial.println(jsonBuffer);

  // 2. Output over BLE if connected
  if (deviceConnected) {
    pTxCharacteristic->setValue((uint8_t*)jsonBuffer, strlen(jsonBuffer));
    pTxCharacteristic->notify();
  }

  // Handle BLE disconnect reconnection advertising
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  // Send packet every 50ms (20 Hz sampling rate)
  delay(50);
}

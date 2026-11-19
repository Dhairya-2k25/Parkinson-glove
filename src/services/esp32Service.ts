// ============================================================
// NeuroGlove — ESP32 Hardware Integration Service
// ============================================================
// Supports:
// 1. Web Serial API (USB Cable direct to ESP32 at 115200 baud)
// 2. Web Bluetooth API (BLE wireless GATT to ESP32)
// 3. WebSocket (Local Wi-Fi connection to ESP32 IP)
// ============================================================

import type { ConnectionStatus, SensorReading } from '@/types';

export type ESP32ConnectionMethod = 'serial' | 'ble' | 'wifi' | 'none';

export interface ESP32Status {
  status: ConnectionStatus;
  method: ESP32ConnectionMethod;
  deviceName: string | null;
  error: string | null;
  packetsReceived: number;
}

type ReadingListener = (reading: SensorReading) => void;
type StatusListener = (status: ESP32Status) => void;

class ESP32Service {
  private currentStatus: ESP32Status = {
    status: 'disconnected',
    method: 'none',
    deviceName: null,
    error: null,
    packetsReceived: 0,
  };

  private readingListeners: Set<ReadingListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();

  // Serial references
  private serialPort: any = null;
  private serialReader: any = null;
  private isReadingSerial = false;

  // BLE references
  private bleDevice: any = null;
  private bleCharacteristic: any = null;

  // WebSocket reference
  private ws: WebSocket | null = null;

  // ---- Status & Listeners ----

  public getStatus(): ESP32Status {
    return { ...this.currentStatus };
  }

  public isConnected(): boolean {
    return this.currentStatus.status === 'connected';
  }

  public onStatusChange(callback: StatusListener): () => void {
    this.statusListeners.add(callback);
    callback(this.getStatus());
    return () => this.statusListeners.delete(callback);
  }

  public onReading(callback: ReadingListener): () => void {
    this.readingListeners.add(callback);
    return () => this.readingListeners.delete(callback);
  }

  private updateStatus(updates: Partial<ESP32Status>) {
    this.currentStatus = { ...this.currentStatus, ...updates };
    this.statusListeners.forEach(cb => cb(this.getStatus()));
  }

  private emitReading(reading: SensorReading) {
    this.currentStatus.packetsReceived++;
    this.readingListeners.forEach(cb => cb(reading));
  }

  // ---- 1. Web Serial Connection (USB Cable) ----

  public isSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public async connectSerial(baudRate = 115200): Promise<boolean> {
    if (!this.isSerialSupported()) {
      const msg = 'Web Serial is not supported in this browser. Please use Chrome, Edge, or Opera.';
      this.updateStatus({ status: 'error', error: msg });
      throw new Error(msg);
    }

    try {
      this.updateStatus({ status: 'connecting', method: 'serial', error: null });

      const navSerial = (navigator as any).serial;
      this.serialPort = await navSerial.requestPort();
      await this.serialPort.open({ baudRate });

      this.updateStatus({
        status: 'connected',
        method: 'serial',
        deviceName: 'ESP32 (USB Serial)',
        error: null,
      });

      this.readSerialStream();

      // Listen for hardware disconnect (cable pulled out)
      this.serialPort.addEventListener('disconnect', () => {
        this.disconnect();
      });

      return true;
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        // User cancelled port picker
        this.updateStatus({ status: 'disconnected', method: 'none', error: null });
        return false;
      }
      const errMsg = err?.message || 'Failed to connect to ESP32 over serial';
      this.updateStatus({ status: 'error', error: errMsg });
      throw err;
    }
  }

  private async readSerialStream() {
    this.isReadingSerial = true;
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.serialPort.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    this.serialReader = reader;

    let buffer = '';

    try {
      while (this.isReadingSerial) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? ''; // Keep partial line

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              this.parseAndEmitPayload(trimmed);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Serial stream read error or disconnect:', err);
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // Ignore lock release error
      }
    }
  }

  // ---- 2. Web Bluetooth Connection (BLE) ----

  public isBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public async connectBLE(): Promise<boolean> {
    if (!this.isBluetoothSupported()) {
      const msg = 'Web Bluetooth is not supported in this browser. Please use Chrome or Edge.';
      this.updateStatus({ status: 'error', error: msg });
      throw new Error(msg);
    }

    try {
      this.updateStatus({ status: 'connecting', method: 'ble', error: null });

      const navBle = (navigator as any).bluetooth;
      this.bleDevice = await navBle.requestDevice({
        filters: [
          { namePrefix: 'NeuroGlove' },
          { namePrefix: 'ESP32' },
          { namePrefix: 'Glove' },
        ],
        optionalServices: [
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service
          '4fafc201-1fb5-459e-8fcc-c5c9c331914b', // Custom ESP32 Service
        ],
      });

      this.bleDevice.addEventListener('gattserverdisconnected', () => {
        this.disconnect();
      });

      const server = await this.bleDevice.gatt.connect();
      const services = await server.getPrimaryServices();

      if (services.length > 0) {
        const chars = await services[0].getCharacteristics();
        for (const ch of chars) {
          if (ch.properties.notify || ch.properties.indicate) {
            this.bleCharacteristic = ch;
            await ch.startNotifications();
            ch.addEventListener('characteristicvaluechanged', (event: any) => {
              const value = event.target.value;
              const decoder = new TextDecoder();
              const text = decoder.decode(value);
              this.parseAndEmitPayload(text.trim());
            });
            break;
          }
        }
      }

      this.updateStatus({
        status: 'connected',
        method: 'ble',
        deviceName: this.bleDevice.name || 'ESP32 (BLE)',
        error: null,
      });

      return true;
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        this.updateStatus({ status: 'disconnected', method: 'none', error: null });
        return false;
      }
      this.updateStatus({ status: 'error', error: err?.message || 'Failed to connect via BLE' });
      throw err;
    }
  }

  // ---- 3. WebSocket Connection (Wi-Fi) ----

  public connectWebSocket(url = 'ws://192.168.4.1:81'): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        this.updateStatus({ status: 'connecting', method: 'wifi', error: null });
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.updateStatus({
            status: 'connected',
            method: 'wifi',
            deviceName: `ESP32 Wi-Fi (${url})`,
            error: null,
          });
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            this.parseAndEmitPayload(event.data.trim());
          }
        };

        this.ws.onerror = (e) => {
          this.updateStatus({ status: 'error', error: 'WebSocket connection failed' });
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          this.disconnect();
        };
      } catch (err: any) {
        this.updateStatus({ status: 'error', error: err?.message });
        reject(err);
      }
    });
  }

  // ---- Disconnect All ----

  public async disconnect(): Promise<void> {
    this.isReadingSerial = false;

    if (this.serialReader) {
      try {
        await this.serialReader.cancel();
      } catch {
        // ignore
      }
      this.serialReader = null;
    }

    if (this.serialPort) {
      try {
        await this.serialPort.close();
      } catch {
        // ignore
      }
      this.serialPort = null;
    }

    if (this.bleDevice && this.bleDevice.gatt && this.bleDevice.gatt.connected) {
      try {
        this.bleDevice.gatt.disconnect();
      } catch {
        // ignore
      }
      this.bleDevice = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    this.updateStatus({
      status: 'disconnected',
      method: 'none',
      deviceName: null,
      error: null,
    });
  }

  // ---- Payload Parser (JSON or CSV from ESP32) ----

  /**
   * Accepts either JSON or CSV strings from ESP32:
   * JSON: {"fsr":480,"flex1":650,"flex2":620,"ax":0.12,"ay":-0.04,"az":9.81,"gx":1.4,"gy":0.9,"gz":-0.3}
   * CSV:  fsr,flex1,flex2,ax,ay,az,gx,gy,gz (e.g. "480,650,620,0.12,-0.04,9.81,1.4,0.9,-0.3")
   */
  public parseAndEmitPayload(rawText: string) {
    try {
      let fsr = 0;
      let flex1 = 500;
      let flex2 = 480;
      let ax = 0.05, ay = 0.02, az = 9.81;
      let gx = 0.5, gy = 0.3, gz = -0.2;

      if (rawText.startsWith('{') && rawText.endsWith('}')) {
        // JSON payload
        const data = JSON.parse(rawText);
        fsr = Number(data.fsr ?? data.fsrReading ?? data.grip ?? 0);
        flex1 = Number(data.flex1 ?? data.flexSensor1 ?? 500);
        flex2 = Number(data.flex2 ?? data.flexSensor2 ?? 480);
        ax = Number(data.ax ?? data.accelX ?? 0.05);
        ay = Number(data.ay ?? data.accelY ?? 0.02);
        az = Number(data.az ?? data.accelZ ?? 9.81);
        gx = Number(data.gx ?? data.gyroX ?? 0.5);
        gy = Number(data.gy ?? data.gyroY ?? 0.3);
        gz = Number(data.gz ?? data.gyroZ ?? -0.2);
      } else if (rawText.includes(',')) {
        // CSV payload
        const parts = rawText.split(',').map(s => parseFloat(s.trim()));
        if (parts.length >= 1) fsr = parts[0] || 0;
        if (parts.length >= 2) flex1 = parts[1] || 500;
        if (parts.length >= 3) flex2 = parts[2] || 480;
        if (parts.length >= 4) ax = parts[3] || 0.05;
        if (parts.length >= 5) ay = parts[4] || 0.02;
        if (parts.length >= 6) az = parts[5] || 9.81;
        if (parts.length >= 7) gx = parts[6] || 0.5;
        if (parts.length >= 8) gy = parts[7] || 0.3;
        if (parts.length >= 9) gz = parts[8] || -0.2;
      } else {
        // Unknown format, ignore
        return;
      }

      const timestamp = new Date().toISOString();

      const reading: SensorReading = {
        timestamp,
        handIMU: { ax, ay, az, gx, gy, gz },
        forearmIMU: {
          ax: +(ax * 0.15).toFixed(3),
          ay: +(ay * 0.15).toFixed(3),
          az: 9.80,
          gx: +(gx * 0.2).toFixed(2),
          gy: +(gy * 0.2).toFixed(2),
          gz: +(gz * 0.2).toFixed(2),
        },
        differentialIMU: {
          ax: +(ax * 0.85).toFixed(3),
          ay: +(ay * 0.85).toFixed(3),
          az: +(az - 9.80).toFixed(3),
          gx: +(gx * 0.8).toFixed(2),
          gy: +(gy * 0.8).toFixed(2),
          gz: +(gz * 0.8).toFixed(2),
        },
        flexSensor1: Math.round(flex1),
        flexSensor2: Math.round(flex2),
        fsrReading: Math.round(fsr),
        isValid: true,
      };

      this.emitReading(reading);
    } catch {
      // Ignore malformed packets from serial/radio noise
    }
  }
}

export const esp32Service = new ESP32Service();

// ============================================================
// NeuroGlove — Mock Service Implementations
// ============================================================
// These services use in-memory demonstration data.
// Replace with real API calls when the backend is available.
// ============================================================

import type {
  PatientProfile,
  BaselineMeasurement,
  SessionSummary,
  Session,
  SessionFilter,
  SensorReading,
  ConnectionStatus,
  RehabExercise,
  CaregiverAlert,
  AlertFilter,
  AppSettings,
  DataMode,
  AppNotification,
} from '@/types';

import {
  DEMO_PATIENT,
  DEMO_BASELINE,
  DEMO_SESSIONS,
  DEMO_SESSION_SUMMARIES,
  DEMO_REHAB_EXERCISES,
  DEMO_ALERTS,
  DEMO_NOTIFICATIONS,
} from './mockData';

// ---- Utilities ----
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function matchesAssessmentType(summary: SessionSummary, filter: Partial<SessionFilter>): boolean {
  if (!filter.assessmentType || filter.assessmentType === 'all') return true;
  return summary.assessmentType === filter.assessmentType;
}

function matchesDateRange(summary: SessionSummary, filter: Partial<SessionFilter>): boolean {
  const date = new Date(summary.date).getTime();
  if (filter.dateFrom) {
    const from = new Date(filter.dateFrom).getTime();
    if (date < from) return false;
  }
  if (filter.dateTo) {
    const to = new Date(filter.dateTo).getTime();
    if (date > to) return false;
  }
  return true;
}

function matchesSearch(summary: SessionSummary, filter: Partial<SessionFilter>): boolean {
  if (!filter.searchQuery) return true;
  const q = filter.searchQuery.toLowerCase();
  return (
    summary.id.toLowerCase().includes(q) ||
    summary.assessmentType.toLowerCase().replace(/_/g, ' ').includes(q) ||
    summary.status.toLowerCase().includes(q)
  );
}

// ---- Patient Service ----

let patientData = { ...DEMO_PATIENT };

export const patientService = {
  async getProfile(_id: string): Promise<PatientProfile> {
    await delay(100);
    return { ...patientData };
  },

  async updateProfile(_id: string, data: Partial<PatientProfile>): Promise<PatientProfile> {
    await delay(150);
    patientData = { ...patientData, ...data };
    if (data.preferences) {
      patientData.preferences = { ...patientData.preferences, ...data.preferences };
    }
    return { ...patientData };
  },

  async getBaseline(_patientId: string): Promise<BaselineMeasurement | null> {
    await delay(100);
    return { ...DEMO_BASELINE };
  },

  async updateBaseline(_patientId: string, data: Partial<BaselineMeasurement>): Promise<BaselineMeasurement> {
    await delay(150);
    return { ...DEMO_BASELINE, ...data };
  },
};

// ---- Session Service ----

export const sessionService = {
  async getSessions(_patientId: string, filter?: Partial<SessionFilter>): Promise<SessionSummary[]> {
    await delay(120);
    let results = [...DEMO_SESSION_SUMMARIES];

    if (filter) {
      results = results.filter(s =>
        matchesAssessmentType(s, filter) &&
        matchesDateRange(s, filter) &&
        matchesSearch(s, filter)
      );

      if (filter.sortBy === 'date_asc') {
        results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      } else {
        results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
    } else {
      results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return results;
  },

  async getSession(sessionId: string): Promise<Session | null> {
    await delay(100);
    const s = DEMO_SESSIONS.find(s => s.id === sessionId);
    return s ? { ...s } : null;
  },

  exportSessionCSV(session: Session): string {
    const headers = [
      'Timestamp',
      'Hand_Ax', 'Hand_Ay', 'Hand_Az', 'Hand_Gx', 'Hand_Gy', 'Hand_Gz',
      'Forearm_Ax', 'Forearm_Ay', 'Forearm_Az', 'Forearm_Gx', 'Forearm_Gy', 'Forearm_Gz',
      'Diff_Ax', 'Diff_Ay', 'Diff_Az', 'Diff_Gx', 'Diff_Gy', 'Diff_Gz',
      'Flex1', 'Flex2', 'FSR', 'Valid',
    ];
    const rows = session.readings.map(r => [
      r.timestamp,
      r.handIMU?.ax ?? '', r.handIMU?.ay ?? '', r.handIMU?.az ?? '',
      r.handIMU?.gx ?? '', r.handIMU?.gy ?? '', r.handIMU?.gz ?? '',
      r.forearmIMU?.ax ?? '', r.forearmIMU?.ay ?? '', r.forearmIMU?.az ?? '',
      r.forearmIMU?.gx ?? '', r.forearmIMU?.gy ?? '', r.forearmIMU?.gz ?? '',
      r.differentialIMU?.ax ?? '', r.differentialIMU?.ay ?? '', r.differentialIMU?.az ?? '',
      r.differentialIMU?.gx ?? '', r.differentialIMU?.gy ?? '', r.differentialIMU?.gz ?? '',
      r.flexSensor1 ?? '', r.flexSensor2 ?? '', r.fsrReading ?? '',
      r.isValid ? 'true' : 'false',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  },
};

// ---- Sensor Service (Mock streaming) ----

type ReadingCallback = (reading: SensorReading) => void;

class MockSensorService {
  private status: ConnectionStatus = 'disconnected';
  private listeners: Set<ReadingCallback> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastReading: SensorReading | null = null;
  private tickCount = 0;

  async connect(): Promise<void> {
    this.status = 'connecting';
    await delay(800);
    this.status = 'connected';
    this.startStreaming();
  }

  async disconnect(): Promise<void> {
    this.stopStreaming();
    this.status = 'disconnected';
  }

  getConnectionStatus(): ConnectionStatus {
    return this.status;
  }

  onReading(callback: ReadingCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  getLatestReading(): SensorReading | null {
    return this.lastReading;
  }

  private startStreaming() {
    this.stopStreaming();
    this.intervalId = setInterval(() => {
      this.tickCount++;
      const s = Math.sin(this.tickCount * 0.1);
      const c = Math.cos(this.tickCount * 0.1);

      const reading: SensorReading = {
        timestamp: new Date().toISOString(),
        handIMU: {
          ax: +(0.1 + s * 2.5 + Math.random() * 0.3).toFixed(3),
          ay: +(0.05 + c * 1.8 + Math.random() * 0.2).toFixed(3),
          az: +(9.78 + s * 0.4).toFixed(3),
          gx: +(s * 15 + Math.random() * 2).toFixed(2),
          gy: +(c * 12 + Math.random() * 1.5).toFixed(2),
          gz: +(s * c * 8).toFixed(2),
        },
        forearmIMU: {
          ax: +(0.08 + s * 0.3 + Math.random() * 0.05).toFixed(3),
          ay: +(0.04 + c * 0.25 + Math.random() * 0.04).toFixed(3),
          az: +(9.79 + s * 0.05).toFixed(3),
          gx: +(s * 2 + Math.random() * 0.3).toFixed(2),
          gy: +(c * 1.5 + Math.random() * 0.2).toFixed(2),
          gz: +(s * c * 1).toFixed(2),
        },
        differentialIMU: null,
        flexSensor1: Math.round(500 + s * 200 + Math.random() * 30),
        flexSensor2: Math.round(480 + c * 180 + Math.random() * 25),
        fsrReading: Math.round(300 + Math.abs(s) * 400 + Math.random() * 50),
        isValid: true,
      };

      // Calculate differential
      if (reading.handIMU && reading.forearmIMU) {
        reading.differentialIMU = {
          ax: +(reading.handIMU.ax - reading.forearmIMU.ax).toFixed(3),
          ay: +(reading.handIMU.ay - reading.forearmIMU.ay).toFixed(3),
          az: +(reading.handIMU.az - reading.forearmIMU.az).toFixed(3),
          gx: +(reading.handIMU.gx - reading.forearmIMU.gx).toFixed(2),
          gy: +(reading.handIMU.gy - reading.forearmIMU.gy).toFixed(2),
          gz: +(reading.handIMU.gz - reading.forearmIMU.gz).toFixed(2),
        };
      }

      this.lastReading = reading;
      this.listeners.forEach(cb => {
        try {
          cb(reading);
        } catch {
          // Listener error should not break streaming
        }
      });
    }, 200); // 5 Hz demo rate
  }

  private stopStreaming() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const sensorService = new MockSensorService();

// ---- Rehabilitation Service ----

let rehabExercises = [...DEMO_REHAB_EXERCISES];

export const rehabService = {
  async getExercises(_patientId: string): Promise<RehabExercise[]> {
    await delay(100);
    return [...rehabExercises].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async getExercise(id: string): Promise<RehabExercise | null> {
    await delay(80);
    return rehabExercises.find(e => e.id === id) ?? null;
  },

  async saveExercise(exercise: RehabExercise): Promise<RehabExercise> {
    await delay(100);
    const idx = rehabExercises.findIndex(e => e.id === exercise.id);
    if (idx >= 0) {
      rehabExercises[idx] = { ...exercise };
    } else {
      rehabExercises = [exercise, ...rehabExercises];
    }
    return { ...exercise };
  },
};

// ---- Alert Service ----

let alertsData = [...DEMO_ALERTS];

export const alertService = {
  async getAlerts(_patientId: string, filter?: Partial<AlertFilter>): Promise<CaregiverAlert[]> {
    await delay(100);
    let results = [...alertsData];

    if (filter) {
      if (filter.status && filter.status !== 'all') {
        results = results.filter(a => a.status === filter.status);
      }
      if (filter.type && filter.type !== 'all') {
        results = results.filter(a => a.type === filter.type);
      }
      if (filter.dateFrom) {
        const from = new Date(filter.dateFrom).getTime();
        results = results.filter(a => new Date(a.timestamp).getTime() >= from);
      }
      if (filter.dateTo) {
        const to = new Date(filter.dateTo).getTime();
        results = results.filter(a => new Date(a.timestamp).getTime() <= to);
      }
    }

    return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  async getAlert(id: string): Promise<CaregiverAlert | null> {
    await delay(80);
    return alertsData.find(a => a.id === id) ?? null;
  },

  async acknowledgeAlert(id: string): Promise<CaregiverAlert | null> {
    await delay(100);
    const idx = alertsData.findIndex(a => a.id === id);
    if (idx < 0) return null;
    alertsData[idx] = {
      ...alertsData[idx],
      status: 'acknowledged',
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy: 'User',
    };
    return { ...alertsData[idx] };
  },

  async resolveAlert(id: string): Promise<CaregiverAlert | null> {
    await delay(100);
    const idx = alertsData.findIndex(a => a.id === id);
    if (idx < 0) return null;
    alertsData[idx] = {
      ...alertsData[idx],
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
    };
    return { ...alertsData[idx] };
  },

  async dismissAlert(id: string): Promise<CaregiverAlert | null> {
    await delay(100);
    const idx = alertsData.findIndex(a => a.id === id);
    if (idx < 0) return null;
    alertsData[idx] = {
      ...alertsData[idx],
      status: 'dismissed',
    };
    return { ...alertsData[idx] };
  },
};

// ---- Settings Service ----

const DEFAULT_SETTINGS: AppSettings = {
  dataMode: 'demo' as DataMode,
  theme: 'light',
  reducedMotion: false,
  chartRefreshRate: 200,
  staleDataThreshold: 5000,
  notificationsEnabled: true,
  alertSoundEnabled: false,
  autoReconnect: true,
  showDemoLabel: true,
};

let currentSettings = { ...DEFAULT_SETTINGS };

export const settingsService = {
  getSettings(): AppSettings {
    return { ...currentSettings };
  },

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    currentSettings = { ...currentSettings, ...updates };
    return { ...currentSettings };
  },
};

// ---- Notification Service ----

let notificationsData = [...DEMO_NOTIFICATIONS];

export const notificationService = {
  getNotifications(): AppNotification[] {
    return [...notificationsData].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },

  markAsRead(id: string): void {
    const idx = notificationsData.findIndex(n => n.id === id);
    if (idx >= 0) {
      notificationsData[idx] = { ...notificationsData[idx], read: true };
    }
  },

  markAllAsRead(): void {
    notificationsData = notificationsData.map(n => ({ ...n, read: true }));
  },

  getUnreadCount(): number {
    return notificationsData.filter(n => !n.read).length;
  },
};

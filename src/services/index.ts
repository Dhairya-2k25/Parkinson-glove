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
  private statusListeners: Set<(status: ConnectionStatus, paused: boolean) => void> = new Set();
  private paused = false;

  private notifyStatus() {
    this.statusListeners.forEach(cb => cb(this.status, this.paused));
  }

  onStatusChange(callback: (status: ConnectionStatus, paused: boolean) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status, this.paused);
    return () => this.statusListeners.delete(callback);
  }

  isPaused(): boolean {
    return this.paused;
  }

  async connect(): Promise<void> {
    if (this.status === 'connected' && !this.paused) return;
    if (this.status === 'connecting') return;
    this.status = 'connecting';
    this.notifyStatus();
    await delay(350);
    this.status = 'connected';
    this.paused = false;
    this.startStreaming();
    this.notifyStatus();
  }

  async disconnect(): Promise<void> {
    this.stopStreaming();
    this.paused = false;
    this.status = 'disconnected';
    this.notifyStatus();
  }

  pause(): void {
    if (this.status !== 'connected' || this.paused) return;
    this.paused = true;
    this.stopStreaming();
    this.notifyStatus();
  }

  resume(): void {
    if (this.status !== 'connected' || !this.paused) return;
    this.paused = false;
    this.startStreaming();
    this.notifyStatus();
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
      const time = this.tickCount * 0.04;
      const s = Math.sin(time * 1.15);
      const c = Math.cos(time * 0.87);
      // Synthetic movement profile: low-level motion with irregular short tremor-like bursts.
      // These are illustrative demo signals, not clinical measurements.
      const burstCycle = (time % 9.5);
      const burstEnvelope = burstCycle > 3.0 && burstCycle < 5.1
        ? Math.pow(Math.sin(Math.PI * (burstCycle - 3.0) / 2.1), 2)
        : 0;
      const tremorWave = Math.sin(time * 2 * Math.PI * (4.2 + 0.45 * Math.sin(time * 0.23)));
      const tremor = burstEnvelope * tremorWave;
      const jitter = () => (Math.random() - 0.5);
      const reading: SensorReading = {
        timestamp: new Date().toISOString(),
        handIMU: {
          ax: +(0.1 + s * 1.1 + tremor * 1.7 + jitter() * 0.16).toFixed(3),
          ay: +(0.05 + c * 0.8 + tremor * 1.25 + jitter() * 0.14).toFixed(3),
          az: +(9.78 + s * 0.18 + tremor * 0.35).toFixed(3),
          gx: +(s * 3.8 + tremor * 22 + jitter() * 0.9).toFixed(2),
          gy: +(c * 3.2 + tremor * 17 + jitter() * 0.8).toFixed(2),
          gz: +(s * c * 2.4 + tremor * 12 + jitter() * 0.6).toFixed(2),
        },
        forearmIMU: {
          ax: +(0.08 + s * 0.22 + jitter() * 0.035).toFixed(3),
          ay: +(0.04 + c * 0.18 + jitter() * 0.03).toFixed(3),
          az: +(9.79 + s * 0.035).toFixed(3),
          gx: +(s * 1.5 + jitter() * 0.22).toFixed(2),
          gy: +(c * 1.1 + jitter() * 0.18).toFixed(2),
          gz: +(s * c * 0.7 + jitter() * 0.12).toFixed(2),
        },
        differentialIMU: null,
        flexSensor1: Math.round(500 + s * 105 + burstEnvelope * 45 + jitter() * 16),
        flexSensor2: Math.round(480 + c * 92 + burstEnvelope * 32 + jitter() * 14),
        fsrReading: Math.round(300 + Math.abs(s) * 210 + burstEnvelope * 95 + jitter() * 24),
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
    }, 40); // 25 Hz illustrative stream for a more continuous-looking chart
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

  async createTremorAlert(activity: number, source: 'demo' | 'live' = 'demo'): Promise<CaregiverAlert> {
    const alert: CaregiverAlert = {
      id: `alert-live-${Date.now()}`,
      patientId: 'demo-patient-001',
      type: 'tremor_spike',
      severity: activity >= 18 ? 'high' : 'medium',
      status: 'new',
      title: source === 'demo' ? 'Demo movement activity threshold exceeded' : 'Movement activity threshold exceeded',
      description: `A movement activity estimate of ${activity.toFixed(1)} °/s exceeded the configured demonstration threshold. This is an observational alert, not a diagnosis or a clinically validated tremor measurement.${source === 'demo' ? ' Simulated sensor data was used.' : ''}`,
      timestamp: new Date().toISOString(),
      sessionId: null,
      acknowledgedAt: null,
      resolvedAt: null,
      acknowledgedBy: null,
      isConfirmed: false,
    };
    alertsData = [alert, ...alertsData];
    return { ...alert };
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

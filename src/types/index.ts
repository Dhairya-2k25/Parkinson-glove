// ============================================================
// NeuroGlove — Core Type Definitions
// ============================================================

// ---- Device & Connection ----

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';
export type DataMode = 'live' | 'historical' | 'demo';

export interface DeviceInfo {
  id: string;
  name: string;
  connectionStatus: ConnectionStatus;
  lastSeen: string | null; // ISO timestamp
  firmwareVersion: string | null; // null = unavailable
  batteryLevel: number | null;   // null = unavailable
  signalStrength: number | null; // null = unavailable
}

// ---- Sensor Readings ----

export interface IMUReading {
  ax: number; // acceleration x (m/s²)
  ay: number;
  az: number;
  gx: number; // gyroscope x (°/s)
  gy: number;
  gz: number;
}

export interface SensorReading {
  timestamp: string; // ISO
  handIMU: IMUReading | null;
  forearmIMU: IMUReading | null;
  differentialIMU: IMUReading | null;
  flexSensor1: number | null; // 0-1023 raw ADC
  flexSensor2: number | null;
  fsrReading: number | null;  // 0-1023 raw ADC (FSR402)
  isValid: boolean;
}

export interface LiveMonitoringState {
  isStreaming: boolean;
  isPaused: boolean;
  connectionStatus: ConnectionStatus;
  dataMode: DataMode;
  lastReceived: string | null;
  readings: SensorReading[];
  staleThresholdMs: number;
}

// ---- Patient Profile ----

export interface PatientProfile {
  id: string;
  displayName: string;
  monitoringStartDate: string; // ISO
  notes: string;
  preferences: PatientPreferences;
}

export interface PatientPreferences {
  dominantHand: 'left' | 'right';
  notificationsEnabled: boolean;
  alertSoundEnabled: boolean;
  dataRetentionDays: number;
}

// ---- Baseline ----

export interface BaselineMeasurement {
  id: string;
  patientId: string;
  recordedDate: string; // ISO
  tremorAmplitude: number | null;   // mm
  tremorFrequency: number | null;   // Hz
  gripStrength: number | null;      // raw ADC 0-1023
  flexRange1: number | null;
  flexRange2: number | null;
  assessmentConditions: string;
}

export interface BaselineComparison {
  metric: string;
  unit: string;
  baselineValue: number | null;
  currentValue: number | null;
  absoluteDifference: number | null;
  percentageChange: number | null;
  direction: 'increased' | 'decreased' | 'unchanged' | 'unavailable';
}

// ---- Sessions ----

export type SessionStatus = 'completed' | 'in_progress' | 'incomplete' | 'cancelled';
export type AssessmentType = 'tremor_assessment' | 'grip_assessment' | 'finger_tap' | 'full_assessment' | 'rehabilitation';

export interface Session {
  id: string;
  patientId: string;
  assessmentType: AssessmentType;
  date: string;         // ISO
  duration: number;     // seconds
  status: SessionStatus;
  tremorAmplitude: number | null;
  tremorFrequency: number | null;
  gripStrength: number | null;
  flexData: number[] | null;
  notes: string;
  readings: SensorReading[];
}

export interface SessionSummary {
  id: string;
  assessmentType: AssessmentType;
  date: string;
  duration: number;
  status: SessionStatus;
  tremorAmplitude: number | null;
  tremorFrequency: number | null;
  gripStrength: number | null;
}

export interface SessionFilter {
  searchQuery: string;
  assessmentType: AssessmentType | 'all';
  dateFrom: string;
  dateTo: string;
  sortBy: 'date_asc' | 'date_desc';
}

// ---- Rehabilitation ----

export type RehabPhase = 'idle' | 'pick_up' | 'hold' | 'release' | 'completed';
export type RehabSessionStatus = 'not_started' | 'in_progress' | 'paused' | 'completed' | 'cancelled';

export interface RehabExercise {
  id: string;
  patientId: string;
  date: string;
  status: RehabSessionStatus;
  phases: RehabPhaseRecord[];
  totalDuration: number; // seconds
  gripReadings: number[];
  notes: string;
}

export interface RehabPhaseRecord {
  phase: RehabPhase;
  startTime: string;
  endTime: string | null;
  duration: number; // seconds
  completed: boolean;
}

// ---- Caregiver Alerts ----

export type AlertType = 'failed_grasp' | 'tremor_spike' | 'device_disconnected' | 'missed_session';
export type AlertSeverity = 'low' | 'medium' | 'high';
export type AlertStatus = 'new' | 'acknowledged' | 'resolved' | 'dismissed';

export interface CaregiverAlert {
  id: string;
  patientId: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  timestamp: string;       // ISO
  sessionId: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  acknowledgedBy: string | null;
  isConfirmed: boolean; // false = possible event, true = confirmed
}

export interface AlertFilter {
  status: AlertStatus | 'all';
  type: AlertType | 'all';
  dateFrom: string;
  dateTo: string;
}

// ---- Settings ----

export interface AppSettings {
  dataMode: DataMode;
  theme: 'light' | 'system';
  reducedMotion: boolean;
  chartRefreshRate: number; // ms
  staleDataThreshold: number; // ms
  notificationsEnabled: boolean;
  alertSoundEnabled: boolean;
  autoReconnect: boolean;
  showDemoLabel: boolean;
}

// ---- Dashboard ----

export interface DashboardMetrics {
  latestTremorAmplitude: number | null;
  latestTremorFrequency: number | null;
  latestGripStrength: number | null;
  lastAssessmentDate: string | null;
  connectionStatus: ConnectionStatus;
  totalSessions: number;
  dataMode: DataMode;
}

// ---- Notifications ----

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'warning' | 'error' | 'success';
  link?: string;
}

// ---- API Service Interface ----

export interface PatientService {
  getProfile(id: string): Promise<PatientProfile>;
  updateProfile(id: string, data: Partial<PatientProfile>): Promise<PatientProfile>;
  getBaseline(patientId: string): Promise<BaselineMeasurement | null>;
  updateBaseline(patientId: string, data: Partial<BaselineMeasurement>): Promise<BaselineMeasurement>;
}

export interface SessionService {
  getSessions(patientId: string, filter?: Partial<SessionFilter>): Promise<SessionSummary[]>;
  getSession(sessionId: string): Promise<Session>;
  exportSessionCSV(sessionId: string): Promise<string>;
}

export interface SensorService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionStatus(): ConnectionStatus;
  onReading(callback: (reading: SensorReading) => void): () => void; // returns unsubscribe
  getLatestReading(): SensorReading | null;
}

export interface RehabService {
  getExercises(patientId: string): Promise<RehabExercise[]>;
  getExercise(id: string): Promise<RehabExercise>;
  saveExercise(exercise: RehabExercise): Promise<RehabExercise>;
}

export interface AlertService {
  getAlerts(patientId: string, filter?: Partial<AlertFilter>): Promise<CaregiverAlert[]>;
  getAlert(id: string): Promise<CaregiverAlert>;
  acknowledgeAlert(id: string): Promise<CaregiverAlert>;
  resolveAlert(id: string): Promise<CaregiverAlert>;
  dismissAlert(id: string): Promise<CaregiverAlert>;
}

export interface SettingsService {
  getSettings(): AppSettings;
  updateSettings(settings: Partial<AppSettings>): AppSettings;
}

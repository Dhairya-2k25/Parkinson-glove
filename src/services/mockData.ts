// ============================================================
// NeuroGlove — Demonstration Data
// ============================================================
// ALL DATA BELOW IS SIMULATED FOR DEMONSTRATION PURPOSES ONLY.
// It does NOT represent real patient measurements.
// ============================================================

import type {
  PatientProfile,
  BaselineMeasurement,
  SessionSummary,
  Session,
  SensorReading,
  IMUReading,
  RehabExercise,
  CaregiverAlert,
  AppNotification,
} from '@/types';

// ---- Helper ----
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function hoursAgo(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

// ---- Patient ----
export const DEMO_PATIENT: PatientProfile = {
  id: 'demo-patient-001',
  displayName: 'Demo Participant',
  monitoringStartDate: daysAgo(90),
  notes: 'Demonstration profile — not a real patient.',
  preferences: {
    dominantHand: 'right',
    notificationsEnabled: true,
    alertSoundEnabled: false,
    dataRetentionDays: 365,
  },
};

// ---- Baseline ----
export const DEMO_BASELINE: BaselineMeasurement = {
  id: 'baseline-001',
  patientId: 'demo-patient-001',
  recordedDate: daysAgo(85),
  tremorAmplitude: 2.4,
  tremorFrequency: 5.1,
  gripStrength: 680,
  flexRange1: 720,
  flexRange2: 690,
  assessmentConditions: 'Resting tremor, seated, morning session',
};

// ---- Session helper ----
function makeSensorReading(ts: string, seed: number): SensorReading {
  const s = Math.sin(seed);
  const c = Math.cos(seed);
  const handIMU: IMUReading = {
    ax: +(0.1 + s * 2.5).toFixed(3),
    ay: +(0.05 + c * 1.8).toFixed(3),
    az: +(9.78 + s * 0.4).toFixed(3),
    gx: +(s * 15).toFixed(2),
    gy: +(c * 12).toFixed(2),
    gz: +(s * c * 8).toFixed(2),
  };
  const forearmIMU: IMUReading = {
    ax: +(0.08 + s * 0.3).toFixed(3),
    ay: +(0.04 + c * 0.25).toFixed(3),
    az: +(9.79 + s * 0.05).toFixed(3),
    gx: +(s * 2).toFixed(2),
    gy: +(c * 1.5).toFixed(2),
    gz: +(s * c * 1).toFixed(2),
  };
  const differentialIMU: IMUReading = {
    ax: +(handIMU.ax - forearmIMU.ax).toFixed(3),
    ay: +(handIMU.ay - forearmIMU.ay).toFixed(3),
    az: +(handIMU.az - forearmIMU.az).toFixed(3),
    gx: +(handIMU.gx - forearmIMU.gx).toFixed(2),
    gy: +(handIMU.gy - forearmIMU.gy).toFixed(2),
    gz: +(handIMU.gz - forearmIMU.gz).toFixed(2),
  };
  return {
    timestamp: ts,
    handIMU,
    forearmIMU,
    differentialIMU,
    flexSensor1: Math.round(500 + s * 200),
    flexSensor2: Math.round(480 + c * 180),
    fsrReading: Math.round(300 + Math.abs(s) * 400),
    isValid: true,
  };
}

function makeSessionReadings(baseDate: string, count: number): SensorReading[] {
  const readings: SensorReading[] = [];
  const base = new Date(baseDate).getTime();
  for (let i = 0; i < count; i++) {
    const ts = new Date(base + i * 100).toISOString(); // 100ms intervals
    readings.push(makeSensorReading(ts, i * 0.3));
  }
  return readings;
}

// ---- Sessions ----
export const DEMO_SESSIONS: Session[] = [
  {
    id: 'session-001',
    patientId: 'demo-patient-001',
    assessmentType: 'tremor_assessment',
    date: daysAgo(1),
    duration: 120,
    status: 'completed',
    tremorAmplitude: 2.8,
    tremorFrequency: 5.3,
    gripStrength: 650,
    flexData: [710, 680],
    notes: 'Morning resting tremor assessment',
    readings: makeSessionReadings(daysAgo(1), 50),
  },
  {
    id: 'session-002',
    patientId: 'demo-patient-001',
    assessmentType: 'grip_assessment',
    date: daysAgo(3),
    duration: 90,
    status: 'completed',
    tremorAmplitude: 2.5,
    tremorFrequency: 5.0,
    gripStrength: 670,
    flexData: [700, 675],
    notes: 'Grip strength evaluation',
    readings: makeSessionReadings(daysAgo(3), 40),
  },
  {
    id: 'session-003',
    patientId: 'demo-patient-001',
    assessmentType: 'full_assessment',
    date: daysAgo(7),
    duration: 300,
    status: 'completed',
    tremorAmplitude: 2.6,
    tremorFrequency: 5.2,
    gripStrength: 660,
    flexData: [715, 685],
    notes: 'Weekly full assessment',
    readings: makeSessionReadings(daysAgo(7), 80),
  },
  {
    id: 'session-004',
    patientId: 'demo-patient-001',
    assessmentType: 'tremor_assessment',
    date: daysAgo(10),
    duration: 115,
    status: 'completed',
    tremorAmplitude: 2.3,
    tremorFrequency: 4.9,
    gripStrength: 690,
    flexData: [725, 695],
    notes: '',
    readings: makeSessionReadings(daysAgo(10), 45),
  },
  {
    id: 'session-005',
    patientId: 'demo-patient-001',
    assessmentType: 'finger_tap',
    date: daysAgo(14),
    duration: 60,
    status: 'completed',
    tremorAmplitude: 2.4,
    tremorFrequency: 5.1,
    gripStrength: 680,
    flexData: [718, 688],
    notes: 'Finger tapping speed test',
    readings: makeSessionReadings(daysAgo(14), 30),
  },
  {
    id: 'session-006',
    patientId: 'demo-patient-001',
    assessmentType: 'grip_assessment',
    date: daysAgo(20),
    duration: 85,
    status: 'completed',
    tremorAmplitude: 2.2,
    tremorFrequency: 4.8,
    gripStrength: 700,
    flexData: [730, 700],
    notes: 'Good grip session',
    readings: makeSessionReadings(daysAgo(20), 35),
  },
  {
    id: 'session-007',
    patientId: 'demo-patient-001',
    assessmentType: 'tremor_assessment',
    date: daysAgo(28),
    duration: 110,
    status: 'completed',
    tremorAmplitude: 2.1,
    tremorFrequency: 4.7,
    gripStrength: 710,
    flexData: [735, 705],
    notes: '',
    readings: makeSessionReadings(daysAgo(28), 45),
  },
  {
    id: 'session-008',
    patientId: 'demo-patient-001',
    assessmentType: 'full_assessment',
    date: daysAgo(35),
    duration: 280,
    status: 'completed',
    tremorAmplitude: 2.0,
    tremorFrequency: 4.6,
    gripStrength: 720,
    flexData: [740, 710],
    notes: 'Monthly comprehensive assessment',
    readings: makeSessionReadings(daysAgo(35), 75),
  },
  {
    id: 'session-009',
    patientId: 'demo-patient-001',
    assessmentType: 'tremor_assessment',
    date: daysAgo(45),
    duration: 100,
    status: 'incomplete',
    tremorAmplitude: null,
    tremorFrequency: null,
    gripStrength: null,
    flexData: null,
    notes: 'Session interrupted due to device disconnect',
    readings: makeSessionReadings(daysAgo(45), 15),
  },
  {
    id: 'session-010',
    patientId: 'demo-patient-001',
    assessmentType: 'rehabilitation',
    date: daysAgo(2),
    duration: 180,
    status: 'completed',
    tremorAmplitude: null,
    tremorFrequency: null,
    gripStrength: 640,
    flexData: [700, 670],
    notes: 'Rehabilitation exercise session',
    readings: makeSessionReadings(daysAgo(2), 60),
  },
  {
    id: 'session-011',
    patientId: 'demo-patient-001',
    assessmentType: 'tremor_assessment',
    date: daysAgo(55),
    duration: 120,
    status: 'completed',
    tremorAmplitude: 1.9,
    tremorFrequency: 4.5,
    gripStrength: 730,
    flexData: [745, 715],
    notes: '',
    readings: makeSessionReadings(daysAgo(55), 50),
  },
  {
    id: 'session-012',
    patientId: 'demo-patient-001',
    assessmentType: 'grip_assessment',
    date: daysAgo(60),
    duration: 80,
    status: 'completed',
    tremorAmplitude: 2.0,
    tremorFrequency: 4.7,
    gripStrength: 725,
    flexData: [738, 708],
    notes: '',
    readings: makeSessionReadings(daysAgo(60), 35),
  },
];

export const DEMO_SESSION_SUMMARIES: SessionSummary[] = DEMO_SESSIONS.map(s => ({
  id: s.id,
  assessmentType: s.assessmentType,
  date: s.date,
  duration: s.duration,
  status: s.status,
  tremorAmplitude: s.tremorAmplitude,
  tremorFrequency: s.tremorFrequency,
  gripStrength: s.gripStrength,
}));

// ---- Rehabilitation exercises ----
export const DEMO_REHAB_EXERCISES: RehabExercise[] = [
  {
    id: 'rehab-001',
    patientId: 'demo-patient-001',
    date: daysAgo(2),
    status: 'completed',
    phases: [
      { phase: 'pick_up', startTime: daysAgo(2), endTime: daysAgo(2), duration: 8, completed: true },
      { phase: 'hold', startTime: daysAgo(2), endTime: daysAgo(2), duration: 15, completed: true },
      { phase: 'release', startTime: daysAgo(2), endTime: daysAgo(2), duration: 5, completed: true },
    ],
    totalDuration: 28,
    gripReadings: [320, 450, 580, 620, 600, 580, 400, 200, 50],
    notes: '',
  },
  {
    id: 'rehab-002',
    patientId: 'demo-patient-001',
    date: daysAgo(5),
    status: 'completed',
    phases: [
      { phase: 'pick_up', startTime: daysAgo(5), endTime: daysAgo(5), duration: 10, completed: true },
      { phase: 'hold', startTime: daysAgo(5), endTime: daysAgo(5), duration: 12, completed: true },
      { phase: 'release', startTime: daysAgo(5), endTime: daysAgo(5), duration: 6, completed: true },
    ],
    totalDuration: 28,
    gripReadings: [280, 420, 550, 590, 570, 540, 380, 180, 30],
    notes: 'Good control during hold phase',
  },
];

// ---- Alerts ----
export const DEMO_ALERTS: CaregiverAlert[] = [
  {
    id: 'alert-001',
    patientId: 'demo-patient-001',
    type: 'failed_grasp',
    severity: 'high',
    status: 'new',
    title: 'Possible failed grasp detected',
    description: 'FSR and flex sensor readings suggest the participant may have been unable to maintain grip during a rehabilitation exercise. This is a possible event and has not been confirmed.',
    timestamp: hoursAgo(3),
    sessionId: 'session-010',
    acknowledgedAt: null,
    resolvedAt: null,
    acknowledgedBy: null,
    isConfirmed: false,
  },
  {
    id: 'alert-002',
    patientId: 'demo-patient-001',
    type: 'tremor_spike',
    severity: 'medium',
    status: 'acknowledged',
    title: 'Elevated tremor amplitude recorded',
    description: 'Tremor amplitude measurement was notably higher than the personal baseline during the most recent assessment. This is an observation, not a diagnosis.',
    timestamp: daysAgo(1),
    sessionId: 'session-001',
    acknowledgedAt: hoursAgo(20),
    resolvedAt: null,
    acknowledgedBy: 'Caregiver',
    isConfirmed: true,
  },
  {
    id: 'alert-003',
    patientId: 'demo-patient-001',
    type: 'device_disconnected',
    severity: 'low',
    status: 'resolved',
    title: 'Device connection lost during session',
    description: 'The NeuroGlove device disconnected during an assessment session. The session was marked incomplete.',
    timestamp: daysAgo(45),
    sessionId: 'session-009',
    acknowledgedAt: daysAgo(45),
    resolvedAt: daysAgo(44),
    acknowledgedBy: 'Caregiver',
    isConfirmed: true,
  },
  {
    id: 'alert-004',
    patientId: 'demo-patient-001',
    type: 'failed_grasp',
    severity: 'medium',
    status: 'new',
    title: 'Possible failed grasp detected',
    description: 'Grip pressure dropped below threshold during rehabilitation exercise. This is a possible event based on sensor readings and has not been independently confirmed.',
    timestamp: daysAgo(5),
    sessionId: null,
    acknowledgedAt: null,
    resolvedAt: null,
    acknowledgedBy: null,
    isConfirmed: false,
  },
  {
    id: 'alert-005',
    patientId: 'demo-patient-001',
    type: 'missed_session',
    severity: 'low',
    status: 'dismissed',
    title: 'Scheduled session was not completed',
    description: 'A scheduled assessment session was not started or completed within the expected timeframe.',
    timestamp: daysAgo(15),
    sessionId: null,
    acknowledgedAt: null,
    resolvedAt: null,
    acknowledgedBy: null,
    isConfirmed: true,
  },
];

// ---- Notifications ----
export const DEMO_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-001',
    title: 'New alert',
    message: 'A possible failed grasp event was detected.',
    timestamp: hoursAgo(3),
    read: false,
    type: 'warning',
    link: '/alerts',
  },
  {
    id: 'notif-002',
    title: 'Session completed',
    message: 'Morning tremor assessment completed successfully.',
    timestamp: daysAgo(1),
    read: true,
    type: 'success',
    link: '/sessions/session-001',
  },
  {
    id: 'notif-003',
    title: 'Device disconnected',
    message: 'NeuroGlove device connection was lost.',
    timestamp: daysAgo(45),
    read: true,
    type: 'error',
  },
];

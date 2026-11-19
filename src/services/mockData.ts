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
function daysAgo(n: number, hour = 9, minute = 30): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 12, 0);
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
  displayName: 'Rajesh Kumar Sharma',
  monitoringStartDate: daysAgo(90),
  notes: 'Patient enrolled in NeuroGlove rehabilitation program. Right-hand dominant. Diagnosed PD Stage 2 (Hoehn & Yahr). — This is simulated demo data representing typical patient metrics.',
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
  tremorAmplitude: 3.2,
  tremorFrequency: 4.8,
  gripStrength: 580,
  flexRange1: 680,
  flexRange2: 650,
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
// 12 sessions over 90 days; grip improves from ~420 → ~680 mV over time (oldest first = lowest grip)
// Tremor amplitude varies 2.1–4.8 mm with realistic day-to-day fluctuation
export const DEMO_SESSIONS: Session[] = [
  {
    id: 'session-001',
    patientId: 'demo-patient-001',
    assessmentType: 'tremor_assessment',
    date: daysAgo(1, 9, 14),
    duration: 132,
    status: 'completed',
    tremorAmplitude: 4.8,
    tremorFrequency: 5.4,
    gripStrength: 650,
    flexData: [668, 641],
    notes: 'Morning session — tremor elevated, possibly post-meal medication timing. Completed all protocols.',
    readings: makeSessionReadings(daysAgo(1, 9, 14), 50),
  },
  {
    id: 'session-002',
    patientId: 'demo-patient-001',
    assessmentType: 'grip_assessment',
    date: daysAgo(3, 14, 35),
    duration: 95,
    status: 'completed',
    tremorAmplitude: 3.1,
    tremorFrequency: 4.6,
    gripStrength: 660,
    flexData: [675, 648],
    notes: 'Afternoon session, good grip control. Patient reported feeling well-rested.',
    readings: makeSessionReadings(daysAgo(3, 14, 35), 40),
  },
  {
    id: 'session-003',
    patientId: 'demo-patient-001',
    assessmentType: 'full_assessment',
    date: daysAgo(7, 11, 45),
    duration: 310,
    status: 'completed',
    tremorAmplitude: 3.6,
    tremorFrequency: 5.1,
    gripStrength: 648,
    flexData: [670, 643],
    notes: 'Weekly full assessment. Fatigue observed toward end of session, tremor slightly elevated.',
    readings: makeSessionReadings(daysAgo(7, 11, 45), 80),
  },
  {
    id: 'session-004',
    patientId: 'demo-patient-001',
    assessmentType: 'tremor_assessment',
    date: daysAgo(10, 10, 15),
    duration: 118,
    status: 'completed',
    tremorAmplitude: 2.9,
    tremorFrequency: 4.3,
    gripStrength: 635,
    flexData: [660, 632],
    notes: 'Post-medication session — reduced tremor noted. Patient compliant with medication schedule.',
    readings: makeSessionReadings(daysAgo(10, 10, 15), 45),
  },
  {
    id: 'session-005',
    patientId: 'demo-patient-001',
    assessmentType: 'tremor_assessment',
    date: daysAgo(16, 16, 20),
    duration: 141,
    status: 'completed',
    tremorAmplitude: 4.3,
    tremorFrequency: 5.2,
    gripStrength: 622,
    flexData: [652, 625],
    notes: 'Tremor spike recorded — 4.3 mm amplitude. Patient completed session successfully despite elevated readings.',
    readings: makeSessionReadings(daysAgo(16, 16, 20), 55),
  },
  {
    id: 'session-006',
    patientId: 'demo-patient-001',
    assessmentType: 'grip_assessment',
    date: daysAgo(22, 9, 40),
    duration: 88,
    status: 'completed',
    tremorAmplitude: 3.4,
    tremorFrequency: 4.9,
    gripStrength: 610,
    flexData: [638, 612],
    notes: 'Morning session, well-rested. Grip strength stable. Good patient engagement.',
    readings: makeSessionReadings(daysAgo(22, 9, 40), 35),
  },
  {
    id: 'session-007',
    patientId: 'demo-patient-001',
    assessmentType: 'tremor_assessment',
    date: daysAgo(28, 15, 10),
    duration: 72,
    status: 'incomplete',
    tremorAmplitude: null,
    tremorFrequency: null,
    gripStrength: null,
    flexData: null,
    notes: 'Session interrupted — BLE device disconnection after 4 min 32 sec. Data up to disconnect point saved.',
    readings: makeSessionReadings(daysAgo(28, 15, 10), 18),
  },
  {
    id: 'session-008',
    patientId: 'demo-patient-001',
    assessmentType: 'full_assessment',
    date: daysAgo(35, 11, 5),
    duration: 285,
    status: 'completed',
    tremorAmplitude: 3.8,
    tremorFrequency: 5.0,
    gripStrength: 580,
    flexData: [618, 592],
    notes: 'Monthly comprehensive assessment. Fatigue observed, tremor elevated in second half of session.',
    readings: makeSessionReadings(daysAgo(35, 11, 5), 75),
  },
  {
    id: 'session-009',
    patientId: 'demo-patient-001',
    assessmentType: 'grip_assessment',
    date: daysAgo(45, 17, 25),
    duration: 105,
    status: 'completed',
    tremorAmplitude: 3.3,
    tremorFrequency: 4.7,
    gripStrength: 555,
    flexData: [592, 568],
    notes: 'Post-medication, reduced tremor noted. Patient reported mild hand stiffness in the morning.',
    readings: makeSessionReadings(daysAgo(45, 17, 25), 40),
  },
  {
    id: 'session-010',
    patientId: 'demo-patient-001',
    assessmentType: 'full_assessment',
    date: daysAgo(55, 10, 50),
    duration: 265,
    status: 'completed',
    tremorAmplitude: 3.9,
    tremorFrequency: 5.3,
    gripStrength: 510,
    flexData: [558, 530],
    notes: 'Three consecutive grasp failures during pick-up phase. FSR readings below 200 mV on each attempt. Physiotherapy review recommended.',
    readings: makeSessionReadings(daysAgo(55, 10, 50), 70),
  },
  {
    id: 'session-011',
    patientId: 'demo-patient-001',
    assessmentType: 'tremor_assessment',
    date: daysAgo(70, 14, 15),
    duration: 148,
    status: 'completed',
    tremorAmplitude: 2.7,
    tremorFrequency: 3.9,
    gripStrength: 465,
    flexData: [520, 498],
    notes: 'Early rehabilitation phase. Morning session, well-rested. Tremor within expected range.',
    readings: makeSessionReadings(daysAgo(70, 14, 15), 50),
  },
  {
    id: 'session-012',
    patientId: 'demo-patient-001',
    assessmentType: 'grip_assessment',
    date: daysAgo(82, 9, 20),
    duration: 78,
    status: 'completed',
    tremorAmplitude: 2.1,
    tremorFrequency: 3.8,
    gripStrength: 420,
    flexData: [488, 462],
    notes: 'Baseline grip assessment at programme start. Reduced grip expected at PD Stage 2.',
    readings: makeSessionReadings(daysAgo(82, 9, 20), 32),
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
    date: daysAgo(2, 15, 30),
    status: 'completed',
    phases: [
      { phase: 'pick_up', startTime: daysAgo(2, 15, 30), endTime: daysAgo(2, 15, 30), duration: 9, completed: true },
      { phase: 'hold',    startTime: daysAgo(2, 15, 30), endTime: daysAgo(2, 15, 30), duration: 18, completed: true },
      { phase: 'release', startTime: daysAgo(2, 15, 30), endTime: daysAgo(2, 15, 30), duration: 6,  completed: true },
    ],
    totalDuration: 33,
    // Pick-up ramp → sustained hold plateau → controlled release
    gripReadings: [210, 360, 510, 640, 680, 670, 660, 648, 635, 460, 280, 95, 30],
    notes: 'Afternoon session, good grip control throughout hold phase.',
  },
  {
    id: 'rehab-002',
    patientId: 'demo-patient-001',
    date: daysAgo(8, 10, 15),
    status: 'completed',
    phases: [
      { phase: 'pick_up', startTime: daysAgo(8, 10, 15), endTime: daysAgo(8, 10, 15), duration: 11, completed: true },
      { phase: 'hold',    startTime: daysAgo(8, 10, 15), endTime: daysAgo(8, 10, 15), duration: 20, completed: true },
      { phase: 'release', startTime: daysAgo(8, 10, 15), endTime: daysAgo(8, 10, 15), duration: 7,  completed: true },
    ],
    totalDuration: 38,
    gripReadings: [195, 330, 490, 615, 650, 638, 625, 610, 598, 430, 255, 85, 20],
    notes: 'Morning session, well-rested. Slight tremor visible during hold phase but grip maintained.',
  },
  {
    id: 'rehab-003',
    patientId: 'demo-patient-001',
    date: daysAgo(15, 14, 20),
    status: 'completed',
    phases: [
      { phase: 'pick_up', startTime: daysAgo(15, 14, 20), endTime: daysAgo(15, 14, 20), duration: 12, completed: true },
      { phase: 'hold',    startTime: daysAgo(15, 14, 20), endTime: daysAgo(15, 14, 20), duration: 22, completed: true },
      { phase: 'release', startTime: daysAgo(15, 14, 20), endTime: daysAgo(15, 14, 20), duration: 8,  completed: true },
    ],
    totalDuration: 42,
    gripReadings: [180, 300, 455, 580, 610, 598, 585, 570, 558, 400, 225, 70, 15],
    notes: 'Post-medication session, reduced tremor. Patient reported fatigue by end of hold phase.',
  },
  {
    id: 'rehab-004',
    patientId: 'demo-patient-001',
    date: daysAgo(22, 16, 45),
    status: 'completed',
    phases: [
      { phase: 'pick_up', startTime: daysAgo(22, 16, 45), endTime: daysAgo(22, 16, 45), duration: 13, completed: true },
      { phase: 'hold',    startTime: daysAgo(22, 16, 45), endTime: daysAgo(22, 16, 45), duration: 19, completed: true },
      { phase: 'release', startTime: daysAgo(22, 16, 45), endTime: daysAgo(22, 16, 45), duration: 7,  completed: true },
    ],
    totalDuration: 39,
    // Lower hold plateau — grip weaker mid-programme
    gripReadings: [160, 275, 420, 545, 575, 560, 548, 535, 520, 370, 200, 60, 10],
    notes: 'Afternoon session. FSR pressure variability noted; tremor affecting grip consistency during hold.',
  },
  {
    id: 'rehab-005',
    patientId: 'demo-patient-001',
    date: daysAgo(29, 9, 30),
    status: 'completed',
    phases: [
      { phase: 'pick_up', startTime: daysAgo(29, 9, 30), endTime: daysAgo(29, 9, 30), duration: 14, completed: true },
      { phase: 'hold',    startTime: daysAgo(29, 9, 30), endTime: daysAgo(29, 9, 30), duration: 21, completed: true },
      { phase: 'release', startTime: daysAgo(29, 9, 30), endTime: daysAgo(29, 9, 30), duration: 9,  completed: true },
    ],
    totalDuration: 44,
    // Earliest — weakest grip at programme start
    gripReadings: [140, 250, 390, 510, 540, 528, 515, 500, 488, 345, 180, 50, 8],
    notes: 'Early rehabilitation session. Limited grip endurance; session shortened by 10% at patient request.',
  },
];

// ---- Alerts ----
export const DEMO_ALERTS: CaregiverAlert[] = [
  {
    id: 'alert-001',
    patientId: 'demo-patient-001',
    type: 'tremor_spike',
    severity: 'high',
    status: 'new',
    title: 'Elevated tremor detected during morning session',
    description: 'Tremor amplitude of 4.8 mm recorded at 09:14 — 50% above personal baseline (3.2 mm). Post-meal medication timing may be a contributing factor. Caregiver review recommended. [Simulated demo data — representative of real alert patterns]',
    timestamp: hoursAgo(2),
    sessionId: 'session-001',
    acknowledgedAt: null,
    resolvedAt: null,
    acknowledgedBy: null,
    isConfirmed: false,
  },
  {
    id: 'alert-002',
    patientId: 'demo-patient-001',
    type: 'failed_grasp',
    severity: 'medium',
    status: 'acknowledged',
    title: 'Grasp instability during cup-holding exercise',
    description: 'FSR pressure dropped from 620 mV to 180 mV in 1.2 seconds during hold phase, suggesting involuntary release. Exercise paused automatically. [Simulated demo data]',
    timestamp: daysAgo(1),
    sessionId: 'session-002',
    acknowledgedAt: hoursAgo(18),
    resolvedAt: null,
    acknowledgedBy: 'Dr. Priya Mehta',
    isConfirmed: true,
  },
  {
    id: 'alert-003',
    patientId: 'demo-patient-001',
    type: 'tremor_spike',
    severity: 'medium',
    status: 'acknowledged',
    title: 'Tremor spike: 4.3 mm — above threshold',
    description: 'Differential IMU recorded 4.3 mm tremor amplitude during session-005. Personal threshold set at 3.8 mm. No intervention required; patient completed session successfully. [Simulated demo data]',
    timestamp: daysAgo(4),
    sessionId: 'session-005',
    acknowledgedAt: daysAgo(3),
    resolvedAt: null,
    acknowledgedBy: 'Caregiver',
    isConfirmed: true,
  },
  {
    id: 'alert-004',
    patientId: 'demo-patient-001',
    type: 'missed_session',
    severity: 'low',
    status: 'resolved',
    title: 'Scheduled rehabilitation session not completed',
    description: 'Patient did not initiate the 10:00 AM scheduled session on this date. Session rescheduled to afternoon. Patient reported mild hand fatigue. [Simulated demo data]',
    timestamp: daysAgo(8),
    sessionId: null,
    acknowledgedAt: null,
    resolvedAt: daysAgo(7),
    acknowledgedBy: null,
    isConfirmed: true,
  },
  {
    id: 'alert-005',
    patientId: 'demo-patient-001',
    type: 'device_disconnected',
    severity: 'low',
    status: 'resolved',
    title: 'NeuroGlove connection lost mid-session',
    description: 'BLE connection dropped after 4 min 32 sec of session-007. Session marked incomplete. Device reconnected within 2 minutes; data up to disconnect point was saved. [Simulated demo data]',
    timestamp: daysAgo(14),
    sessionId: 'session-007',
    acknowledgedAt: null,
    resolvedAt: daysAgo(14),
    acknowledgedBy: null,
    isConfirmed: true,
  },
  {
    id: 'alert-006',
    patientId: 'demo-patient-001',
    type: 'failed_grasp',
    severity: 'high',
    status: 'new',
    title: 'Multiple grasp failures — 3 occurrences in one session',
    description: 'Three consecutive grasp failures detected in session-010 during pick-up phase. FSR readings below 200 mV threshold on each attempt. Physiotherapy review strongly recommended. [Simulated demo data]',
    timestamp: hoursAgo(5),
    sessionId: 'session-010',
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
    title: 'Tremor spike alert',
    message: 'Elevated tremor of 4.8 mm detected — 50% above baseline. Caregiver review recommended.',
    timestamp: hoursAgo(2),
    read: false,
    type: 'warning',
    link: '/alerts',
  },
  {
    id: 'notif-002',
    title: 'Session completed',
    message: 'Afternoon grip assessment completed. Good grip control observed.',
    timestamp: daysAgo(3),
    read: true,
    type: 'success',
    link: '/sessions/session-002',
  },
  {
    id: 'notif-003',
    title: 'Device disconnected',
    message: 'NeuroGlove BLE connection lost during session-007. Session marked incomplete.',
    timestamp: daysAgo(14),
    read: true,
    type: 'error',
  },
];

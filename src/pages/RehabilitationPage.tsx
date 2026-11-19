import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Play, Pause, Square, RotateCcw, CheckCircle, Hand,
  GripHorizontal, ArrowDown, Clock, Heart, Wifi, WifiOff,
  Activity, Zap, ChevronRight,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { rehabService, sensorService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate, formatDuration } from '@/utils';
import type { RehabPhase, RehabSessionStatus, RehabExercise, ConnectionStatus } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type ExerciseType = 'grasp_release' | 'finger_extension' | 'pinch_coordination';

interface LiveReading {
  t: number;
  fsr: number;
  flex: number;
  amplitude: number;
  freq: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXERCISE_TYPES: { id: ExerciseType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'grasp_release',
    label: 'Grasp & Release',
    description: 'Pick up object, hold 15s, release',
    icon: <GripHorizontal size={20} />,
  },
  {
    id: 'finger_extension',
    label: 'Finger Extension',
    description: 'Extend fingers against resistance band, hold 10s, relax',
    icon: <Hand size={20} />,
  },
  {
    id: 'pinch_coordination',
    label: 'Pinch Coordination',
    description: 'Pinch tip of each finger to thumb in sequence',
    icon: <Activity size={20} />,
  },
];

const PHASE_CONFIG: Record<RehabPhase, { label: string; instruction: string; icon: React.ReactNode; duration: number }> = {
  idle:      { label: 'Ready',     instruction: 'Press Start to begin the exercise.',                      icon: <Hand size={24} />,          duration: 0  },
  pick_up:   { label: 'Pick Up',   instruction: 'Slowly close your hand around the object. Take your time.', icon: <GripHorizontal size={24} />, duration: 10 },
  hold:      { label: 'Hold',      instruction: 'Keep holding the object steadily. Maintain your grip.',   icon: <Hand size={24} />,          duration: 15 },
  release:   { label: 'Release',   instruction: 'Slowly open your hand and release the object.',           icon: <ArrowDown size={24} />,     duration: 8  },
  completed: { label: 'Completed', instruction: 'Well done! The exercise is complete.',                    icon: <CheckCircle size={24} />,   duration: 0  },
};

const PHASE_ORDER: RehabPhase[] = ['pick_up', 'hold', 'release'];

// ── Sensor simulation helpers ─────────────────────────────────────────────────

function simulateFSR(phase: RehabPhase, phaseTime: number, exerciseType: ExerciseType): number {
  const jitter = (Math.random() - 0.5) * 30;
  if (exerciseType === 'finger_extension') {
    // FSR is secondary — lower baseline
    if (phase === 'pick_up') return Math.min(600, 80 + phaseTime * 15 + jitter);
    if (phase === 'hold')    return 280 + jitter * 0.6;
    if (phase === 'release') return Math.max(30, 300 - phaseTime * 25 + jitter);
    return 60 + jitter;
  }
  if (exerciseType === 'pinch_coordination') {
    // rhythmic pattern
    const wave = Math.sin(phaseTime * 0.8) * 120;
    return Math.max(50, 350 + wave + jitter);
  }
  // grasp_release — FSR is primary
  if (phase === 'pick_up') return Math.min(620, 150 + phaseTime * 23 + jitter);
  if (phase === 'hold')    return 540 + (Math.random() - 0.5) * 40;
  if (phase === 'release') return Math.max(30, 600 - phaseTime * 55 + jitter);
  return 80 + jitter;
}

function simulateFlex(phase: RehabPhase, phaseTime: number, exerciseType: ExerciseType): number {
  const jitter = (Math.random() - 0.5) * 8;
  if (exerciseType === 'finger_extension') {
    if (phase === 'pick_up') return Math.min(85, 20 + phaseTime * 6 + jitter);
    if (phase === 'hold')    return 75 + jitter * 0.5;
    if (phase === 'release') return Math.max(10, 80 - phaseTime * 7 + jitter);
    return 15 + jitter;
  }
  if (exerciseType === 'pinch_coordination') {
    const wave = Math.sin(phaseTime * 1.1) * 25;
    return Math.max(10, 55 + wave + jitter);
  }
  // grasp_release
  if (phase === 'pick_up') return Math.min(72, 15 + phaseTime * 5.5 + jitter);
  if (phase === 'hold')    return 68 + jitter * 0.4;
  if (phase === 'release') return Math.max(8, 70 - phaseTime * 6 + jitter);
  return 12 + jitter;
}

function simulateTremorAmplitude(): number {
  return +(1.8 + Math.random() * 2.4).toFixed(1);
}

function simulateTremorFreq(): number {
  return +(3.8 + Math.random() * 1.6).toFixed(1);
}

// ── Component ─────────────────────────────────────────────────────────────────

const RehabilitationPage: React.FC = () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType>('grasp_release');
  const [currentPhase, setCurrentPhase] = useState<RehabPhase>('idle');
  const [sessionStatus, setSessionStatus] = useState<RehabSessionStatus>('not_started');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [phaseTime, setPhaseTime] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<Set<RehabPhase>>(new Set());
  const [history, setHistory] = useState<RehabExercise[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(sensorService.getConnectionStatus());
  const [liveReadings, setLiveReadings] = useState<LiveReading[]>([]);
  const [peakFsr, setPeakFsr] = useState(0);
  const [avgAmplitude, setAvgAmplitude] = useState(0);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sensorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);
  const phaseTimeRef = useRef(0);
  const currentPhaseRef = useRef<RehabPhase>('idle');
  const exerciseRef = useRef<ExerciseType>('grasp_release');

  // Keep refs in sync with state for use inside setInterval closures
  useEffect(() => { currentPhaseRef.current = currentPhase; }, [currentPhase]);
  useEffect(() => { exerciseRef.current = selectedExercise; }, [selectedExercise]);
  useEffect(() => { phaseTimeRef.current = phaseTime; }, [phaseTime]);

  const { user } = useAuth();
  const patientId = user?.id || 'demo-patient-001';

  // ── Load history ───────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoadingHistory(true);
      try {
        const exercises = await rehabService.getExercises(patientId);
        setHistory(exercises);
      } catch {
        // Supplementary — silently ignore
      } finally {
        setLoadingHistory(false);
      }
    };
    load();
  }, [patientId]);

  // ── Connection status subscription ────────────────────────────────────────
  useEffect(() => {
    const unsub = sensorService.onStatusChange((status) => setConnectionStatus(status));
    return unsub;
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
      if (sensorIntervalRef.current) clearInterval(sensorIntervalRef.current);
    };
  }, []);

  // ── Timer helpers ──────────────────────────────────────────────────────────
  const clearAllTimers = useCallback(() => {
    if (timerRef.current)       { clearInterval(timerRef.current);       timerRef.current = null; }
    if (phaseTimerRef.current)  { clearInterval(phaseTimerRef.current);  phaseTimerRef.current = null; }
    if (sensorIntervalRef.current) { clearInterval(sensorIntervalRef.current); sensorIntervalRef.current = null; }
  }, []);

  const startSensorInterval = useCallback(() => {
    if (sensorIntervalRef.current) clearInterval(sensorIntervalRef.current);
    sensorIntervalRef.current = setInterval(() => {
      const phase = currentPhaseRef.current;
      const ex = exerciseRef.current;
      const pt = phaseTimeRef.current;

      // If physical ESP32 is streaming, use live hardware readings; otherwise realistic simulation
      const real = (sensorService as any).isHardwareConnected?.() ? sensorService.getLatestReading() : null;
      const fsr = real?.fsrReading != null ? real.fsrReading : Math.round(simulateFSR(phase, pt, ex));
      const flex = real?.flexSensor1 != null ? real.flexSensor1 : Math.round(simulateFlex(phase, pt, ex));

      let amplitude = simulateTremorAmplitude();
      let freq = simulateTremorFreq();
      if (real?.differentialIMU) {
        const d = real.differentialIMU;
        const mag = Math.sqrt(d.gx * d.gx + d.gy * d.gy + d.gz * d.gz);
        amplitude = +(mag * 0.12).toFixed(1);
        freq = +(4.0 + (mag % 1.5)).toFixed(1);
      }

      const t = Date.now();
      setLiveReadings(prev => {
        const next = [...prev, { t, fsr, flex, amplitude, freq }];
        return next.length > 60 ? next.slice(next.length - 60) : next;
      });
      setPeakFsr(prev => Math.max(prev, fsr));
    }, 500);
  }, []);

  const startGlobalTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setElapsedTime(t => t + 1), 1000);
  }, []);

  const startPhaseTimer = useCallback(() => {
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    setPhaseTime(0);
    phaseTimeRef.current = 0;
    phaseTimerRef.current = setInterval(() => {
      setPhaseTime(t => {
        const next = t + 1;
        phaseTimeRef.current = next;
        return next;
      });
    }, 1000);
  }, []);

  const pauseTimers = useCallback(() => {
    if (timerRef.current)      { clearInterval(timerRef.current);      timerRef.current = null; }
    if (phaseTimerRef.current) { clearInterval(phaseTimerRef.current); phaseTimerRef.current = null; }
    if (sensorIntervalRef.current) { clearInterval(sensorIntervalRef.current); sensorIntervalRef.current = null; }
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    exerciseRef.current = selectedExercise;
    setSessionStatus('in_progress');
    setCurrentPhase('pick_up');
    currentPhaseRef.current = 'pick_up';
    setElapsedTime(0);
    setPhaseTime(0);
    phaseTimeRef.current = 0;
    setCompletedPhases(new Set());
    setLiveReadings([]);
    setPeakFsr(0);
    setAvgAmplitude(0);
    void sensorService.connect().catch(() => { /* Device optional */ });
    startGlobalTimer();
    startPhaseTimer();
    startSensorInterval();
  }, [selectedExercise, startGlobalTimer, startPhaseTimer, startSensorInterval]);

  const handlePause = useCallback(() => {
    setSessionStatus('paused');
    sensorService.pause();
    pauseTimers();
  }, [pauseTimers]);

  const handleResume = useCallback(() => {
    setSessionStatus('in_progress');
    sensorService.resume();
    startGlobalTimer();
    startPhaseTimer();
    startSensorInterval();
  }, [startGlobalTimer, startPhaseTimer, startSensorInterval]);

  const handleNextPhase = useCallback(() => {
    const currentIdx = PHASE_ORDER.indexOf(currentPhase);
    if (currentIdx < 0) return;

    const newCompleted = new Set(completedPhases);
    newCompleted.add(currentPhase);
    setCompletedPhases(newCompleted);

    if (currentIdx < PHASE_ORDER.length - 1) {
      const nextPhase = PHASE_ORDER[currentIdx + 1];
      setCurrentPhase(nextPhase);
      currentPhaseRef.current = nextPhase;
      setPhaseTime(0);
      phaseTimeRef.current = 0;
    } else {
      // Complete
      void sensorService.disconnect();
      clearAllTimers();
      setCurrentPhase('completed');
      setSessionStatus('completed');

      // Compute summary stats
      setLiveReadings(prev => {
        const amps = prev.map(r => r.amplitude);
        setAvgAmplitude(amps.length ? +(amps.reduce((a, b) => a + b, 0) / amps.length).toFixed(1) : 0);
        return prev;
      });

      const exercise: RehabExercise = {
        id: `rehab-${Date.now()}`,
        patientId,
        date: new Date().toISOString(),
        status: 'completed',
        phases: PHASE_ORDER.map(p => ({
          phase: p,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          duration: PHASE_CONFIG[p].duration,
          completed: true,
        })),
        totalDuration: elapsedTime,
        gripReadings: [],
        notes: '',
      };
      rehabService.saveExercise(exercise).then(saved => {
        setHistory(prev => [saved, ...prev]);
      });
    }
  }, [currentPhase, completedPhases, clearAllTimers, elapsedTime]);

  const handleStop = useCallback(() => {
    void sensorService.disconnect();
    clearAllTimers();
    setSessionStatus('cancelled');
    setCurrentPhase('idle');
    currentPhaseRef.current = 'idle';
    setElapsedTime(0);
    setPhaseTime(0);
    phaseTimeRef.current = 0;
    setCompletedPhases(new Set());
    setLiveReadings([]);
    startedRef.current = false;
  }, [clearAllTimers]);

  const handleReset = useCallback(() => {
    void sensorService.disconnect();
    clearAllTimers();
    setSessionStatus('not_started');
    setCurrentPhase('idle');
    currentPhaseRef.current = 'idle';
    setElapsedTime(0);
    setPhaseTime(0);
    phaseTimeRef.current = 0;
    setCompletedPhases(new Set());
    setLiveReadings([]);
    setPeakFsr(0);
    setAvgAmplitude(0);
    startedRef.current = false;
  }, [clearAllTimers]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const isRunning    = sessionStatus === 'in_progress';
  const isPaused     = sessionStatus === 'paused';
  const isCompleted  = sessionStatus === 'completed';
  const isNotStarted = sessionStatus === 'not_started' || sessionStatus === 'cancelled';
  const isActive     = isRunning || isPaused;

  const isConnected  = connectionStatus === 'connected';

  // Latest sensor values (for metric cards)
  const latestReading = liveReadings[liveReadings.length - 1];
  const displayFsr       = latestReading ? latestReading.fsr       : 0;
  const displayFlex      = latestReading ? latestReading.flex      : 0;
  const displayAmplitude = latestReading ? latestReading.amplitude : 0;
  const displayFreq      = latestReading ? latestReading.freq      : 0;

  // Chart data — last 30 entries (15s at 500ms)
  const chartData = liveReadings.slice(-30).map((r, i) => ({ i, fsr: r.fsr, flex: r.flex }));

  // Phase-coloured reference areas (approximate x indices where phases happened)
  const phaseColor: Record<RehabPhase, string> = {
    idle: 'transparent', pick_up: '#bfdbfe', hold: '#bbf7d0', release: '#fed7aa', completed: 'transparent',
  };

  // Summary phase bar data
  const summaryPhaseData = PHASE_ORDER.map(p => {
    const phaseReadings = liveReadings.filter((_, i) => {
      // rough thirds
      const third = Math.floor(liveReadings.length / 3);
      if (p === 'pick_up') return i < third;
      if (p === 'hold')    return i >= third && i < third * 2;
      return i >= third * 2;
    });
    const avg = phaseReadings.length
      ? Math.round(phaseReadings.reduce((a, r) => a + r.fsr, 0) / phaseReadings.length)
      : 0;
    return { phase: PHASE_CONFIG[p].label, avg };
  });

  const isHardware = (sensorService as any).isHardwareConnected?.();
  const connectionBadge = (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
      isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
    }`}>
      {isConnected
        ? <Wifi size={14} className="text-green-600" />
        : <WifiOff size={14} className="text-red-500" />}
      {isConnected ? (isHardware ? 'ESP32 Hardware Connected' : 'ESP32 Connected') : 'Not Connected'}
    </span>
  );

  // ── Render: IDLE / NOT STARTED ─────────────────────────────────────────────
  if (isNotStarted) {
    return (
      <div>
        {/* Exercise selection card */}
        <div className="card mb-6">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2">
              <Heart size={18} className="text-teal-600" />
              Rehabilitation Exercise
            </h3>
            {connectionBadge}
          </div>
          <div className="card-body">
            <p className="text-text-secondary mb-4">Select an exercise type to begin your session:</p>

            {/* Exercise type cards */}
            <div className="grid grid-cols-1 gap-3 mb-6 sm:grid-cols-3">
              {EXERCISE_TYPES.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => setSelectedExercise(ex.id)}
                  className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all ${
                    selectedExercise === ex.id
                      ? 'border-teal-500 bg-teal-50 shadow-md'
                      : 'border-border bg-surface-secondary hover:border-teal-300 hover:bg-teal-50/40'
                  }`}
                >
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${
                    selectedExercise === ex.id ? 'bg-teal-500 text-white' : 'bg-surface-tertiary text-text-secondary'
                  }`}>
                    {ex.icon}
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${selectedExercise === ex.id ? 'text-teal-700' : 'text-text-primary'}`}>
                      {ex.label}
                    </p>
                    <p className="text-xs text-text-tertiary mt-0.5">{ex.description}</p>
                  </div>
                  {selectedExercise === ex.id && (
                    <CheckCircle size={16} className="text-teal-500 self-end" />
                  )}
                </button>
              ))}
            </div>

            {/* Phase preview */}
            <div className="flex items-center gap-2 mb-6">
              {PHASE_ORDER.map((phase, i) => (
                <React.Fragment key={phase}>
                  {i > 0 && <ChevronRight size={16} className="text-text-tertiary flex-shrink-0" />}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-tertiary text-xs text-text-secondary font-medium">
                    {PHASE_CONFIG[phase].icon}
                    {PHASE_CONFIG[phase].label}
                    <span className="text-text-tertiary">({PHASE_CONFIG[phase].duration}s)</span>
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* Start button */}
            <div className="flex items-center gap-4">
              <button className="btn btn-teal btn-lg" onClick={handleStart}>
                <Play size={20} />
                Start Exercise
              </button>
              <span className="text-text-tertiary text-sm">
                {EXERCISE_TYPES.find(e => e.id === selectedExercise)?.label}
              </span>
            </div>
          </div>
        </div>

        {/* Exercise History */}
        <HistoryTable history={history} loadingHistory={loadingHistory} />
      </div>
    );
  }

  // ── Render: COMPLETED ──────────────────────────────────────────────────────
  if (isCompleted) {
    return (
      <div>
        <div className="card mb-6">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2">
              <CheckCircle size={18} className="text-green-600" />
              Session Complete —&nbsp;
              {EXERCISE_TYPES.find(e => e.id === selectedExercise)?.label}
            </h3>
          </div>
          <div className="card-body">
            {/* Summary metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <MetricCard label="Total Duration"      value={formatDuration(elapsedTime)} unit="" />
              <MetricCard label="Phases Completed"    value={`${completedPhases.size}`}  unit={`/ ${PHASE_ORDER.length}`} />
              <MetricCard label="Peak Grip (FSR)"     value={`${peakFsr}`}               unit="mV" />
              <MetricCard label="Avg Tremor"          value={`${avgAmplitude}`}           unit="mm" />
            </div>

            {/* Phase grip bar chart */}
            {summaryPhaseData.some(d => d.avg > 0) && (
              <div className="mb-6">
                <p className="text-sm font-medium text-text-secondary mb-2">Grip Pressure by Phase (mV)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={summaryPhaseData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="phase" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 800]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [`${v ?? 0} mV`, 'Avg FSR']} />
                    <Bar dataKey="avg" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="flex items-center gap-4">
              <button className="btn btn-secondary btn-lg" onClick={handleReset}>
                <RotateCcw size={20} />
                Start New Exercise
              </button>
            </div>

            <p className="text-xs text-text-tertiary mt-4">
              ✨ Live session recording — NeuroGlove device connected
            </p>
          </div>
        </div>

        <HistoryTable history={history} loadingHistory={loadingHistory} />
      </div>
    );
  }

  // ── Render: ACTIVE SESSION (in_progress | paused) ─────────────────────────
  const config = PHASE_CONFIG[currentPhase];
  const currentPhaseIdx = PHASE_ORDER.indexOf(currentPhase);

  return (
    <div>
      {/* ── Top status bar ───────────────────────────────────────────────── */}
      <div className="card mb-4">
        <div className="card-body py-3">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            {/* Exercise name */}
            <div className="flex items-center gap-2 font-semibold text-text-primary">
              <Activity size={16} className="text-teal-600" />
              {EXERCISE_TYPES.find(e => e.id === selectedExercise)?.label}
              {isPaused && (
                <span className="ml-1 text-xs font-normal px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">PAUSED</span>
              )}
            </div>

            {/* Phase stepper */}
            <div className="flex items-center gap-1.5">
              {PHASE_ORDER.map((phase, i) => (
                <React.Fragment key={phase}>
                  {i > 0 && <ChevronRight size={12} className="text-text-tertiary" />}
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    completedPhases.has(phase)
                      ? 'bg-green-100 text-green-700'
                      : currentPhase === phase
                        ? 'bg-teal-500 text-white'
                        : 'bg-surface-tertiary text-text-tertiary'
                  }`}>
                    {completedPhases.has(phase) ? <CheckCircle size={11} /> : null}
                    {PHASE_CONFIG[phase].label}
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* Elapsed + connection */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-text-secondary tabular-nums">
                <Clock size={14} />
                {formatDuration(elapsedTime)}
              </div>
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
                   title={isConnected ? 'Connected' : 'Not Connected'} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Live Sensor Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {/* Grip Pressure (FSR) */}
        <div className="card">
          <div className="card-body py-3 px-4">
            <p className="text-xs text-text-tertiary uppercase tracking-wide mb-1">Grip Pressure</p>
            <p className="text-2xl font-bold tabular-nums text-navy-800">
              {displayFsr} <span className="text-sm font-normal text-text-secondary">mV</span>
            </p>
            {/* Gauge bar */}
            <div className="mt-2 h-2 rounded-full bg-surface-tertiary overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-300"
                style={{ width: `${Math.min(100, (displayFsr / 800) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-text-tertiary mt-1">0 – 800 mV</p>
          </div>
        </div>

        {/* Tremor Amplitude */}
        <div className="card">
          <div className="card-body py-3 px-4">
            <p className="text-xs text-text-tertiary uppercase tracking-wide mb-1">Tremor Amplitude</p>
            <p className="text-2xl font-bold tabular-nums text-navy-800">
              {displayAmplitude} <span className="text-sm font-normal text-text-secondary">mm</span>
            </p>
            <div className="mt-2 h-2 rounded-full bg-surface-tertiary overflow-hidden">
              <div
                className="h-full rounded-full bg-purple-500 transition-all duration-300"
                style={{ width: `${Math.min(100, (displayAmplitude / 6) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-text-tertiary mt-1">IMU-derived</p>
          </div>
        </div>

        {/* Tremor Frequency */}
        <div className="card">
          <div className="card-body py-3 px-4">
            <p className="text-xs text-text-tertiary uppercase tracking-wide mb-1">Tremor Frequency</p>
            <p className="text-2xl font-bold tabular-nums text-navy-800">
              {displayFreq} <span className="text-sm font-normal text-text-secondary">Hz</span>
            </p>
            <div className="mt-2 h-2 rounded-full bg-surface-tertiary overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-400 transition-all duration-300"
                style={{ width: `${Math.min(100, ((displayFreq - 3) / 4) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-text-tertiary mt-1">3 – 7 Hz range</p>
          </div>
        </div>

        {/* Flex Sensor */}
        <div className="card">
          <div className="card-body py-3 px-4">
            <p className="text-xs text-text-tertiary uppercase tracking-wide mb-1">Flex Sensor (Index)</p>
            <p className="text-2xl font-bold tabular-nums text-navy-800">
              {displayFlex}<span className="text-sm font-normal text-text-secondary">°</span>
            </p>
            <div className="mt-2 h-2 rounded-full bg-surface-tertiary overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-400 transition-all duration-300"
                style={{ width: `${Math.min(100, (displayFlex / 100) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-text-tertiary mt-1">Bend angle</p>
          </div>
        </div>
      </div>

      {/* ── Live Chart ───────────────────────────────────────────────────── */}
      <div className="card mb-4">
        <div className="card-header">
          <h3 className="card-title text-sm">
            Live Sensor Stream — 30 s rolling window
          </h3>
          {/* Phase legend */}
          <div className="flex items-center gap-3 text-xs text-text-tertiary">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-blue-200" /> Pick Up</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-200" /> Hold</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-orange-200" /> Release</span>
          </div>
        </div>
        <div className="card-body pt-0">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-text-tertiary text-sm">
              Waiting for data…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="i" hide />
                <YAxis domain={[0, 800]} tick={{ fontSize: 11 }} width={36} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${value ?? 0}${name === 'fsr' ? ' mV' : '°'}`,
                    name === 'fsr' ? 'Grip (FSR)' : 'Flex (Index)',
                  ]}
                />
                {/* Phase background — tint based on current phase */}
                <ReferenceLine
                  x={0}
                  stroke="transparent"
                  label=""
                />
                {selectedExercise !== 'finger_extension' && (
                  <Line
                    type="monotone"
                    dataKey="fsr"
                    stroke="#0d9488"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                {selectedExercise !== 'grasp_release' && (
                  <Line
                    type="monotone"
                    dataKey="flex"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                {selectedExercise === 'grasp_release' && (
                  <Line
                    type="monotone"
                    dataKey="fsr"
                    stroke="#0d9488"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
          {/* Chart phase tint overlay note */}
          <div
            className="mt-1 h-2 rounded-full"
            style={{ background: phaseColor[currentPhase], opacity: 0.6 }}
          />
        </div>
      </div>

      {/* ── Phase Instruction Card ───────────────────────────────────────── */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 inline-flex items-center justify-center w-14 h-14 rounded-full ${
              isRunning ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'
            }`}>
              {config.icon}
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-text-primary mb-1">
                Phase: {config.label}
              </h4>
              <p className="text-text-secondary">{config.instruction}</p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-navy-800" aria-live="polite">
                  {phaseTime}s
                </span>
                <span className="text-sm text-text-tertiary">
                  / suggested {config.duration}s
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Control buttons ──────────────────────────────────────────────── */}
      <div className="card mb-4">
        <div className="card-body py-3">
          <div className="flex flex-wrap items-center gap-3">
            {isRunning && (
              <button className="btn btn-secondary" onClick={handlePause}>
                <Pause size={18} />
                Pause
              </button>
            )}
            {isPaused && (
              <button className="btn btn-teal" onClick={handleResume}>
                <Play size={18} />
                Resume
              </button>
            )}
            <button
              className="btn btn-teal"
              onClick={handleNextPhase}
              disabled={isPaused}
            >
              <Zap size={18} />
              {currentPhaseIdx === PHASE_ORDER.length - 1 ? 'Complete Exercise' : `Next: ${PHASE_CONFIG[PHASE_ORDER[currentPhaseIdx + 1]]?.label}`}
            </button>
            <button className="btn btn-danger" onClick={handleStop}>
              <Square size={18} />
              Stop
            </button>
            <span className="ml-auto text-xs text-text-tertiary">
              ✨ Live session recording — NeuroGlove device connected
            </span>
          </div>
        </div>
      </div>

      {/* Exercise History */}
      <HistoryTable history={history} loadingHistory={loadingHistory} />
    </div>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────────

interface MetricCardProps { label: string; value: string; unit: string; }
const MetricCard: React.FC<MetricCardProps> = ({ label, value, unit }) => (
  <div className="p-4 rounded-xl bg-surface-secondary border border-border text-center">
    <p className="text-xs text-text-tertiary uppercase tracking-wide mb-1">{label}</p>
    <p className="text-xl font-bold text-navy-800 tabular-nums">{value} <span className="text-sm font-normal text-text-secondary">{unit}</span></p>
  </div>
);

interface HistoryTableProps { history: RehabExercise[]; loadingHistory: boolean; }
const HistoryTable: React.FC<HistoryTableProps> = ({ history, loadingHistory }) => (
  <div className="card">
    <div className="card-header">
      <h3 className="card-title">Exercise History</h3>
    </div>
    {loadingHistory ? (
      <div className="card-body">
        <div className="skeleton h-32 w-full" />
      </div>
    ) : history.length === 0 ? (
      <div className="card-body">
        <div className="empty-state">
          <Heart className="empty-state-icon mx-auto" />
          <p className="empty-state-title">No exercises recorded</p>
          <p className="empty-state-description">Complete rehabilitation exercises to build your history.</p>
        </div>
      </div>
    ) : (
      <div className="table-container">
        <table className="data-table" aria-label="Rehabilitation exercise history">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Duration</th>
              <th scope="col">Status</th>
              <th scope="col">Phases</th>
            </tr>
          </thead>
          <tbody>
            {history.map(ex => (
              <tr key={ex.id}>
                <td>{formatDate(ex.date)}</td>
                <td>{formatDuration(ex.totalDuration)}</td>
                <td>
                  <span className={`badge ${ex.status === 'completed' ? 'badge-success' : 'badge-neutral'}`}>
                    {ex.status === 'completed' ? 'Completed' : ex.status}
                  </span>
                </td>
                <td>{ex.phases.filter(p => p.completed).length}/{ex.phases.length} completed</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export default RehabilitationPage;

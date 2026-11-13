import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Play, Pause, Square, RotateCcw, CheckCircle, Hand,
  GripHorizontal, ArrowDown, Info, Clock, Heart,
} from 'lucide-react';
import { rehabService, settingsService } from '@/services';
import { formatDate, formatDuration } from '@/utils';
import type { RehabPhase, RehabSessionStatus, RehabExercise } from '@/types';

const PHASE_CONFIG: Record<RehabPhase, { label: string; instruction: string; icon: React.ReactNode; duration: number }> = {
  idle: { label: 'Ready', instruction: 'Press Start to begin the exercise.', icon: <Hand size={24} />, duration: 0 },
  pick_up: { label: 'Pick Up', instruction: 'Slowly close your hand around the object. Take your time.', icon: <GripHorizontal size={24} />, duration: 10 },
  hold: { label: 'Hold', instruction: 'Keep holding the object steadily. Maintain your grip.', icon: <Hand size={24} />, duration: 15 },
  release: { label: 'Release', instruction: 'Slowly open your hand and release the object.', icon: <ArrowDown size={24} />, duration: 8 },
  completed: { label: 'Completed', instruction: 'Well done! The exercise is complete.', icon: <CheckCircle size={24} />, duration: 0 },
};

const PHASE_ORDER: RehabPhase[] = ['pick_up', 'hold', 'release'];

const RehabilitationPage: React.FC = () => {
  const [currentPhase, setCurrentPhase] = useState<RehabPhase>('idle');
  const [sessionStatus, setSessionStatus] = useState<RehabSessionStatus>('not_started');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [phaseTime, setPhaseTime] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<Set<RehabPhase>>(new Set());
  const [history, setHistory] = useState<RehabExercise[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);
  const settings = settingsService.getSettings();

  // Load exercise history
  useEffect(() => {
    const load = async () => {
      setLoadingHistory(true);
      try {
        const exercises = await rehabService.getExercises('demo-patient-001');
        setHistory(exercises);
      } catch {
        // Silently handle — history is supplementary
      } finally {
        setLoadingHistory(false);
      }
    };
    load();
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    };
  }, []);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (phaseTimerRef.current) { clearInterval(phaseTimerRef.current); phaseTimerRef.current = null; }
  }, []);

  const startGlobalTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setElapsedTime(t => t + 1);
    }, 1000);
  }, []);

  const startPhaseTimer = useCallback(() => {
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    setPhaseTime(0);
    phaseTimerRef.current = setInterval(() => {
      setPhaseTime(t => t + 1);
    }, 1000);
  }, []);

  const pauseTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (phaseTimerRef.current) { clearInterval(phaseTimerRef.current); phaseTimerRef.current = null; }
  }, []);

  const handleStart = useCallback(() => {
    if (startedRef.current) return; // prevent double start
    startedRef.current = true;
    setSessionStatus('in_progress');
    setCurrentPhase('pick_up');
    setElapsedTime(0);
    setPhaseTime(0);
    setCompletedPhases(new Set());
    startGlobalTimer();
    startPhaseTimer();
  }, [startGlobalTimer, startPhaseTimer]);

  const handlePause = useCallback(() => {
    setSessionStatus('paused');
    pauseTimers();
  }, [pauseTimers]);

  const handleResume = useCallback(() => {
    setSessionStatus('in_progress');
    startGlobalTimer();
    startPhaseTimer();
  }, [startGlobalTimer, startPhaseTimer]);

  const handleNextPhase = useCallback(() => {
    const currentIdx = PHASE_ORDER.indexOf(currentPhase);
    if (currentIdx < 0) return;

    const newCompleted = new Set(completedPhases);
    newCompleted.add(currentPhase);
    setCompletedPhases(newCompleted);

    if (currentIdx < PHASE_ORDER.length - 1) {
      setCurrentPhase(PHASE_ORDER[currentIdx + 1]);
      setPhaseTime(0);
    } else {
      // Exercise complete
      setCurrentPhase('completed');
      setSessionStatus('completed');
      clearTimers();

      // Save to history
      const exercise: RehabExercise = {
        id: `rehab-${Date.now()}`,
        patientId: 'demo-patient-001',
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
  }, [currentPhase, completedPhases, clearTimers, elapsedTime]);

  const handleStop = useCallback(() => {
    clearTimers();
    setSessionStatus('cancelled');
    setCurrentPhase('idle');
    setElapsedTime(0);
    setPhaseTime(0);
    setCompletedPhases(new Set());
    startedRef.current = false;
  }, [clearTimers]);

  const handleReset = useCallback(() => {
    clearTimers();
    setSessionStatus('not_started');
    setCurrentPhase('idle');
    setElapsedTime(0);
    setPhaseTime(0);
    setCompletedPhases(new Set());
    startedRef.current = false;
  }, [clearTimers]);

  const config = PHASE_CONFIG[currentPhase];
  const isRunning = sessionStatus === 'in_progress';
  const isPaused = sessionStatus === 'paused';
  const isCompleted = sessionStatus === 'completed';
  const isNotStarted = sessionStatus === 'not_started' || sessionStatus === 'cancelled';

  return (
    <div>
      {settings.dataMode === 'demo' && (
        <div className="demo-banner" role="status">
          <Info size={16} aria-hidden="true" />
          <span>
            <strong>Demonstration Mode</strong> — This exercise interface is for demonstration.
            No physical sensor feedback is available without the NeuroGlove device.
          </span>
        </div>
      )}

      {/* Exercise Card */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title flex items-center gap-2">
            <Heart size={18} className="text-teal-600" />
            Rehabilitation Exercise: Pick Up → Hold → Release
          </h3>
          {(isRunning || isPaused) && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Clock size={14} />
              {formatDuration(elapsedTime)}
            </div>
          )}
        </div>
        <div className="card-body">
          {/* Progress Indicator */}
          <div className="rehab-progress mb-8" role="group" aria-label="Exercise progress">
            {PHASE_ORDER.map((phase, i) => (
              <React.Fragment key={phase}>
                {i > 0 && (
                  <div className={`rehab-connector ${completedPhases.has(PHASE_ORDER[i-1]) ? 'completed' : ''}`} />
                )}
                <div
                  className={`rehab-step ${
                    currentPhase === phase ? 'active' :
                    completedPhases.has(phase) ? 'completed' : ''
                  }`}
                  aria-label={`${PHASE_CONFIG[phase].label}: ${
                    completedPhases.has(phase) ? 'completed' :
                    currentPhase === phase ? 'current step' : 'pending'
                  }`}
                >
                  <div className="rehab-step-circle">
                    {completedPhases.has(phase)
                      ? <CheckCircle size={22} />
                      : <span>{i + 1}</span>}
                  </div>
                  <span className="rehab-step-label">{PHASE_CONFIG[phase].label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Current Phase Display */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
              isCompleted ? 'bg-success-50 text-success-600' :
              isRunning ? 'bg-teal-50 text-teal-600' :
              'bg-surface-tertiary text-text-tertiary'
            }`}>
              {config.icon}
            </div>
            <h4 className="text-xl font-semibold text-text-primary mb-2">{config.label}</h4>
            <p className="text-text-secondary max-w-md mx-auto text-lg">{config.instruction}</p>

            {(isRunning || isPaused) && currentPhase !== 'completed' && (
              <div className="mt-4 text-3xl font-bold tabular-nums text-navy-800" aria-live="polite">
                {phaseTime}s
                <span className="text-sm font-normal text-text-tertiary ml-2">
                  (suggested: {config.duration}s)
                </span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {isNotStarted && (
              <button className="btn btn-teal btn-lg" onClick={handleStart}>
                <Play size={20} />
                Start Exercise
              </button>
            )}

            {isRunning && (
              <>
                <button className="btn btn-secondary btn-lg" onClick={handlePause}>
                  <Pause size={20} />
                  Pause
                </button>
                <button className="btn btn-teal btn-lg" onClick={handleNextPhase}>
                  <CheckCircle size={20} />
                  {PHASE_ORDER.indexOf(currentPhase) === PHASE_ORDER.length - 1
                    ? 'Complete'
                    : `Next: ${PHASE_CONFIG[PHASE_ORDER[PHASE_ORDER.indexOf(currentPhase) + 1]]?.label || 'Done'}`}
                </button>
                <button className="btn btn-danger btn-lg" onClick={handleStop}>
                  <Square size={20} />
                  Stop
                </button>
              </>
            )}

            {isPaused && (
              <>
                <button className="btn btn-teal btn-lg" onClick={handleResume}>
                  <Play size={20} />
                  Resume
                </button>
                <button className="btn btn-danger btn-lg" onClick={handleStop}>
                  <Square size={20} />
                  Stop
                </button>
              </>
            )}

            {isCompleted && (
              <button className="btn btn-secondary btn-lg" onClick={handleReset}>
                <RotateCcw size={20} />
                Start New Exercise
              </button>
            )}
          </div>

          {isCompleted && (
            <div className="mt-6 p-4 rounded-lg bg-success-50 border border-success-100 text-center" role="status">
              <CheckCircle size={24} className="text-success-600 mx-auto mb-2" />
              <p className="text-success-700 font-medium">Exercise completed successfully!</p>
              <p className="text-success-600 text-sm mt-1">
                Total time: {formatDuration(elapsedTime)}
              </p>
            </div>
          )}

          {/* Sensor feedback note */}
          <div className="mt-6 p-3 rounded-lg bg-surface-tertiary">
            <p className="text-xs text-text-tertiary">
              <strong>Note:</strong> This interface guides exercise timing. Grip measurements from
              the FSR sensor and flex sensors would be recorded when the NeuroGlove device is
              connected. The vibration motor feedback is controlled by the device hardware and is
              not available through this interface.
            </p>
          </div>
        </div>
      </div>

      {/* Exercise History */}
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
              <p className="empty-state-description">
                Complete rehabilitation exercises to build your history.
              </p>
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
                    <td>
                      {ex.phases.filter(p => p.completed).length}/{ex.phases.length} completed
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RehabilitationPage;

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Wifi, WifiOff, Play, Pause, Radio, AlertTriangle,
  Info, Clock,
} from 'lucide-react';
import { sensorService, settingsService } from '@/services';
import { formatTime, isStale, formatNumber } from '@/utils';
import type { SensorReading, ConnectionStatus } from '@/types';

const MAX_CHART_POINTS = 60;

const LiveMonitoringPage: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    sensorService.getConnectionStatus()
  );
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settings = settingsService.getSettings();
  const pauseRef = useRef(isPaused);
  pauseRef.current = isPaused;

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await sensorService.connect();
      setConnectionStatus('connected');
    } catch {
      setError('Failed to connect to device. This is a demo — no real device is available.');
      setConnectionStatus('error');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    await sensorService.disconnect();
    setConnectionStatus('disconnected');
    setReadings([]);
    setLatestReading(null);
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused(p => !p);
  }, []);

  // Subscribe to readings
  useEffect(() => {
    const unsubscribe = sensorService.onReading((reading) => {
      setLatestReading(reading);
      if (!pauseRef.current) {
        setReadings(prev => {
          const next = [...prev, reading];
          return next.length > MAX_CHART_POINTS ? next.slice(-MAX_CHART_POINTS) : next;
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sensorService.disconnect();
    };
  }, []);

  const lastTimestamp = latestReading?.timestamp ?? null;
  const dataIsStale = isStale(lastTimestamp, settings.staleDataThreshold);

  // Chart data
  const accelChartData = readings.map((r, i) => ({
    idx: i,
    handAx: r.handIMU?.ax ?? null,
    handAy: r.handIMU?.ay ?? null,
    forearmAx: r.forearmIMU?.ax ?? null,
    diffAx: r.differentialIMU?.ax ?? null,
    diffAy: r.differentialIMU?.ay ?? null,
  }));

  const gyroChartData = readings.map((r, i) => ({
    idx: i,
    handGx: r.handIMU?.gx ?? null,
    forearmGx: r.forearmIMU?.gx ?? null,
    diffGx: r.differentialIMU?.gx ?? null,
  }));

  const flexChartData = readings.map((r, i) => ({
    idx: i,
    flex1: r.flexSensor1,
    flex2: r.flexSensor2,
    fsr: r.fsrReading,
  }));

  return (
    <div>
      {/* Demo Banner */}
      {settings.dataMode === 'demo' && (
        <div className="demo-banner" role="status">
          <Info size={16} aria-hidden="true" />
          <span>
            <strong>Demonstration Mode</strong> — Sensor readings are simulated. No physical device is connected.
          </span>
        </div>
      )}

      {/* Connection Controls */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`status-dot ${
                connectionStatus === 'connected' ? 'status-dot-connected' :
                connectionStatus === 'connecting' ? 'status-dot-connecting' :
                connectionStatus === 'error' ? 'status-dot-error' :
                'status-dot-disconnected'
              }`} aria-hidden="true" />
              <div>
                <p className="font-medium text-text-primary">
                  {connectionStatus === 'connected' ? 'Connected' :
                   connectionStatus === 'connecting' ? 'Connecting…' :
                   connectionStatus === 'error' ? 'Connection Error' :
                   'Disconnected'}
                </p>
                <p className="text-sm text-text-tertiary">
                  {connectionStatus === 'connected'
                    ? `Last data: ${dataIsStale ? 'Stale — waiting for new data' : formatTime(lastTimestamp)}`
                    : 'Demo streaming — simulated sensor data'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {connectionStatus !== 'connected' ? (
                <button
                  className="btn btn-teal"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  aria-label="Start demo streaming"
                >
                  <Wifi size={16} />
                  {isConnecting ? 'Connecting…' : 'Start Demo Stream'}
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={togglePause}
                    aria-label={isPaused ? 'Resume display updates' : 'Pause display updates'}
                  >
                    {isPaused ? <Play size={16} /> : <Pause size={16} />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleDisconnect}
                    aria-label="Stop demo streaming"
                  >
                    <WifiOff size={16} />
                    Stop
                  </button>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-3 p-3 rounded-lg bg-danger-50 border border-danger-100 text-danger-700 text-sm flex items-center gap-2">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {connectionStatus === 'connected' && dataIsStale && latestReading && (
            <div className="mt-3 p-3 rounded-lg bg-warning-50 border border-warning-100 text-warning-700 text-sm flex items-center gap-2" role="alert">
              <Clock size={16} />
              Data may be stale. The last reading was received more than {Math.round(settings.staleDataThreshold / 1000)} seconds ago.
            </div>
          )}

          {isPaused && connectionStatus === 'connected' && (
            <div className="mt-3 p-3 rounded-lg bg-navy-50 border border-navy-100 text-navy-700 text-sm flex items-center gap-2" role="status">
              <Pause size={16} />
              Display updates paused. Data is still being received in the background.
            </div>
          )}
        </div>
      </div>

      {connectionStatus !== 'connected' && !isConnecting && (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <Radio className="empty-state-icon mx-auto" />
              <p className="empty-state-title">No active data stream</p>
              <p className="empty-state-description">
                Start the demo stream to see simulated sensor readings, or connect a NeuroGlove device when available.
              </p>
              <button className="btn btn-teal mt-4" onClick={handleConnect}>
                <Wifi size={16} />
                Start Demo Stream
              </button>
            </div>
          </div>
        </div>
      )}

      {connectionStatus === 'connected' && (
        <>
          {/* Latest Values */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <SensorValue
              label="Hand Accel X"
              value={latestReading?.handIMU?.ax}
              unit="m/s²"
            />
            <SensorValue
              label="Hand Accel Y"
              value={latestReading?.handIMU?.ay}
              unit="m/s²"
            />
            <SensorValue
              label="Forearm Accel X"
              value={latestReading?.forearmIMU?.ax}
              unit="m/s²"
            />
            <SensorValue
              label="Diff Accel X"
              value={latestReading?.differentialIMU?.ax}
              unit="m/s²"
            />
            <SensorValue
              label="Flex Sensor 1"
              value={latestReading?.flexSensor1}
              unit="raw"
            />
            <SensorValue
              label="FSR (Grip)"
              value={latestReading?.fsrReading}
              unit="raw"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Acceleration Chart — Differential IMU */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Acceleration — Differential IMU</h3>
              </div>
              <div className="card-body">
                <p className="text-xs text-text-tertiary mb-3">
                  Shows the difference between hand and forearm accelerometer readings (hand − forearm).
                  This aims to isolate hand-specific motion from overall arm movement.
                </p>
                {accelChartData.length < 2 ? (
                  <p className="text-sm text-text-tertiary text-center py-8">Waiting for data…</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={accelChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="idx" tick={false} axisLine={{ stroke: '#e2e8f0' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={45} />
                      <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                      <Line type="monotone" dataKey="handAx" name="Hand X" stroke="#178285" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="forearmAx" name="Forearm X" stroke="#94a3b8" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="diffAx" name="Diff X" stroke="#dc2626" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Gyroscope Chart */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Gyroscope — Differential IMU</h3>
              </div>
              <div className="card-body">
                <p className="text-xs text-text-tertiary mb-3">
                  Angular velocity difference between hand and forearm sensors.
                </p>
                {gyroChartData.length < 2 ? (
                  <p className="text-sm text-text-tertiary text-center py-8">Waiting for data…</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={gyroChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="idx" tick={false} axisLine={{ stroke: '#e2e8f0' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={45} />
                      <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                      <Line type="monotone" dataKey="handGx" name="Hand Gx" stroke="#178285" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="forearmGx" name="Forearm Gx" stroke="#94a3b8" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="diffGx" name="Diff Gx" stroke="#d97706" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Flex + FSR Chart */}
          <div className="card mb-6">
            <div className="card-header">
              <h3 className="card-title">Flex Sensors & FSR (Grip Pressure)</h3>
            </div>
            <div className="card-body">
              <p className="text-xs text-text-tertiary mb-3">
                Flex sensor readings indicate finger bend. FSR reading indicates grip contact pressure (FSR402).
              </p>
              {flexChartData.length < 2 ? (
                <p className="text-sm text-text-tertiary text-center py-8">Waiting for data…</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={flexChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="idx" tick={false} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={45} domain={[0, 1023]} />
                    <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Line type="monotone" dataKey="flex1" name="Flex 1" stroke="#178285" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="flex2" name="Flex 2" stroke="#4a6498" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="fsr" name="FSR (Grip)" stroke="#d97706" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Sampling Info */}
          <div className="card">
            <div className="card-body">
              <div className="flex flex-wrap gap-6 text-sm text-text-secondary">
                <div>
                  <span className="font-medium">Sampling Rate:</span>{' '}
                  {connectionStatus === 'connected' ? '5 Hz (demo)' : '—'}
                </div>
                <div>
                  <span className="font-medium">Buffer:</span>{' '}
                  {readings.length} / {MAX_CHART_POINTS} points
                </div>
                <div>
                  <span className="font-medium">Mode:</span>{' '}
                  <span className="badge badge-warning">Demo Streaming</span>
                </div>
                <div>
                  <span className="font-medium">Last Received:</span>{' '}
                  {lastTimestamp ? formatTime(lastTimestamp) : '—'}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ---- Sub-components ----

function SensorValue({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
}) {
  const display = value != null && Number.isFinite(value) ? formatNumber(value, 2) : '—';
  return (
    <div className="metric-card" style={{ padding: '0.875rem 1rem' }}>
      <div className="text-xs font-medium text-text-secondary mb-1">{label}</div>
      <div className="text-lg font-bold text-text-primary tabular-nums">
        {display}
        {value != null && <span className="text-xs font-normal text-text-tertiary ml-1">{unit}</span>}
      </div>
    </div>
  );
}

export default LiveMonitoringPage;

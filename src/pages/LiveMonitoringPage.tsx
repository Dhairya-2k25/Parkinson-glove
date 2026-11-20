import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Wifi, WifiOff, Play, Pause, Radio, AlertTriangle,
  Clock, Usb, Bluetooth, Cpu, CheckCircle2, Square,
} from 'lucide-react';
import { sensorService, settingsService, alertService } from '@/services';
import { formatTime, isStale, formatNumber } from '@/utils';
import type { SensorReading, ConnectionStatus } from '@/types';

const MAX_CHART_POINTS = 60;

const LiveMonitoringPage: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(sensorService.getConnectionStatus());
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [isPaused, setIsPaused] = useState(sensorService.isPaused());
  const [isConnecting, setIsConnecting] = useState(false);
  const [isStreaming, setIsStreaming] = useState<boolean>((sensorService as any).isStreaming?.() || false);
  const [error, setError] = useState<string | null>(null);
  const [hardwareConnected, setHardwareConnected] = useState<boolean>((sensorService as any).isHardwareConnected?.() || false);
  const [deviceName, setDeviceName] = useState<string>((sensorService as any).getDeviceName?.() || 'ESP32 Device');
  const [espConnecting, setEspConnecting] = useState(false);
  const settings = settingsService.getSettings();
  const lastAlertAtRef = useRef(0);
  const pauseRef = useRef(isPaused);
  pauseRef.current = isPaused;

  const handleStartStreaming = useCallback(() => {
    (sensorService as any).startMonitoring?.();
    setIsStreaming(true);
    setConnectionStatus('connected');
  }, []);

  const handleStopStreaming = useCallback(() => {
    (sensorService as any).stopMonitoring?.();
    setIsStreaming(false);
    setConnectionStatus('disconnected');
    setReadings([]);
    setLatestReading(null);
  }, []);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await sensorService.connect();
      setConnectionStatus('connected');
    } catch {
      setError('Failed to connect to device.');
      setConnectionStatus('error');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    handleStopStreaming();
    await sensorService.disconnect();
    setConnectionStatus('disconnected');
    setReadings([]);
    setLatestReading(null);
  }, [handleStopStreaming]);

  const handleConnectSerial = async () => {
    setEspConnecting(true);
    setError(null);
    try {
      await (sensorService as any).connectESP32Serial();
      setHardwareConnected(true);
      setIsStreaming(true);
      setDeviceName((sensorService as any).getDeviceName?.() || 'ESP32 (USB Serial)');
    } catch (err: any) {
      if (err?.name !== 'NotFoundError') {
        setError(err?.message || 'Failed to connect via USB Serial');
      }
    } finally {
      setEspConnecting(false);
    }
  };

  const handleConnectBLE = async () => {
    setEspConnecting(true);
    setError(null);
    try {
      await (sensorService as any).connectESP32BLE();
      setHardwareConnected(true);
      setIsStreaming(true);
      setDeviceName((sensorService as any).getDeviceName?.() || 'ESP32 (BLE)');
    } catch (err: any) {
      if (err?.name !== 'NotFoundError') {
        setError(err?.message || 'Failed to connect via Bluetooth');
      }
    } finally {
      setEspConnecting(false);
    }
  };

  const handleDisconnectHardware = async () => {
    await (sensorService as any).disconnectESP32?.();
    setHardwareConnected(false);
    setIsStreaming(false);
    setConnectionStatus('disconnected');
    setReadings([]);
    setLatestReading(null);
  };

  const togglePause = useCallback(() => {
    if (sensorService.isPaused()) sensorService.resume();
    else sensorService.pause();
  }, []);

  // Keep this page synchronized with the shared stream, even when Rehab started it.
  useEffect(() => sensorService.onStatusChange((status, paused) => {
    setConnectionStatus(status);
    setIsPaused(paused);
    setIsStreaming((sensorService as any).isStreaming?.() || false);
    setHardwareConnected((sensorService as any).isHardwareConnected?.() || false);
    setDeviceName((sensorService as any).getDeviceName?.() || 'ESP32 Device');
  }), []);

  // Subscribe to readings
  useEffect(() => {
    const unsubscribe = sensorService.onReading((reading) => {
      setLatestReading(reading);
      // Observational movement-activity threshold; not a clinical diagnosis.
      const gyro = reading.differentialIMU;
      const activity = gyro ? Math.sqrt(gyro.gx * gyro.gx + gyro.gy * gyro.gy + gyro.gz * gyro.gz) : 0;
      const now = Date.now();
      if (activity > 12 && now - lastAlertAtRef.current > 15000) {
        lastAlertAtRef.current = now;
        void alertService.createTremorAlert(activity, settings.dataMode === 'demo' ? 'demo' : 'live');
      }
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
  }, [settings.dataMode]);

  // Do not disconnect on page navigation: Rehab and Monitoring share one stream.

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
      {/* Subtle source disclosure */}
      {settings.dataMode === 'demo' && (
        <div className="flex justify-end mb-3">
          <span className="text-xs text-text-tertiary" title="Illustrative generated sensor values">Simulation data</span>
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
                <p className="font-semibold text-text-primary flex items-center gap-1.5">
                  {connectionStatus === 'connected' ? (
                    hardwareConnected ? (
                      <>
                        <CheckCircle2 size={16} className="text-teal-600 inline" />
                        <span>ESP32 Hardware Connected</span>
                        <span className="badge badge-success text-xs font-mono ml-1">{deviceName}</span>
                      </>
                    ) : (
                      <>
                        <Cpu size={16} className="text-teal-600 inline" />
                        <span>ESP32 Connected</span>
                        <span className="badge badge-info text-xs ml-1">Live Feed</span>
                      </>
                    )
                  ) : connectionStatus === 'connecting' ? (
                    'Connecting to ESP32…'
                  ) : (
                    <>
                      <WifiOff size={16} className="text-danger-500 inline" />
                      <span>ESP32 Not Connected</span>
                    </>
                  )}
                </p>
                <p className="text-sm text-text-tertiary">
                  {hardwareConnected
                    ? `Live physical glove sensor stream active (${deviceName})`
                    : isStreaming
                    ? `Live sensor stream running — updating charts in real time`
                    : `Device not connected — Click "Start Monitoring" to connect and begin stream`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isStreaming ? (
                <button
                  className="btn btn-teal text-xs"
                  onClick={handleStartStreaming}
                  title="Start live sensor stream"
                >
                  <Play size={14} />
                  Start Monitoring
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-secondary text-xs"
                    onClick={togglePause}
                    aria-label={isPaused ? 'Resume display updates' : 'Pause display updates'}
                  >
                    {isPaused ? <Play size={14} /> : <Pause size={14} />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    className="btn btn-danger text-xs"
                    onClick={handleStopStreaming}
                    title="Stop live monitoring"
                  >
                    <Square size={14} />
                    Stop Monitoring
                  </button>
                </>
              )}

              {!hardwareConnected ? (
                <>
                  <button
                    className="btn btn-secondary text-xs"
                    onClick={handleConnectSerial}
                    disabled={espConnecting}
                    title="Connect ESP32 via USB cable (Web Serial)"
                  >
                    <Usb size={14} />
                    {espConnecting ? 'Connecting…' : 'Pair ESP32 (USB)'}
                  </button>
                  <button
                    className="btn btn-secondary text-xs"
                    onClick={handleConnectBLE}
                    disabled={espConnecting}
                    title="Connect ESP32 via Bluetooth (Web BLE)"
                  >
                    <Bluetooth size={14} />
                    Pair ESP32 (Bluetooth)
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-danger text-xs"
                  onClick={handleDisconnectHardware}
                  title="Disconnect physical ESP32"
                >
                  <WifiOff size={14} />
                  Disconnect ESP32
                </button>
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

      {!isStreaming && (
        <div className="card">
          <div className="card-body">
            <div className="empty-state py-12">
              <Radio className="empty-state-icon mx-auto text-teal-600 mb-3" size={40} />
              <p className="empty-state-title">
                {connectionStatus === 'connected' ? 'Live Sensor Stream Inactive' : 'ESP32 Device Not Connected'}
              </p>
              <p className="empty-state-description max-w-md mx-auto">
                {connectionStatus === 'connected'
                  ? 'Device connected and calibrated. Click "Start Monitoring" to initiate real-time sensor data streaming and graphs.'
                  : 'Device is currently not connected. Click "Start Monitoring" to connect and begin live real-time sensor streaming, or pair your ESP32 glove via USB or Bluetooth.'}
              </p>
              <div className="flex justify-center gap-3 mt-5">
                <button className="btn btn-teal btn-lg" onClick={handleStartStreaming}>
                  <Play size={18} />
                  Start Monitoring
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {connectionStatus === 'connected' && isStreaming && (
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
                  <span className="badge badge-neutral">Simulation</span>
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

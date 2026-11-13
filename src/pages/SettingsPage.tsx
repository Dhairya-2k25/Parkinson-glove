import React, { useState } from 'react';
import { Wifi, WifiOff, Battery, Signal, Cpu, Info, AlertTriangle, Monitor, Settings } from 'lucide-react';
import { settingsService } from '@/services';
import type { AppSettings, ConnectionStatus } from '@/types';

// ---- Sub-components ----

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3 mt-1">
      {children}
    </h3>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && (
          <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleSwitch({
  id,
  checked,
  onChange,
  disabled = false,
}: {
  id: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        position: 'relative',
        display: 'inline-flex',
        height: '1.5rem',
        width: '2.75rem',
        alignItems: 'center',
        borderRadius: '9999px',
        background: checked ? 'var(--color-teal-600)' : 'var(--color-border-strong)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.2s',
        padding: 0,
      }}
    >
      <span className="sr-only">{checked ? 'Enabled' : 'Disabled'}</span>
      <span
        style={{
          display: 'inline-block',
          height: '1rem',
          width: '1rem',
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          transform: checked ? 'translateX(1.5rem)' : 'translateX(0.25rem)',
          transition: 'transform 0.2s',
        }}
      />
    </button>
  );
}

function SensorStatusBadge({ available }: { available: boolean }) {
  return (
    <span className={`badge ${available ? 'badge-success' : 'badge-neutral'}`}>
      {available ? 'Available' : 'Unavailable'}
    </span>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-1.5 border-b border-border last:border-0">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="text-sm text-text-primary">{value}</p>
    </div>
  );
}

// ---- Device info (prototype — all nullable fields show 'Unavailable' without real device) ----

interface DeviceInfo {
  id: string;
  name: string;
  firmwareVersion: string | null;
  batteryLevel: number | null;
  signalStrength: number | null;
  connectionStatus: ConnectionStatus;
}

const DEVICE_INFO: DeviceInfo = {
  id: 'NG-DEMO-0001',
  name: 'NeuroGlove Dev Unit',
  firmwareVersion: null,
  batteryLevel: null,
  signalStrength: null,
  connectionStatus: 'disconnected',
};

const SENSORS = [
  { label: 'IMU 1 — Hand (MPU6050)', key: 'imu1' },
  { label: 'IMU 2 — Forearm (MPU6050)', key: 'imu2' },
  { label: 'Flex Sensor 1', key: 'flex1' },
  { label: 'Flex Sensor 2', key: 'flex2' },
  { label: 'FSR — Force Sensitive Resistor (FSR402)', key: 'fsr' },
  { label: 'Vibration Motor Feedback', key: 'vibration' },
];

// ---- Main Page ----

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => settingsService.getSettings());
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = settingsService.updateSettings({ [key]: value });
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isConnected = DEVICE_INFO.connectionStatus === 'connected';

  return (
    <div className="max-w-3xl">
      {/* Auto-saved indicator */}
      {saved && (
        <div
          className="mb-4 px-4 py-2 rounded-lg border text-sm flex items-center gap-2"
          style={{
            background: 'var(--color-success-50)',
            borderColor: 'var(--color-success-100)',
            color: 'var(--color-success-700)',
          }}
          role="status"
          aria-live="polite"
        >
          <Settings size={14} />
          Settings saved automatically
        </div>
      )}

      {/* Demo mode notice */}
      {settings.dataMode === 'demo' && (
        <div className="demo-banner" role="note">
          <Info size={16} aria-hidden="true" />
          <span>
            <strong>Demonstration Mode</strong> — This prototype runs entirely in-browser.
            Some settings below have no effect without a connected NeuroGlove device.
          </span>
        </div>
      )}

      {/* ---- Device Status ---- */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="card-title flex items-center gap-2">
            <Cpu size={18} />
            Device Status
          </h2>
        </div>
        <div className="card-body">
          <SectionTitle>Connection</SectionTitle>

          <SettingRow label="Device ID" description="Unique identifier for the paired NeuroGlove unit">
            <span className="text-sm font-mono text-text-primary">{DEVICE_INFO.id}</span>
          </SettingRow>

          <SettingRow label="Connection Status">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi size={16} className="text-success-600" />
              ) : (
                <WifiOff size={16} className="text-text-tertiary" />
              )}
              <span className={`badge ${isConnected ? 'badge-success' : 'badge-neutral'}`}>
                {isConnected ? 'Connected' : 'Disconnected (Demo Mode)'}
              </span>
            </div>
          </SettingRow>

          <SettingRow
            label="Firmware Version"
            description="Device firmware version — requires physical device to read"
          >
            <span className="text-sm text-text-tertiary">
              {DEVICE_INFO.firmwareVersion ?? 'Unavailable'}
            </span>
          </SettingRow>

          <SettingRow label="Battery Level" description="Remaining battery charge — requires physical device">
            <div className="flex items-center gap-2 text-sm text-text-tertiary">
              <Battery size={16} />
              {DEVICE_INFO.batteryLevel != null ? `${DEVICE_INFO.batteryLevel}%` : 'Unavailable'}
            </div>
          </SettingRow>

          <SettingRow label="Signal Strength" description="Wireless signal quality — requires physical device">
            <div className="flex items-center gap-2 text-sm text-text-tertiary">
              <Signal size={16} />
              {DEVICE_INFO.signalStrength != null
                ? `${DEVICE_INFO.signalStrength} dBm`
                : 'Unavailable'}
            </div>
          </SettingRow>

          <SectionTitle>Sensor Availability</SectionTitle>
          <p className="text-xs text-text-tertiary mb-3 leading-relaxed">
            Sensor availability is reported by the NeuroGlove hardware. All sensors show
            "Unavailable" in demonstration mode as no physical device is connected.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SENSORS.map(sensor => (
              <div
                key={sensor.key}
                className="flex items-center justify-between p-2.5 rounded-lg"
                style={{ background: 'var(--color-surface-tertiary)' }}
              >
                <span className="text-sm text-text-primary">{sensor.label}</span>
                <SensorStatusBadge available={false} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Application Preferences ---- */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="card-title flex items-center gap-2">
            <Monitor size={18} />
            Application Preferences
          </h2>
        </div>
        <div className="card-body">
          <SectionTitle>Display</SectionTitle>

          <SettingRow
            label="Show Demonstration Label"
            description="Display a banner on each page reminding that data is simulated"
          >
            <ToggleSwitch
              id="toggle-demo-label"
              checked={settings.showDemoLabel}
              onChange={val => update('showDemoLabel', val)}
            />
          </SettingRow>

          <SettingRow
            label="Reduced Motion"
            description="Minimise animations and transitions throughout the interface"
          >
            <ToggleSwitch
              id="toggle-reduced-motion"
              checked={settings.reducedMotion}
              onChange={val => update('reducedMotion', val)}
            />
          </SettingRow>

          <SectionTitle>Live Monitoring</SectionTitle>

          <SettingRow
            label="Chart Refresh Rate"
            description="How often live charts redraw (lower value = smoother, more CPU)"
          >
            <select
              id="chart-refresh-rate"
              className="form-input form-select"
              style={{ width: 'auto', minWidth: '160px' }}
              value={settings.chartRefreshRate}
              onChange={e => update('chartRefreshRate', Number(e.target.value))}
              aria-label="Chart refresh rate"
            >
              <option value={100}>100 ms (10 Hz)</option>
              <option value={200}>200 ms (5 Hz)</option>
              <option value={500}>500 ms (2 Hz)</option>
              <option value={1000}>1000 ms (1 Hz)</option>
            </select>
          </SettingRow>

          <SettingRow
            label="Stale Data Threshold"
            description="Warn when no sensor reading has been received within this duration"
          >
            <select
              id="stale-threshold"
              className="form-input form-select"
              style={{ width: 'auto', minWidth: '160px' }}
              value={settings.staleDataThreshold}
              onChange={e => update('staleDataThreshold', Number(e.target.value))}
              aria-label="Stale data threshold"
            >
              <option value={2000}>2 seconds</option>
              <option value={5000}>5 seconds</option>
              <option value={10000}>10 seconds</option>
              <option value={30000}>30 seconds</option>
            </select>
          </SettingRow>

          <SettingRow
            label="Auto-Reconnect"
            description="Automatically attempt to reconnect if the device connection drops"
          >
            <ToggleSwitch
              id="toggle-auto-reconnect"
              checked={settings.autoReconnect}
              onChange={val => update('autoReconnect', val)}
            />
          </SettingRow>

          <SectionTitle>Alerts & Notifications</SectionTitle>

          <SettingRow
            label="Notifications Enabled"
            description="Receive in-app notifications for new caregiver alerts"
          >
            <ToggleSwitch
              id="toggle-notifications"
              checked={settings.notificationsEnabled}
              onChange={val => update('notificationsEnabled', val)}
            />
          </SettingRow>

          <SettingRow
            label="Alert Sound"
            description="Play a sound when a high-severity alert is generated (requires physical device)"
          >
            <ToggleSwitch
              id="toggle-alert-sound"
              checked={settings.alertSoundEnabled}
              onChange={val => update('alertSoundEnabled', val)}
            />
          </SettingRow>
        </div>
      </div>

      {/* ---- About ---- */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title flex items-center gap-2">
            <Info size={18} />
            About NeuroGlove
          </h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <AboutRow label="Application" value="NeuroGlove Frontend" />
            <AboutRow label="Version" value="1.0.0 — Prototype" />
            <AboutRow label="Data Mode" value="Demonstration (Simulated Data)" />
            <AboutRow label="Project Type" value="College Capstone 2026" />
          </div>

          <div
            className="p-4 rounded-lg"
            style={{ background: 'var(--color-surface-tertiary)' }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} style={{ color: 'var(--color-warning-600)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <p className="text-sm font-semibold text-text-primary mb-1">Medical Disclaimer</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  NeuroGlove is a research and rehabilitation-support prototype. It is not a
                  certified medical device and is not approved for clinical diagnosis. All sensor
                  data, trends, and alerts are observational only. No information presented by
                  this application should be used as the basis for any medical decision without
                  consultation with a qualified healthcare professional.
                </p>
                <p className="text-xs text-text-secondary leading-relaxed mt-2">
                  This application is intended for use under supervision of a clinician or trained
                  caregiver as part of a structured monitoring programme.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

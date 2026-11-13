// ============================================================
// NeuroGlove — Utility Functions
// ============================================================

import type { AssessmentType, AlertType, AlertSeverity, AlertStatus, SessionStatus, BaselineComparison } from '@/types';

// ---- Date / Time ----

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diffMs = now - then;
    if (diffMs < 0) return 'just now';
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return formatDate(iso);
  } catch {
    return '—';
  }
}

export function isStale(iso: string | null | undefined, thresholdMs: number): boolean {
  if (!iso) return true;
  try {
    return Date.now() - new Date(iso).getTime() > thresholdMs;
  } catch {
    return true;
  }
}

// ---- Numbers ----

export function formatNumber(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(decimals);
}

export function safePercentageChange(
  baseline: number | null | undefined,
  current: number | null | undefined
): number | null {
  if (baseline == null || current == null) return null;
  if (!Number.isFinite(baseline) || !Number.isFinite(current)) return null;
  if (baseline === 0) return null; // avoid division by zero
  return ((current - baseline) / Math.abs(baseline)) * 100;
}

export function computeBaselineComparison(
  metric: string,
  unit: string,
  baselineValue: number | null | undefined,
  currentValue: number | null | undefined
): BaselineComparison {
  const bv = baselineValue != null && Number.isFinite(baselineValue) ? baselineValue : null;
  const cv = currentValue != null && Number.isFinite(currentValue) ? currentValue : null;

  let absoluteDifference: number | null = null;
  let percentageChange: number | null = null;
  let direction: BaselineComparison['direction'] = 'unavailable';

  if (bv != null && cv != null) {
    absoluteDifference = +(cv - bv).toFixed(3);
    percentageChange = safePercentageChange(bv, cv);
    if (absoluteDifference > 0.001) direction = 'increased';
    else if (absoluteDifference < -0.001) direction = 'decreased';
    else direction = 'unchanged';
  }

  return {
    metric,
    unit,
    baselineValue: bv,
    currentValue: cv,
    absoluteDifference,
    percentageChange,
    direction,
  };
}

// ---- Labels ----

const ASSESSMENT_LABELS: Record<AssessmentType, string> = {
  tremor_assessment: 'Tremor Assessment',
  grip_assessment: 'Grip Assessment',
  finger_tap: 'Finger Tap Test',
  full_assessment: 'Full Assessment',
  rehabilitation: 'Rehabilitation',
};

export function assessmentTypeLabel(type: AssessmentType | string): string {
  return ASSESSMENT_LABELS[type as AssessmentType] ?? type.replace(/_/g, ' ');
}

const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  completed: 'Completed',
  in_progress: 'In Progress',
  incomplete: 'Incomplete',
  cancelled: 'Cancelled',
};

export function sessionStatusLabel(status: SessionStatus | string): string {
  return SESSION_STATUS_LABELS[status as SessionStatus] ?? status;
}

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  failed_grasp: 'Failed Grasp',
  tremor_spike: 'Tremor Spike',
  device_disconnected: 'Device Disconnected',
  missed_session: 'Missed Session',
};

export function alertTypeLabel(type: AlertType | string): string {
  return ALERT_TYPE_LABELS[type as AlertType] ?? type.replace(/_/g, ' ');
}

const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export function alertSeverityLabel(severity: AlertSeverity | string): string {
  return ALERT_SEVERITY_LABELS[severity as AlertSeverity] ?? severity;
}

const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  new: 'New',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

export function alertStatusLabel(status: AlertStatus | string): string {
  return ALERT_STATUS_LABELS[status as AlertStatus] ?? status;
}

// ---- CSV ----

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---- Validation ----

export function isValidDateRange(from: string, to: string): boolean {
  if (!from || !to) return true;
  try {
    return new Date(from).getTime() <= new Date(to).getTime();
  } catch {
    return false;
  }
}

// ---- Classnames helper ----

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

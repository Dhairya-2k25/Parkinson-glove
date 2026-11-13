import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft, Download, Clock, AlertTriangle, Info,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import { sessionService, patientService, settingsService } from '@/services';
import {
  formatDate, formatDateTime, formatDuration, formatNumber,
  assessmentTypeLabel, sessionStatusLabel, downloadCSV,
  computeBaselineComparison,
} from '@/utils';
import type { Session, BaselineMeasurement, BaselineComparison } from '@/types';

const SessionDetailPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [baseline, setBaseline] = useState<BaselineMeasurement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const settings = settingsService.getSettings();

  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const [s, b] = await Promise.all([
        sessionService.getSession(sessionId),
        patientService.getBaseline('demo-patient-001'),
      ]);
      setSession(s);
      setBaseline(b);
    } catch {
      setError('Unable to load session details.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = useCallback(async () => {
    if (!session) return;
    setExporting(true);
    try {
      const csv = sessionService.exportSessionCSV(session);
      const filename = `neuroglove_session_${session.id}_${formatDate(session.date).replace(/\s/g, '_')}.csv`;
      downloadCSV(csv, filename);
    } catch {
      setError('Failed to export CSV.');
    } finally {
      setExporting(false);
    }
  }, [session]);

  // Baseline comparisons
  const comparisons: BaselineComparison[] = (baseline && session) ? [
    computeBaselineComparison('Tremor Amplitude', 'mm', baseline.tremorAmplitude, session.tremorAmplitude),
    computeBaselineComparison('Tremor Frequency', 'Hz', baseline.tremorFrequency, session.tremorFrequency),
    computeBaselineComparison('Grip Strength', 'raw', baseline.gripStrength, session.gripStrength),
  ] : [];

  if (loading) {
    return (
      <div>
        <div className="skeleton h-8 w-48 mb-4" />
        <div className="card">
          <div className="card-body">
            <div className="skeleton h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div>
        <Link to="/sessions" className="btn btn-ghost mb-4">
          <ArrowLeft size={16} /> Back to Sessions
        </Link>
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <AlertTriangle className="empty-state-icon text-danger-500 mx-auto" />
              <p className="empty-state-title">
                {session === null ? 'Session not found' : 'Unable to load session'}
              </p>
              <p className="empty-state-description">
                {error || 'The requested session could not be found.'}
              </p>
              <Link to="/sessions" className="btn btn-primary mt-4">
                Back to Sessions
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chart data from readings
  const accelData = session.readings.map((r, i) => ({
    idx: i,
    handAx: r.handIMU?.ax ?? null,
    forearmAx: r.forearmIMU?.ax ?? null,
    diffAx: r.differentialIMU?.ax ?? null,
  }));

  const flexData = session.readings.map((r, i) => ({
    idx: i,
    flex1: r.flexSensor1,
    flex2: r.flexSensor2,
    fsr: r.fsrReading,
  }));

  const statusCls = session.status === 'completed' ? 'badge-success'
    : session.status === 'in_progress' ? 'badge-info'
    : session.status === 'incomplete' ? 'badge-warning'
    : 'badge-neutral';

  return (
    <div>
      {settings.dataMode === 'demo' && (
        <div className="demo-banner" role="status">
          <Info size={16} aria-hidden="true" />
          <span><strong>Demonstration Mode</strong> — This session contains simulated data.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link to="/sessions" className="btn btn-ghost btn-icon" aria-label="Back to sessions">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {assessmentTypeLabel(session.assessmentType)}
            </h2>
            <p className="text-sm text-text-secondary">{formatDateTime(session.date)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`badge ${statusCls}`}>{sessionStatusLabel(session.status)}</span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExport}
            disabled={exporting || session.readings.length === 0}
            aria-label="Export session data as CSV"
          >
            <Download size={14} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Session Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card lg:col-span-2">
          <div className="card-header">
            <h3 className="card-title">Session Summary</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <InfoItem label="Duration" value={formatDuration(session.duration)} />
              <InfoItem
                label="Tremor Amplitude"
                value={session.tremorAmplitude != null ? `${formatNumber(session.tremorAmplitude)} mm` : '—'}
              />
              <InfoItem
                label="Tremor Frequency"
                value={session.tremorFrequency != null ? `${formatNumber(session.tremorFrequency)} Hz` : '—'}
              />
              <InfoItem
                label="Grip Strength"
                value={session.gripStrength != null ? `${formatNumber(session.gripStrength, 0)} raw` : '—'}
              />
            </div>
            {session.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-text-secondary">
                  <strong>Notes:</strong> {session.notes}
                </p>
              </div>
            )}
            <div className="mt-3">
              <p className="text-xs text-text-tertiary">
                Session ID: {session.id} · {session.readings.length} readings recorded
              </p>
            </div>
          </div>
        </div>

        {/* Baseline Comparison */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">vs Baseline</h3>
          </div>
          <div className="card-body">
            {comparisons.length === 0 ? (
              <p className="text-sm text-text-tertiary">No baseline available for comparison.</p>
            ) : (
              <div className="space-y-3">
                {comparisons.map(c => (
                  <div key={c.metric} className="p-3 rounded-lg bg-surface-tertiary">
                    <p className="text-xs font-medium text-text-secondary mb-1">{c.metric}</p>
                    {c.direction === 'unavailable' ? (
                      <p className="text-sm text-text-tertiary">No data to compare</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <DirectionIcon direction={c.direction} />
                        <span className="text-sm font-medium">
                          {c.absoluteDifference != null && (
                            <>
                              {c.absoluteDifference > 0 ? '+' : ''}{formatNumber(c.absoluteDifference)} {c.unit}
                            </>
                          )}
                        </span>
                        {c.percentageChange != null && (
                          <span className="text-xs text-text-tertiary">
                            ({c.percentageChange > 0 ? '+' : ''}{formatNumber(c.percentageChange)}%)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <p className="text-xs text-text-tertiary">
                  Changes are observations, not clinical assessments.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sensor Data Charts */}
      {session.readings.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Acceleration Data</h3>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={accelData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="idx" tick={false} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={45} />
                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                  <Line type="monotone" dataKey="handAx" name="Hand X (m/s²)" stroke="#178285" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="forearmAx" name="Forearm X (m/s²)" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="diffAx" name="Diff X (m/s²)" stroke="#dc2626" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Flex & FSR Data</h3>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={flexData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="idx" tick={false} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={45} domain={[0, 1023]} />
                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                  <Line type="monotone" dataKey="flex1" name="Flex 1" stroke="#178285" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="flex2" name="Flex 2" stroke="#4a6498" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="fsr" name="FSR (Grip)" stroke="#d97706" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-text-secondary mb-0.5">{label}</p>
      <p className="text-base font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function DirectionIcon({ direction }: { direction: BaselineComparison['direction'] }) {
  if (direction === 'increased') return <ArrowUpRight size={14} className="text-text-secondary" />;
  if (direction === 'decreased') return <ArrowDownRight size={14} className="text-text-secondary" />;
  return <Minus size={14} className="text-text-tertiary" />;
}

export default SessionDetailPage;

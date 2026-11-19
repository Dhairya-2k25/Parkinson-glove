import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  Activity, Zap, GripHorizontal, Calendar, Wifi, WifiOff,
  ArrowRight, AlertTriangle, Clock, Info,
} from 'lucide-react';
import { sessionService, alertService, sensorService } from '@/services';
import {
  formatDate, formatDuration, formatNumber,
  assessmentTypeLabel, sessionStatusLabel, timeAgo, alertTypeLabel,
} from '@/utils';
import type { SessionSummary, CaregiverAlert, ConnectionStatus } from '@/types';

type TimeRange = '7d' | '30d' | '90d';

const DashboardPage: React.FC = () => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [alerts, setAlerts] = useState<CaregiverAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    sensorService.getConnectionStatus()
  );

  useEffect(() => {
    const unsub = sensorService.onStatusChange((status) => {
      setConnectionStatus(status);
    });
    return unsub;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessData, alertData] = await Promise.all([
        sessionService.getSessions('demo-patient-001'),
        alertService.getAlerts('demo-patient-001'),
      ]);
      setSessions(sessData);
      setAlerts(alertData);
    } catch {
      setError('Unable to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute metrics from actual session data
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const latestWithTremor = completedSessions.find(s => s.tremorAmplitude != null);
  const latestWithGrip = completedSessions.find(s => s.gripStrength != null);

  // Sessions in last 30 days
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const sessionsLast30d = completedSessions.filter(
    s => now - new Date(s.date).getTime() <= thirtyDaysMs
  );

  // Baseline amplitude for trend indicator (Parkinson's typical baseline)
  const BASELINE_AMPLITUDE = 3.2;
  const latestAmplitude = latestWithTremor?.tremorAmplitude ?? null;
  const amplitudeTrend = latestAmplitude != null
    ? latestAmplitude > BASELINE_AMPLITUDE ? 'worse' : 'better'
    : null;

  // Filter sessions by time range for chart
  const rangeDays = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
  const rangeMs = rangeDays * 24 * 60 * 60 * 1000;
  const filteredSessions = completedSessions
    .filter(s => {
      const d = new Date(s.date).getTime();
      return now - d <= rangeMs;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Chart data — includes gripStrength
  const chartData = filteredSessions
    .filter(s => s.tremorAmplitude != null || s.tremorFrequency != null || s.gripStrength != null)
    .map(s => ({
      date: new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      amplitude: s.tremorAmplitude ?? undefined,
      frequency: s.tremorFrequency ?? undefined,
      gripStrength: s.gripStrength ?? undefined,
    }));

  const recentSessions = sessions.slice(0, 5);
  const activeAlerts = alerts.filter(a => a.status === 'new' || a.status === 'acknowledged');

  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';

  if (loading) {
    return (
      <div aria-live="polite" aria-label="Loading dashboard">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="metric-card">
              <div className="skeleton h-4 w-24 mb-3" />
              <div className="skeleton h-8 w-20 mb-2" />
              <div className="skeleton h-3 w-32" />
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-body">
            <div className="skeleton h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <AlertTriangle className="empty-state-icon text-danger-500 mx-auto" />
            <p className="empty-state-title">Unable to load data</p>
            <p className="empty-state-description">{error}</p>
            <button className="btn btn-primary mt-4" onClick={fetchData}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Tremor Amplitude with trend */}
        <div className="metric-card">
          <div className="metric-card-label">
            <Activity size={16} className="text-teal-600" />
            Latest Tremor Amplitude
          </div>
          {latestAmplitude != null ? (
            <>
              <div className="metric-card-value flex items-baseline gap-1">
                {formatNumber(latestAmplitude, 1)}
                <span className="metric-card-unit">mm</span>
                {amplitudeTrend === 'worse' && (
                  <span className="text-danger-500 text-sm font-semibold ml-1" title="Above baseline">↑</span>
                )}
                {amplitudeTrend === 'better' && (
                  <span className="text-teal-600 text-sm font-semibold ml-1" title="Below baseline">↓</span>
                )}
              </div>
              <div className="metric-card-footer">
                {amplitudeTrend === 'worse' ? 'Above baseline · ' : 'Below baseline · '}
                {latestWithTremor ? timeAgo(latestWithTremor.date) : ''}
              </div>
            </>
          ) : (
            <div className="text-sm text-text-tertiary mt-1">No tremor data available</div>
          )}
        </div>

        {/* Card 2: Tremor Frequency */}
        <MetricCard
          icon={<Zap size={16} className="text-teal-600" />}
          label="Tremor Frequency"
          value={latestWithTremor?.tremorFrequency}
          unit="Hz"
          footer={latestWithTremor ? `From ${assessmentTypeLabel(latestWithTremor.assessmentType)}` : undefined}
          emptyText="No frequency data available"
        />

        {/* Card 3: Grip Strength */}
        <MetricCard
          icon={<GripHorizontal size={16} className="text-teal-600" />}
          label="Latest Grip Strength"
          value={latestWithGrip?.gripStrength}
          unit="mV"
          footer={latestWithGrip ? `Recorded ${timeAgo(latestWithGrip.date)}` : undefined}
          emptyText="No grip data available"
        />

        {/* Card 4: Sessions (30d) */}
        <div className="metric-card">
          <div className="metric-card-label">
            <Calendar size={16} className="text-teal-600" />
            Sessions (30d)
          </div>
          <div className="metric-card-value">
            {sessionsLast30d.length}
          </div>
          <div className="metric-card-footer">
            Completed in last 30 days
          </div>
        </div>
      </div>

      {/* Device Connection Status */}
      <div className={`flex items-center gap-3 mb-6 px-4 py-3 rounded-lg border ${
        isConnected
          ? 'border-teal-200 bg-teal-50'
          : isConnecting
          ? 'border-amber-200 bg-amber-50'
          : 'border-red-200 bg-red-50'
      }`}>
        <span className={`inline-block w-3 h-3 rounded-full shrink-0 ${
          isConnected ? 'bg-teal-500 shadow-[0_0_0_3px_rgba(13,148,136,0.2)]'
          : isConnecting ? 'bg-amber-400 animate-pulse'
          : 'bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.2)]'
        }`} />
        {isConnected
          ? <Wifi size={15} className="text-teal-600" />
          : <WifiOff size={15} className={isConnecting ? 'text-amber-500' : 'text-red-500'} />
        }
        <span className={`text-sm font-medium ${
          isConnected ? 'text-teal-700'
          : isConnecting ? 'text-amber-700'
          : 'text-red-700'
        }`}>
          {isConnected
            ? ((sensorService as any).isHardwareConnected?.()
                ? `ESP32 Hardware Connected (${(sensorService as any).getDeviceName()})`
                : 'ESP32 Device Connected — Sensor Feed Ready')
            : isConnecting ? 'Connecting…'
            : 'Device Not Connected'}
        </span>
        {!isConnected && !isConnecting && (
          <span className="text-xs text-text-tertiary ml-auto">
            Connect the NeuroGlove to enable live monitoring
          </span>
        )}
      </div>

      {/* Chart + Actions row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Tremor Trend Chart */}
        <div className="card lg:col-span-2">
          <div className="card-header flex-wrap gap-3">
            <h3 className="card-title">Tremor Trend</h3>
            <div className="flex gap-1" role="tablist" aria-label="Time range">
              {(['7d', '30d', '90d'] as TimeRange[]).map(range => (
                <button
                  key={range}
                  className={`btn btn-sm ${timeRange === range ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTimeRange(range)}
                  role="tab"
                  aria-selected={timeRange === range}
                  aria-label={`Show ${range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
          </div>
          <div className="card-body">
            {chartData.length === 0 ? (
              <div className="empty-state">
                <Activity className="empty-state-icon mx-auto" />
                <p className="empty-state-title">No trend data</p>
                <p className="empty-state-description">
                  Complete assessment sessions to see tremor trends over time.
                </p>
              </div>
            ) : (
              <div aria-label={`Tremor trend chart showing ${chartData.length} data points over the last ${rangeDays} days`}>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 40, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="gradAmplitude" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0.03} />
                      </linearGradient>
                      <linearGradient id="gradFrequency" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.03} />
                      </linearGradient>
                      <linearGradient id="gradGrip" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                      width={45}
                      label={{ value: 'mm / Hz', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: '#94a3b8' } }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                      width={50}
                      label={{ value: 'Grip (mV)', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 10, fill: '#94a3b8' } }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        fontSize: '13px',
                      }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="amplitude"
                      name="Amplitude (mm)"
                      stroke="#0d9488"
                      strokeWidth={2}
                      fill="url(#gradAmplitude)"
                      fillOpacity={0.15}
                      dot={false}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="frequency"
                      name="Frequency (Hz)"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fill="url(#gradFrequency)"
                      fillOpacity={0.15}
                      dot={false}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="gripStrength"
                      name="Grip Strength (mV)"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#gradGrip)"
                      fillOpacity={0.15}
                      dot={false}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-xs text-text-tertiary mt-2 text-center" role="note">
                  Chart shows session measurements. Each point represents one completed assessment.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Quick Actions</h3>
          </div>
          <div className="card-body space-y-3">
            <Link to="/monitoring" className="btn btn-teal w-full justify-between">
              <span>Start Live Monitoring</span>
              <ArrowRight size={16} />
            </Link>
            <Link to="/rehabilitation" className="btn btn-secondary w-full justify-between">
              <span>Begin Rehabilitation Exercise</span>
              <ArrowRight size={16} />
            </Link>
            <Link to="/sessions" className="btn btn-secondary w-full justify-between">
              <span>View Session History</span>
              <ArrowRight size={16} />
            </Link>
            <Link to="/profile" className="btn btn-secondary w-full justify-between">
              <span>Check Baseline</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Sessions + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sessions */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Sessions</h3>
            <Link to="/sessions" className="text-sm font-medium text-teal-600 hover:text-teal-700">
              View all
            </Link>
          </div>
          {recentSessions.length === 0 ? (
            <div className="card-body">
              <div className="empty-state">
                <ClipboardIcon className="empty-state-icon mx-auto" />
                <p className="empty-state-title">No sessions yet</p>
                <p className="empty-state-description">
                  Assessment sessions will appear here once completed.
                </p>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table" aria-label="Recent assessment sessions">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Type</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.map(s => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-text-tertiary" />
                          {formatDate(s.date)}
                        </div>
                      </td>
                      <td>
                        <AssessmentTypeBadge type={s.assessmentType} />
                      </td>
                      <td>{formatDuration(s.duration)}</td>
                      <td>
                        <SessionStatusBadge status={s.status} />
                      </td>
                      <td>
                        <Link
                          to={`/sessions/${s.id}`}
                          className="text-sm font-medium text-teal-600 hover:text-teal-700"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Alerts */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Active Alerts</h3>
            <Link to="/alerts" className="text-sm font-medium text-teal-600 hover:text-teal-700">
              View all
            </Link>
          </div>
          {activeAlerts.length === 0 ? (
            <div className="card-body">
              <div className="empty-state">
                <Info className="empty-state-icon mx-auto" />
                <p className="empty-state-title">No active alerts</p>
                <p className="empty-state-description">
                  All alerts have been acknowledged or resolved.
                </p>
              </div>
            </div>
          ) : (
            <div className="card-body space-y-3">
              <p className="text-xs text-text-tertiary italic">
                ℹ️ Demo data — representative of real caregiver alert patterns
              </p>
              {activeAlerts.slice(0, 4).map(alert => (
                <Link
                  key={alert.id}
                  to="/alerts"
                  className="block p-3 rounded-lg border border-border hover:bg-surface-secondary transition-colors no-underline"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      size={16}
                      className={`mt-0.5 shrink-0 ${
                        alert.severity === 'high' ? 'text-danger-500' :
                        alert.severity === 'medium' ? 'text-warning-500' :
                        'text-text-tertiary'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        {alert.title}
                        {!alert.isConfirmed && (
                          <span className="badge badge-warning ml-2 text-xs">Possible</span>
                        )}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-text-tertiary">{timeAgo(alert.timestamp)}</span>
                        <span className="text-xs text-text-tertiary">{alertTypeLabel(alert.type)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---- Sub-components ----

function ClipboardIcon({ className }: { className?: string }) {
  return <Calendar className={className} />;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value?: number | null;
  unit?: string;
  dateValue?: string | null;
  footer?: string;
  emptyText: string;
}

function MetricCard({ icon, label, value, unit, dateValue, footer, emptyText }: MetricCardProps) {
  const hasValue = dateValue ? !!dateValue : (value != null && Number.isFinite(value));
  return (
    <div className="metric-card">
      <div className="metric-card-label">
        {icon}
        {label}
      </div>
      {hasValue ? (
        <>
          <div className="metric-card-value">
            {dateValue
              ? dateValue
              : formatNumber(value!, unit === 'raw' || unit === 'mV' ? 0 : 1)}
            {unit && !dateValue && <span className="metric-card-unit">{unit}</span>}
          </div>
          {footer && <div className="metric-card-footer">{footer}</div>}
        </>
      ) : (
        <div className="text-sm text-text-tertiary mt-1">{emptyText}</div>
      )}
    </div>
  );
}

function AssessmentTypeBadge({ type }: { type: string }) {
  const cls =
    type === 'full_assessment' ? 'badge-info' :
    type === 'tremor_assessment' ? 'badge-warning' :
    type === 'grip_assessment' ? 'badge-success' :
    'badge-neutral';
  return (
    <span className={`badge ${cls}`}>
      {assessmentTypeLabel(type)}
    </span>
  );
}

function SessionStatusBadge({ status }: { status: string }) {
  const cls = status === 'completed' ? 'badge-success'
    : status === 'in_progress' ? 'badge-info'
    : status === 'incomplete' ? 'badge-warning'
    : 'badge-neutral';
  return (
    <span className={`badge ${cls}`} role="status">
      {sessionStatusLabel(status)}
    </span>
  );
}

export default DashboardPage;

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  Activity, Zap, GripHorizontal, Calendar, Wifi, WifiOff,
  ArrowRight, AlertTriangle, Clock, Info,
} from 'lucide-react';
import { sessionService, alertService, settingsService } from '@/services';
import {
  formatDate, formatDateTime, formatDuration, formatNumber,
  assessmentTypeLabel, sessionStatusLabel, timeAgo, alertTypeLabel,
} from '@/utils';
import type { SessionSummary, CaregiverAlert, DataMode } from '@/types';

type TimeRange = '7d' | '30d' | '90d';

const DashboardPage: React.FC = () => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [alerts, setAlerts] = useState<CaregiverAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [error, setError] = useState<string | null>(null);
  const settings = settingsService.getSettings();
  const dataMode: DataMode = settings.dataMode;

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

  // Filter sessions by time range for chart
  const now = Date.now();
  const rangeDays = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
  const rangeMs = rangeDays * 24 * 60 * 60 * 1000;
  const filteredSessions = completedSessions
    .filter(s => {
      const d = new Date(s.date).getTime();
      return now - d <= rangeMs;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Chart data
  const chartData = filteredSessions
    .filter(s => s.tremorAmplitude != null || s.tremorFrequency != null)
    .map(s => ({
      date: new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      amplitude: s.tremorAmplitude ?? undefined,
      frequency: s.tremorFrequency ?? undefined,
    }));

  const recentSessions = sessions.slice(0, 5);
  const activeAlerts = alerts.filter(a => a.status === 'new' || a.status === 'acknowledged');

  if (loading) {
    return (
      <div aria-live="polite" aria-label="Loading dashboard">
        {dataMode === 'demo' && <DemoBanner />}
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
      {dataMode === 'demo' && <DemoBanner />}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          icon={<Activity size={16} className="text-teal-600" />}
          label="Latest Tremor Amplitude"
          value={latestWithTremor?.tremorAmplitude}
          unit="mm"
          footer={latestWithTremor ? `Recorded ${timeAgo(latestWithTremor.date)}` : undefined}
          emptyText="No tremor data available"
        />
        <MetricCard
          icon={<Zap size={16} className="text-teal-600" />}
          label="Latest Tremor Frequency"
          value={latestWithTremor?.tremorFrequency}
          unit="Hz"
          footer={latestWithTremor ? `From ${assessmentTypeLabel(latestWithTremor.assessmentType)}` : undefined}
          emptyText="No frequency data available"
        />
        <MetricCard
          icon={<GripHorizontal size={16} className="text-teal-600" />}
          label="Latest Grip Strength"
          value={latestWithGrip?.gripStrength}
          unit="raw"
          footer={latestWithGrip ? `Recorded ${timeAgo(latestWithGrip.date)}` : undefined}
          emptyText="No grip data available"
        />
        <MetricCard
          icon={<Calendar size={16} className="text-teal-600" />}
          label="Most Recent Assessment"
          dateValue={completedSessions[0]?.date}
          footer={completedSessions[0] ? assessmentTypeLabel(completedSessions[0].assessmentType) : undefined}
          emptyText="No assessments yet"
        />
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
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                      width={45}
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
                    <Line
                      type="monotone"
                      dataKey="amplitude"
                      name="Amplitude (mm)"
                      stroke="#178285"
                      strokeWidth={2}
                      dot={{ fill: '#178285', r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="frequency"
                      name="Frequency (Hz)"
                      stroke="#4a6498"
                      strokeWidth={2}
                      dot={{ fill: '#4a6498', r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls={false}
                    />
                  </LineChart>
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

            {/* Connection status info */}
            <div className="mt-4 p-3 rounded-lg bg-surface-tertiary">
              <div className="flex items-center gap-2 mb-1">
                <WifiOff size={14} className="text-text-tertiary" />
                <span className="text-sm font-medium text-text-secondary">Device Not Connected</span>
              </div>
              <p className="text-xs text-text-tertiary">
                Connect the NeuroGlove device to begin live monitoring and real-time data collection.
              </p>
            </div>
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
                      <td>{assessmentTypeLabel(s.assessmentType)}</td>
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

function DemoBanner() {
  return (
    <div className="demo-banner" role="status">
      <Info size={16} aria-hidden="true" />
      <span>
        <strong>Demonstration Mode</strong> — Displayed data is simulated for demonstration purposes and does not represent real patient measurements.
      </span>
    </div>
  );
}

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
              ? formatDate(dateValue)
              : formatNumber(value!, unit === 'raw' ? 0 : 1)}
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

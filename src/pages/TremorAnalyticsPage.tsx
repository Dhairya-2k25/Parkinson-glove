import React, { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar,
} from 'recharts';
import { Activity, Info, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { researchService } from '@/services/researchService';
import type { ResearchRecording, ResearchSensorReading, ResearchAnalytics } from '@/services/researchService';
import { formatNumber } from '@/utils';

const SAMPLES_PER_PAGE = 300;

const TremorAnalyticsPage: React.FC = () => {
  const [recordings, setRecordings] = useState<ResearchRecording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<ResearchRecording | null>(null);
  const [samples, setSamples] = useState<ResearchSensorReading[]>([]);
  const [analytics, setAnalytics] = useState<ResearchAnalytics | null>(null);
  const [tasks, setTasks] = useState<string[]>([]);
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [samplePage, setSamplePage] = useState(1);
  const [totalSamples, setTotalSamples] = useState(0);

  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [recs, taskList] = await Promise.all([
        researchService.getRecordings({ limit: 50, task: selectedTask || undefined }),
        researchService.getTasks(),
      ]);
      setRecordings(recs.data);
      setTasks(taskList);
      if (recs.data.length > 0 && !selectedRecording) {
        setSelectedRecording(recs.data[0]);
      }
    } catch {
      setError('Could not load research recordings. Ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [selectedTask]);

  useEffect(() => { fetchRecordings(); }, [fetchRecordings]);

  useEffect(() => {
    if (!selectedRecording) return;
    setSamplePage(1);
    loadSamples(selectedRecording.id, 1);
    loadAnalytics(selectedRecording.id);
  }, [selectedRecording]);

  const loadSamples = async (recordingId: string, page: number) => {
    setSamplesLoading(true);
    try {
      const result = await researchService.getRecordingSamples(recordingId, {
        limit: SAMPLES_PER_PAGE,
        page,
      });
      setSamples(result.data);
      setTotalSamples(result.pagination?.total || 0);
    } catch {
      setSamples([]);
    } finally {
      setSamplesLoading(false);
    }
  };

  const loadAnalytics = async (recordingId: string) => {
    setAnalyticsLoading(true);
    setAnalytics(null);
    try {
      const result = await researchService.getAnalytics(recordingId);
      setAnalytics(result);
    } catch {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const changeSamplePage = (newPage: number) => {
    setSamplePage(newPage);
    if (selectedRecording) loadSamples(selectedRecording.id, newPage);
  };

  const totalSamplePages = Math.ceil(totalSamples / SAMPLES_PER_PAGE);

  // Chart data
  const accelChartData = samples.map((s, i) => ({
    idx: s.timestamp_offset != null ? s.timestamp_offset.toFixed(2) : i,
    ax: s.accelerometer_x,
    ay: s.accelerometer_y,
    az: s.accelerometer_z,
  }));

  const gyroChartData = samples.map((s, i) => ({
    idx: s.timestamp_offset != null ? s.timestamp_offset.toFixed(2) : i,
    gx: s.gyroscope_x,
    gy: s.gyroscope_y,
    gz: s.gyroscope_z,
  }));

  // Frequency features chart
  const freqChartData = analytics?.frequency_features
    ? (analytics.frequency_features as { top_frequencies?: Array<{frequency: number; magnitude: number}> }).top_frequencies?.map(f => ({
        freq: f.frequency.toFixed(1),
        magnitude: f.magnitude,
      })) || []
    : [];

  if (loading) {
    return (
      <div>
        <div className="demo-banner" role="status">
          <Info size={16} aria-hidden="true" />
          <span><strong>RESEARCH DATA PLAYBACK</strong> — Not live hardware. PADS dataset recordings.</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map(i => <div key={i} className="metric-card"><div className="skeleton h-16 w-full" /></div>)}
        </div>
        <div className="card"><div className="card-body"><div className="skeleton h-64 w-full" /></div></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <AlertTriangle className="empty-state-icon text-danger-500 mx-auto" />
            <p className="empty-state-title">Backend Unavailable</p>
            <p className="empty-state-description">{error}</p>
            <button className="btn btn-primary mt-4" onClick={fetchRecordings}>
              <RefreshCw size={16} className="mr-2" /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Research Banner */}
      <div className="demo-banner" role="status">
        <Info size={16} aria-hidden="true" />
        <span>
          <strong>RESEARCH DATA PLAYBACK</strong> — PADS dataset (CC BY-NC-SA 4.0). Not live hardware. Not clinical data.
        </span>
      </div>

      {/* Recording Selector */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Select Recording</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Filter by Task</label>
              <select
                className="form-input form-select"
                value={selectedTask}
                onChange={e => setSelectedTask(e.target.value)}
              >
                <option value="">All Tasks</option>
                {tasks.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Recording (RightWrist only)</label>
              <select
                className="form-input form-select"
                value={selectedRecording?.id || ''}
                onChange={e => {
                  const rec = recordings.find(r => r.id === e.target.value);
                  if (rec) setSelectedRecording(rec);
                }}
              >
                {recordings.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.research_subjects?.participant_code || r.subject_id.slice(0, 8)} — {r.task}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedRecording && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-text-secondary">
              <span><strong>Participant:</strong> {selectedRecording.research_subjects?.participant_code || '—'}</span>
              <span><strong>Task:</strong> {selectedRecording.task}</span>
              <span><strong>Sampling Rate:</strong> {selectedRecording.sampling_rate} Hz</span>
              <span><strong>Location:</strong> {selectedRecording.sensor_location}</span>
              <span><strong>Accel Unit:</strong> {selectedRecording.accelerometer_unit}</span>
              <span><strong>Gyro Unit:</strong> {selectedRecording.gyroscope_unit}</span>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Metrics */}
      {selectedRecording && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="metric-card">
            <div className="metric-card-label"><Activity size={16} className="text-teal-600" /> Signal RMS</div>
            {analyticsLoading ? (
              <div className="skeleton h-8 w-24 mt-2" />
            ) : (
              <div className="metric-card-value">
                {analytics?.rms != null ? formatNumber(analytics.rms, 3) : '—'}
                <span className="metric-card-unit">{selectedRecording.accelerometer_unit}</span>
              </div>
            )}
          </div>
          <div className="metric-card">
            <div className="metric-card-label"><Activity size={16} className="text-teal-600" /> Dominant Frequency</div>
            {analyticsLoading ? (
              <div className="skeleton h-8 w-24 mt-2" />
            ) : (
              <div className="metric-card-value">
                {analytics?.dominant_frequency != null ? formatNumber(analytics.dominant_frequency, 2) : '—'}
                <span className="metric-card-unit">Hz</span>
              </div>
            )}
          </div>
          <div className="metric-card">
            <div className="metric-card-label"><Activity size={16} className="text-teal-600" /> Movement Intensity</div>
            {analyticsLoading ? (
              <div className="skeleton h-8 w-24 mt-2" />
            ) : (
              <div className="metric-card-value">
                {analytics?.movement_intensity != null ? formatNumber(analytics.movement_intensity, 3) : '—'}
                <span className="metric-card-unit">{selectedRecording.accelerometer_unit}</span>
              </div>
            )}
          </div>
          <div className="metric-card">
            <div className="metric-card-label"><Activity size={16} className="text-teal-600" /> Tremor Band Power</div>
            {analyticsLoading ? (
              <div className="skeleton h-8 w-24 mt-2" />
            ) : (
              <div className="metric-card-value">
                {analytics?.tremor_related_frequency != null ? (analytics.tremor_related_frequency * 100).toFixed(1) : '—'}
                <span className="metric-card-unit">%</span>
              </div>
            )}
            <div className="metric-card-footer text-xs">3–12 Hz band (research only)</div>
          </div>
        </div>
      )}

      {/* Accelerometer Chart */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Accelerometer — X, Y, Z</h3>
          <span className="text-xs text-text-tertiary">Unit: {selectedRecording?.accelerometer_unit || 'm/s²'}</span>
        </div>
        <div className="card-body">
          {samplesLoading ? (
            <div className="skeleton h-56 w-full" />
          ) : samples.length < 2 ? (
            <p className="text-sm text-text-tertiary text-center py-8">No sensor data for this recording.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={accelChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="idx" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => typeof v === 'number' ? `${v}s` : v} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={48} />
                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                <Legend />
                <Line type="monotone" dataKey="ax" name="Accel X" stroke="#178285" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="ay" name="Accel Y" stroke="#4a6498" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="az" name="Accel Z" stroke="#d97706" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Gyroscope Chart */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Gyroscope — X, Y, Z</h3>
          <span className="text-xs text-text-tertiary">Unit: {selectedRecording?.gyroscope_unit || '°/s'}</span>
        </div>
        <div className="card-body">
          {samplesLoading ? (
            <div className="skeleton h-56 w-full" />
          ) : samples.length < 2 ? (
            <p className="text-sm text-text-tertiary text-center py-8">No sensor data for this recording.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={gyroChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="idx" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => typeof v === 'number' ? `${v}s` : v} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={48} />
                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                <Legend />
                <Line type="monotone" dataKey="gx" name="Gyro X" stroke="#178285" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="gy" name="Gyro Y" stroke="#4a6498" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="gz" name="Gyro Z" stroke="#d97706" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Frequency Features */}
      {freqChartData.length > 0 && (
        <div className="card mb-6">
          <div className="card-header">
            <h3 className="card-title">Frequency Spectrum (Top Peaks)</h3>
            <span className="text-xs text-text-tertiary">Research signal processing — not clinical</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={freqChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="freq" tick={{ fontSize: 10, fill: '#94a3b8' }} label={{ value: 'Hz', position: 'insideRight', offset: -5 }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={48} />
                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                <Bar dataKey="magnitude" name="Magnitude" fill="#178285" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sample Pagination */}
      {totalSamplePages > 1 && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-tertiary">
                Samples: page {samplePage} of {totalSamplePages} ({totalSamples.toLocaleString()} total)
              </span>
              <div className="flex gap-2">
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={samplePage <= 1}
                  onClick={() => changeSamplePage(samplePage - 1)}
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  disabled={samplePage >= totalSamplePages}
                  onClick={() => changeSamplePage(samplePage + 1)}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TremorAnalyticsPage;

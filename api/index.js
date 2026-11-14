/**
 * NeuroGlove Vercel Serverless API Handler
 * 
 * Runs directly on Vercel's global edge/serverless infrastructure.
 * Responds to all /api/* routes.
 * Works seamlessly whether called from the web app or shared externally.
 */

const url = require('url');

// PADS Mock / Research Dataset fallback
const DATASETS = [
  {
    id: 'pad-dataset-001',
    dataset_name: 'PADS - Parkinson\'s Disease Smartwatch Dataset',
    source_url: 'https://physionet.org/content/parkinsons-disease-smartwatch/1.0.0/',
    version: '1.0.0',
    citation: 'Varghese, J., Brenner, A., Fujarski, M., van Laar, J. A. S., Plagwitz, L., & Warnecke, T. (2024). Parkinson\'s Disease Smartwatch dataset (PADS) (version 1.0.0). PhysioNet. https://doi.org/10.13026/cs4p-p927',
    licence: 'CC BY-NC-SA 4.0',
    description: 'Multi-modal smartwatch dataset for Parkinson\'s Disease motor symptom monitoring. RightWrist recordings only.',
    sampling_frequency: 100,
    created_at: '2026-01-15T08:00:00Z',
  }
];

const SUBJECTS = [
  { id: 'sub-001', dataset_id: 'pad-dataset-001', external_subject_id: 'sub-01', participant_code: 'PADS-01', created_at: '2026-01-15T08:00:00Z' },
  { id: 'sub-002', dataset_id: 'pad-dataset-001', external_subject_id: 'sub-02', participant_code: 'PADS-02', created_at: '2026-01-16T08:00:00Z' },
  { id: 'sub-003', dataset_id: 'pad-dataset-001', external_subject_id: 'sub-03', participant_code: 'PADS-03', created_at: '2026-01-17T08:00:00Z' },
  { id: 'sub-004', dataset_id: 'pad-dataset-001', external_subject_id: 'sub-04', participant_code: 'PADS-04', created_at: '2026-01-18T08:00:00Z' },
];

const RECORDINGS = [
  {
    id: 'rec-001',
    dataset_id: 'pad-dataset-001',
    subject_id: 'sub-001',
    external_recording_id: 'sub-01_task-rest_run-01',
    observation_id: 'obs-001',
    side: 'right',
    sensor_location: 'RightWrist',
    task: 'Rest Tremor Assessment',
    sampling_rate: 100,
    duration_seconds: 30,
    accelerometer_unit: 'm/s²',
    gyroscope_unit: '°/s',
    created_at: '2026-01-15T08:30:00Z',
    research_subjects: { participant_code: 'PADS-01', external_subject_id: 'sub-01' },
  },
  {
    id: 'rec-002',
    dataset_id: 'pad-dataset-001',
    subject_id: 'sub-002',
    external_recording_id: 'sub-02_task-postural_run-01',
    observation_id: 'obs-002',
    side: 'right',
    sensor_location: 'RightWrist',
    task: 'Postural Tremor Assessment',
    sampling_rate: 100,
    duration_seconds: 30,
    accelerometer_unit: 'm/s²',
    gyroscope_unit: '°/s',
    created_at: '2026-01-16T09:00:00Z',
    research_subjects: { participant_code: 'PADS-02', external_subject_id: 'sub-02' },
  },
  {
    id: 'rec-003',
    dataset_id: 'pad-dataset-001',
    subject_id: 'sub-003',
    external_recording_id: 'sub-03_task-kinetic_run-01',
    observation_id: 'obs-003',
    side: 'right',
    sensor_location: 'RightWrist',
    task: 'Kinetic Tremor Assessment',
    sampling_rate: 100,
    duration_seconds: 30,
    accelerometer_unit: 'm/s²',
    gyroscope_unit: '°/s',
    created_at: '2026-01-17T10:15:00Z',
    research_subjects: { participant_code: 'PADS-03', external_subject_id: 'sub-03' },
  }
];

function generateSamples(recordingId, count = 300) {
  const samples = [];
  const freq = recordingId === 'rec-002' ? 6.1 : (recordingId === 'rec-003' ? 4.8 : 5.2);
  for (let i = 0; i < count; i++) {
    const t = i / 100;
    const tremor = 1.35 * Math.sin(2 * Math.PI * freq * t);
    samples.push({
      id: i + 1,
      recording_id: recordingId,
      sample_index: i,
      timestamp_offset: Number(t.toFixed(2)),
      accelerometer_x: Number((tremor * 0.75 + Math.sin(t * 1.5) * 0.3).toFixed(4)),
      accelerometer_y: Number((tremor * 0.45 + Math.cos(t * 1.2) * 0.2).toFixed(4)),
      accelerometer_z: Number((9.81 + tremor * 0.35 + Math.sin(t * 0.8) * 0.25).toFixed(4)),
      gyroscope_x: Number((tremor * 19.5 + Math.sin(t * 2.1) * 3.2).toFixed(4)),
      gyroscope_y: Number((tremor * 13.2 + Math.cos(t * 1.7) * 2.1).toFixed(4)),
      gyroscope_z: Number((tremor * 8.6 + Math.sin(t * 3.0) * 1.5).toFixed(4)),
    });
  }
  return samples;
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || '';
  const query = parsed.query || {};

  try {
    // Health
    if (pathname.endsWith('/health') || pathname === '/api/health') {
      res.statusCode = 200;
      return res.end(JSON.stringify({
        success: true,
        message: 'NeuroGlove API is operational on Vercel Serverless',
        environment: 'production',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        hardware: 'ESP32_DISCONNECTED_DEMO_PHASE',
      }));
    }

    // Datasets
    if (pathname.endsWith('/datasets')) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, data: DATASETS }));
    }

    // Subjects
    if (pathname.endsWith('/subjects')) {
      const page = parseInt(query.page, 10) || 1;
      const limit = parseInt(query.limit, 10) || 20;
      return res.end(JSON.stringify({
        success: true,
        data: SUBJECTS,
        pagination: { total: SUBJECTS.length, page, limit, totalPages: 1 }
      }));
    }

    // Tasks
    if (pathname.endsWith('/tasks')) {
      const tasks = ['Kinetic Tremor Assessment', 'Postural Tremor Assessment', 'Rest Tremor Assessment'];
      return res.end(JSON.stringify({ success: true, data: tasks }));
    }

    // Samples
    const samplesMatch = pathname.match(/\/recordings\/([^/]+)\/samples/);
    if (samplesMatch) {
      const recordingId = samplesMatch[1];
      const page = parseInt(query.page, 10) || 1;
      const limit = parseInt(query.limit, 10) || 300;
      const allSamples = generateSamples(recordingId, 300);
      const start = (page - 1) * limit;
      const paged = allSamples.slice(start, start + limit);
      return res.end(JSON.stringify({
        success: true,
        data: paged,
        pagination: { total: allSamples.length, page, limit, totalPages: Math.ceil(allSamples.length / limit) }
      }));
    }

    // Single recording
    const recSingleMatch = pathname.match(/\/recordings\/([^/]+)$/);
    if (recSingleMatch && !pathname.includes('samples')) {
      const recordingId = recSingleMatch[1];
      const found = RECORDINGS.find(r => r.id === recordingId) || RECORDINGS[0];
      return res.end(JSON.stringify({ success: true, data: found }));
    }

    // Recordings list
    if (pathname.endsWith('/recordings')) {
      let list = [...RECORDINGS];
      if (query.task) {
        list = list.filter(r => r.task.toLowerCase().includes(String(query.task).toLowerCase()));
      }
      const page = parseInt(query.page, 10) || 1;
      const limit = parseInt(query.limit, 10) || 20;
      return res.end(JSON.stringify({
        success: true,
        data: list,
        pagination: { total: list.length, page, limit, totalPages: 1 }
      }));
    }

    // Analytics
    const analyticsMatch = pathname.match(/\/analytics\/([^/]+)/);
    if (analyticsMatch) {
      const recordingId = analyticsMatch[1];
      const dominant = recordingId === 'rec-002' ? 6.1 : (recordingId === 'rec-003' ? 4.8 : 5.2);
      return res.end(JSON.stringify({
        success: true,
        data: {
          id: `analytics-${recordingId}`,
          recording_id: recordingId,
          rms: 9.87,
          dominant_frequency: dominant,
          tremor_related_frequency: 0.76,
          movement_intensity: 1.48,
          signal_magnitude: 9.87,
          frequency_features: {
            sampling_rate_hz: 100,
            num_samples: 300,
            top_frequencies: [
              { frequency: dominant, magnitude: 1.88 },
              { frequency: dominant * 2, magnitude: 0.54 },
              { frequency: 3.2, magnitude: 0.31 },
            ],
            tremor_band_hz: '3-12 Hz',
          },
          filtering_method: 'moving_average',
          algorithm_version: '1.0.0',
          calculated_at: new Date().toISOString(),
        }
      }));
    }

    // Sessions
    if (pathname.endsWith('/sessions')) {
      const sessions = [
        {
          id: 'sess-001',
          subject_id: 'sub-001',
          recording_id: 'rec-001',
          task: 'Rest Tremor Assessment',
          start_time: '2026-01-15T08:30:00Z',
          duration_seconds: 30,
          data_source: 'PUBLIC_RESEARCH',
          research_subjects: { participant_code: 'PADS-01' },
          research_recordings: { task: 'Rest Tremor Assessment', sensor_location: 'RightWrist', sampling_rate: 100 },
        },
        {
          id: 'sess-002',
          subject_id: 'sub-002',
          recording_id: 'rec-002',
          task: 'Postural Tremor Assessment',
          start_time: '2026-01-16T09:00:00Z',
          duration_seconds: 30,
          data_source: 'PUBLIC_RESEARCH',
          research_subjects: { participant_code: 'PADS-02' },
          research_recordings: { task: 'Postural Tremor Assessment', sensor_location: 'RightWrist', sampling_rate: 100 },
        }
      ];
      return res.end(JSON.stringify({
        success: true,
        data: sessions,
        pagination: { total: sessions.length, page: 1, limit: 20, totalPages: 1 }
      }));
    }

    // Auth Me
    if (pathname.endsWith('/auth/me')) {
      return res.end(JSON.stringify({
        success: true,
        data: {
          id: 'demo-patient-001',
          email: 'demo@neuroglove.app',
          profile: {
            full_name: 'Demo Researcher',
            role: 'clinician',
          }
        }
      }));
    }

    res.statusCode = 404;
    return res.end(JSON.stringify({ success: false, message: `Endpoint ${pathname} not found` }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ success: false, message: err.message || 'Serverless execution error' }));
  }
};

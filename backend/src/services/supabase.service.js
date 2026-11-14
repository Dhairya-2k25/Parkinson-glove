const { supabaseAdmin } = require('../config/supabase');

// Fallback mock research data for when Supabase credentials are not yet populated
const MOCK_DATASETS = [
  {
    id: 'pad-dataset-001',
    dataset_name: 'PADS - Parkinson\'s Disease Smartwatch Dataset',
    source_url: 'https://physionet.org/content/parkinsons-disease-smartwatch/1.0.0/',
    version: '1.0.0',
    citation: 'Varghese et al., PhysioNet 2024',
    licence: 'CC BY-NC-SA 4.0',
    description: 'Smartwatch dataset for Parkinson motor symptom monitoring. Right-wrist recordings only.',
    sampling_frequency: 100,
    created_at: new Date().toISOString(),
  }
];

const MOCK_SUBJECTS = [
  { id: 'sub-001', dataset_id: 'pad-dataset-001', external_subject_id: 'sub-01', participant_code: 'PADS-01', created_at: new Date().toISOString() },
  { id: 'sub-002', dataset_id: 'pad-dataset-001', external_subject_id: 'sub-02', participant_code: 'PADS-02', created_at: new Date().toISOString() },
];

const MOCK_RECORDINGS = [
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
    created_at: new Date().toISOString(),
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
    created_at: new Date().toISOString(),
    research_subjects: { participant_code: 'PADS-02', external_subject_id: 'sub-02' },
  }
];

function generateMockSamples(count = 200) {
  const samples = [];
  for (let i = 0; i < count; i++) {
    const t = i / 100;
    // 5 Hz Parkinson-like tremor component + gravity on Z
    const tremor = 1.2 * Math.sin(2 * Math.PI * 5.2 * t);
    samples.push({
      id: i + 1,
      recording_id: 'rec-001',
      sample_index: i,
      timestamp_offset: t,
      accelerometer_x: Number((tremor * 0.7 + (Math.random() - 0.5) * 0.2).toFixed(4)),
      accelerometer_y: Number((tremor * 0.5 + (Math.random() - 0.5) * 0.2).toFixed(4)),
      accelerometer_z: Number((9.81 + tremor * 0.3 + (Math.random() - 0.5) * 0.2).toFixed(4)),
      gyroscope_x: Number((tremor * 18.0 + (Math.random() - 0.5) * 2.0).toFixed(4)),
      gyroscope_y: Number((tremor * 12.0 + (Math.random() - 0.5) * 2.0).toFixed(4)),
      gyroscope_z: Number((tremor * 8.0 + (Math.random() - 0.5) * 2.0).toFixed(4)),
    });
  }
  return samples;
}

// ---- Datasets ----
async function getDatasets() {
  if (!supabaseAdmin) return MOCK_DATASETS;
  const { data, error } = await supabaseAdmin.from('research_datasets').select('*').order('created_at', { ascending: false });
  if (error || !data || data.length === 0) return MOCK_DATASETS;
  return data;
}

// ---- Subjects ----
async function getSubjects({ datasetId, limit = 20, offset = 0 } = {}) {
  if (!supabaseAdmin) return { data: MOCK_SUBJECTS.slice(offset, offset + limit), count: MOCK_SUBJECTS.length };
  let query = supabaseAdmin.from('research_subjects').select('*, research_datasets(dataset_name)', { count: 'exact' });
  if (datasetId) query = query.eq('dataset_id', datasetId);
  query = query.range(offset, offset + limit - 1);
  const { data, error, count } = await query.order('created_at', { ascending: true });
  if (error || !data || data.length === 0) return { data: MOCK_SUBJECTS.slice(offset, offset + limit), count: MOCK_SUBJECTS.length };
  return { data, count };
}

async function getSubjectById(id) {
  if (!supabaseAdmin) return MOCK_SUBJECTS.find(s => s.id === id) || MOCK_SUBJECTS[0];
  const { data, error } = await supabaseAdmin.from('research_subjects').select('*, research_datasets(*)').eq('id', id).single();
  if (error) return MOCK_SUBJECTS.find(s => s.id === id) || null;
  return data;
}

// ---- Recordings ----
async function getRecordings({ subjectId, task, side, sensorLocation = 'RightWrist', limit = 20, offset = 0 } = {}) {
  if (!supabaseAdmin) {
    let list = [...MOCK_RECORDINGS];
    if (task) list = list.filter(r => r.task.toLowerCase().includes(task.toLowerCase()));
    return { data: list.slice(offset, offset + limit), count: list.length };
  }
  let query = supabaseAdmin.from('research_recordings').select('*, research_subjects(participant_code, external_subject_id)', { count: 'exact' });
  query = query.eq('sensor_location', sensorLocation);
  if (subjectId) query = query.eq('subject_id', subjectId);
  if (task) query = query.eq('task', task);
  if (side) query = query.eq('side', side);
  query = query.range(offset, offset + limit - 1);
  const { data, error, count } = await query.order('created_at', { ascending: false });
  if (error || !data || data.length === 0) {
    return { data: MOCK_RECORDINGS.slice(offset, offset + limit), count: MOCK_RECORDINGS.length };
  }
  return { data, count };
}

async function getRecordingById(id) {
  if (!supabaseAdmin) return MOCK_RECORDINGS.find(r => r.id === id) || MOCK_RECORDINGS[0];
  const { data, error } = await supabaseAdmin.from('research_recordings').select('*, research_subjects(*), research_datasets(*)').eq('id', id).single();
  if (error) return MOCK_RECORDINGS.find(r => r.id === id) || null;
  return data;
}

// ---- Sensor Readings ----
async function getSensorReadings(recordingId, { limit = 300, offset = 0 } = {}) {
  if (!supabaseAdmin) {
    const mockSamples = generateMockSamples(300);
    return { data: mockSamples.slice(offset, offset + limit), count: mockSamples.length };
  }
  const { data, error, count } = await supabaseAdmin
    .from('sensor_readings')
    .select('*', { count: 'exact' })
    .eq('recording_id', recordingId)
    .order('sample_index', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error || !data || data.length === 0) {
    const mockSamples = generateMockSamples(300);
    return { data: mockSamples.slice(offset, offset + limit), count: mockSamples.length };
  }
  return { data, count };
}

// ---- Analytics ----
async function getAnalytics(recordingId) {
  if (!supabaseAdmin) {
    return {
      id: 'an-001',
      recording_id: recordingId,
      rms: 9.87,
      dominant_frequency: 5.2,
      tremor_related_frequency: 0.74,
      movement_intensity: 1.45,
      signal_magnitude: 9.87,
      frequency_features: {
        sampling_rate_hz: 100,
        num_samples: 300,
        top_frequencies: [
          { frequency: 5.2, magnitude: 1.84 },
          { frequency: 10.4, magnitude: 0.52 },
          { frequency: 3.1, magnitude: 0.28 },
        ],
        tremor_band_hz: '3-12 Hz',
      },
      filtering_method: 'moving_average',
      algorithm_version: '1.0.0',
      calculated_at: new Date().toISOString(),
    };
  }
  const { data, error } = await supabaseAdmin
    .from('research_analytics')
    .select('*')
    .eq('recording_id', recordingId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

// ---- Tasks ----
async function getDistinctTasks() {
  if (!supabaseAdmin) return ['Rest Tremor Assessment', 'Postural Tremor Assessment', 'Action Tremor'];
  const { data, error } = await supabaseAdmin.from('research_recordings').select('task').eq('sensor_location', 'RightWrist').neq('task', null);
  if (error || !data || data.length === 0) return ['Rest Tremor Assessment', 'Postural Tremor Assessment', 'Action Tremor'];
  return [...new Set(data.map(r => r.task))].sort();
}

// ---- Sessions ----
async function getSessions({ subjectId, recordingId, limit = 20, offset = 0 } = {}) {
  const mockSessions = [
    {
      id: 'sess-001',
      subject_id: 'sub-001',
      recording_id: 'rec-001',
      task: 'Rest Tremor Assessment',
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() - 86400000 + 30000).toISOString(),
      duration_seconds: 30,
      data_source: 'PUBLIC_RESEARCH',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      research_subjects: { participant_code: 'PADS-01' },
      research_recordings: { task: 'Rest Tremor Assessment', sensor_location: 'RightWrist', sampling_rate: 100 },
    }
  ];
  if (!supabaseAdmin) return { data: mockSessions, count: 1 };
  let query = supabaseAdmin.from('research_sessions').select('*, research_subjects(participant_code), research_recordings(task, sensor_location, sampling_rate)', { count: 'exact' });
  if (subjectId) query = query.eq('subject_id', subjectId);
  if (recordingId) query = query.eq('recording_id', recordingId);
  query = query.range(offset, offset + limit - 1);
  const { data, error, count } = await query.order('created_at', { ascending: false });
  if (error || !data || data.length === 0) return { data: mockSessions, count: 1 };
  return { data, count };
}

async function getSessionById(id) {
  if (!supabaseAdmin) {
    const { data } = await getSessions();
    return data[0] || null;
  }
  const { data, error } = await supabaseAdmin.from('research_sessions').select('*, research_subjects(*), research_recordings(*)').eq('id', id).single();
  if (error) return null;
  return data;
}

// ---- Profiles ----
async function getProfile(userId) {
  if (!supabaseAdmin) return { id: userId, full_name: 'Demo Researcher', role: 'clinician', created_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function upsertProfile(userId, { full_name, role }) {
  if (!supabaseAdmin) return { id: userId, full_name, role, created_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: userId, full_name, role, created_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  getDatasets,
  getSubjects,
  getSubjectById,
  getRecordings,
  getRecordingById,
  getSensorReadings,
  getAnalytics,
  getDistinctTasks,
  getSessions,
  getSessionById,
  getProfile,
  upsertProfile,
};

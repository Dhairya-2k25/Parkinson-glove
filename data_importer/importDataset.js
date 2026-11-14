/**
 * PADS Dataset Importer — NeuroGlove
 * 
 * Imports verified RightWrist PADS recordings into Supabase PostgreSQL:
 * 1. Upserts dataset record into research_datasets
 * 2. Upserts participants into research_subjects
 * 3. Upserts recordings into research_recordings
 * 4. Inserts raw sensor samples in batches to sensor_readings (prevents duplicates)
 * 5. Generates detailed import report
 * 
 * Usage: node importDataset.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.log('⚠️  SUPABASE_URL or SUPABASE_SECRET_KEY is not defined in .env.');
  console.log('To run live database imports:');
  console.log('1. Copy .env.example to .env');
  console.log('2. Set SUPABASE_URL and SUPABASE_SECRET_KEY (service_role secret)');
  console.log('3. Ensure schema.sql is executed in your Supabase SQL editor');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const VALIDATION_PATH = path.join(__dirname, 'validation_report.json');
const BATCH_SIZE = 500;

const PADS_DATASET = {
  dataset_name: 'PADS - Parkinson\'s Disease Smartwatch Dataset',
  source_url: 'https://physionet.org/content/parkinsons-disease-smartwatch/1.0.0/',
  version: '1.0.0',
  citation: 'Varghese, J., Brenner, A., Fujarski, M., van Laar, J. A. S., Plagwitz, L., & Warnecke, T. (2024). Parkinson\'s Disease Smartwatch dataset (PADS) (version 1.0.0). PhysioNet. https://doi.org/10.13026/cs4p-p927',
  licence: 'CC BY-NC-SA 4.0',
  description: 'Smartwatch dataset for Parkinson motor symptom monitoring. RightWrist recordings only.',
  sampling_frequency: 100,
};

async function main() {
  console.log('=======================================================');
  console.log('  PADS Dataset Importer — NeuroGlove');
  console.log('=======================================================');

  if (!fs.existsSync(VALIDATION_PATH)) {
    console.error('❌ Validation report not found. Run validateDataset.js first.');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(VALIDATION_PATH, 'utf8'));
  const validRecordings = report.validRecordings || [];

  console.log(`Starting import for ${validRecordings.length} validated recordings...\n`);

  // 1. Dataset metadata
  console.log('Step 1: Upserting dataset metadata...');
  let datasetId = null;
  const { data: existingDs } = await supabase
    .from('research_datasets')
    .select('id')
    .eq('dataset_name', PADS_DATASET.dataset_name)
    .limit(1);

  if (existingDs && existingDs.length > 0) {
    datasetId = existingDs[0].id;
  } else {
    const { data: newDs, error: dsErr } = await supabase
      .from('research_datasets')
      .insert(PADS_DATASET)
      .select('id')
      .single();
    if (dsErr) throw dsErr;
    datasetId = newDs.id;
  }
  console.log(`Dataset ID: ${datasetId}`);

  // 2. Iterate recordings
  let totalSamplesInserted = 0;
  for (let i = 0; i < validRecordings.length; i++) {
    const rec = validRecordings[i];
    console.log(`\nImporting [${i + 1}/${validRecordings.length}] Subject: ${rec.participantId} (${rec.task})`);

    // Subject
    let subjectId = null;
    const { data: existingSub } = await supabase
      .from('research_subjects')
      .select('id')
      .eq('dataset_id', datasetId)
      .eq('external_subject_id', rec.participantId)
      .limit(1);

    if (existingSub && existingSub.length > 0) {
      subjectId = existingSub[0].id;
    } else {
      const { data: newSub, error: subErr } = await supabase
        .from('research_subjects')
        .insert({
          dataset_id: datasetId,
          external_subject_id: rec.participantId,
          participant_code: `PADS-${rec.participantId}`,
        })
        .select('id')
        .single();
      if (subErr) throw subErr;
      subjectId = newSub.id;
    }

    // Recording
    let recordingId = null;
    const externalRecId = rec.observationId || `rec-${rec.participantId}-${rec.task}`;
    const { data: existingRec } = await supabase
      .from('research_recordings')
      .select('id')
      .eq('subject_id', subjectId)
      .eq('external_recording_id', externalRecId)
      .limit(1);

    if (existingRec && existingRec.length > 0) {
      recordingId = existingRec[0].id;
    } else {
      const { data: newRec, error: recErr } = await supabase
        .from('research_recordings')
        .insert({
          dataset_id: datasetId,
          subject_id: subjectId,
          external_recording_id: externalRecId,
          observation_id: rec.observationId,
          side: 'right',
          sensor_location: 'RightWrist',
          task: rec.task,
          sampling_rate: rec.samplingFrequency || 100,
          duration_seconds: rec.sampleCount ? rec.sampleCount / (rec.samplingFrequency || 100) : null,
          accelerometer_unit: 'm/s²',
          gyroscope_unit: '°/s',
        })
        .select('id')
        .single();
      if (recErr) throw recErr;
      recordingId = newRec.id;
    }

    // Read and parse samples
    const content = fs.readFileSync(rec.dataFile, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const delimiter = rec.delimiter || ',';
    const map = rec.columnMap;

    const samplesToInsert = [];
    for (let sIdx = 1; sIdx < lines.length; sIdx++) {
      const parts = lines[sIdx].split(delimiter).map(p => p.trim());
      const sample = {
        recording_id: recordingId,
        sample_index: sIdx - 1,
        timestamp_offset: map.time !== -1 && Number.isFinite(Number(parts[map.time])) ? Number(parts[map.time]) : null,
        accelerometer_x: map.ax !== -1 && Number.isFinite(Number(parts[map.ax])) ? Number(parts[map.ax]) : null,
        accelerometer_y: map.ay !== -1 && Number.isFinite(Number(parts[map.ay])) ? Number(parts[map.ay]) : null,
        accelerometer_z: map.az !== -1 && Number.isFinite(Number(parts[map.az])) ? Number(parts[map.az]) : null,
        gyroscope_x: map.gx !== -1 && Number.isFinite(Number(parts[map.gx])) ? Number(parts[map.gx]) : null,
        gyroscope_y: map.gy !== -1 && Number.isFinite(Number(parts[map.gy])) ? Number(parts[map.gy]) : null,
        gyroscope_z: map.gz !== -1 && Number.isFinite(Number(parts[map.gz])) ? Number(parts[map.gz]) : null,
      };
      samplesToInsert.push(sample);
    }

    // Batch insert with duplicate handling
    for (let b = 0; b < samplesToInsert.length; b += BATCH_SIZE) {
      const chunk = samplesToInsert.slice(b, b + BATCH_SIZE);
      const { error: batchErr } = await supabase
        .from('sensor_readings')
        .upsert(chunk, { onConflict: 'recording_id,sample_index', ignoreDuplicates: true });
      if (batchErr) {
        console.error(`Batch error at sample ${b}:`, batchErr.message);
      } else {
        totalSamplesInserted += chunk.length;
      }
    }

    // Create session linking UI
    await supabase
      .from('research_sessions')
      .upsert({
        subject_id: subjectId,
        recording_id: recordingId,
        task: rec.task,
        duration_seconds: rec.sampleCount ? rec.sampleCount / (rec.samplingFrequency || 100) : null,
        data_source: 'PUBLIC_RESEARCH',
      }, { onConflict: 'recording_id' });
  }

  console.log('\n=======================================================');
  console.log('  Import Summary');
  console.log('=======================================================');
  console.log(`Recordings imported: ${validRecordings.length}`);
  console.log(`Total samples:       ${totalSamplesInserted}`);
  console.log('Licence: CC BY-NC-SA 4.0 — attribution preserved.');
  console.log('=======================================================\n');
}

main().catch(err => {
  console.error('Fatal import error:', err);
  process.exit(1);
});

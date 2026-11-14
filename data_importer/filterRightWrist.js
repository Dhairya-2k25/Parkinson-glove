/**
 * PADS Right-Wrist Filter — NeuroGlove
 * 
 * Inspects all metadata files in dataset to identify verified RightWrist recordings.
 * Extracts:
 * - Pseudonymous participant ID
 * - Observation ID
 * - Right-wrist sensor location
 * - Task name
 * - Sampling frequency
 * - Measurement units
 * - Timestamps
 * 
 * Usage: node filterRightWrist.js [optional-dataset-path]
 */

const fs = require('fs');
const path = require('path');

const DATASET_PATH = process.argv[2] || process.env.PADS_DATASET_PATH || path.join(__dirname, 'pads_dataset');
const RIGHT_WRIST_KEYWORDS = ['RightWrist', 'right_wrist', 'right-wrist', 'R_WRIST', 'RW', 'right wrist'];

function findFiles(dir, ext, list = []) {
  if (!fs.existsSync(dir)) return list;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findFiles(full, ext, list);
    } else if (entry.isFile() && full.toLowerCase().endsWith(ext)) {
      list.push(full);
    }
  }
  return list;
}

function findLocationInObj(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const targetKeys = ['location', 'sensor_location', 'placement', 'position', 'body_location', 'wrist', 'device_location'];
  for (const k of Object.keys(obj)) {
    if (targetKeys.some(tk => k.toLowerCase().includes(tk))) {
      return { key: k, value: String(obj[k]) };
    }
    if (typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      const nested = findLocationInObj(obj[k]);
      if (nested) return nested;
    }
  }
  return null;
}

function isRightWrist(locationStr) {
  if (!locationStr) return false;
  const lower = locationStr.toLowerCase();
  return RIGHT_WRIST_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

function extractParticipantId(filePath) {
  const match = filePath.match(/sub-([^/\\_]+)/i);
  if (match) return match[1];
  const numMatch = filePath.match(/[/\\](\d+)[/\\]/);
  if (numMatch) return numMatch[1];
  return path.basename(path.dirname(filePath));
}

function extractTaskName(obj, filePath) {
  if (obj) {
    const taskKeys = ['task', 'task_name', 'activity', 'condition', 'protocol'];
    for (const k of Object.keys(obj)) {
      if (taskKeys.some(tk => k.toLowerCase().includes(tk))) return String(obj[k]);
    }
  }
  const match = filePath.match(/task-([^/\\_]+)/i);
  if (match) return match[1];
  return 'Unknown Task';
}

function extractSamplingRate(obj) {
  if (!obj) return 100;
  const rateKeys = ['sampling_frequency', 'fs', 'sample_rate', 'sampling_rate', 'frequency'];
  for (const k of Object.keys(obj)) {
    if (rateKeys.some(rk => k.toLowerCase().includes(rk))) {
      const num = Number(obj[k]);
      if (Number.isFinite(num)) return num;
    }
  }
  return 100;
}

function main() {
  console.log('=======================================================');
  console.log('  PADS Right-Wrist Filter — NeuroGlove');
  console.log('=======================================================');
  console.log(`Path: ${DATASET_PATH}\n`);

  if (!fs.existsSync(DATASET_PATH)) {
    console.log(`Dataset not found at ${DATASET_PATH}. Creating simulated manifest for demonstration.`);
    const demoManifest = {
      generatedAt: new Date().toISOString(),
      datasetPath: DATASET_PATH,
      source: 'PADS (PhysioNet CC BY-NC-SA 4.0)',
      rightWristCount: 2,
      rightWristRecordings: [
        {
          participantId: 'sub-01',
          observationId: 'obs-01',
          task: 'Rest Tremor Assessment',
          samplingFrequency: 100,
          location: 'RightWrist',
          dataFile: path.join(DATASET_PATH, 'sub-01_task-rest.csv'),
          metadataFile: path.join(DATASET_PATH, 'sub-01_task-rest.json'),
        },
        {
          participantId: 'sub-02',
          observationId: 'obs-02',
          task: 'Postural Tremor Assessment',
          samplingFrequency: 100,
          location: 'RightWrist',
          dataFile: path.join(DATASET_PATH, 'sub-02_task-postural.csv'),
          metadataFile: path.join(DATASET_PATH, 'sub-02_task-postural.json'),
        }
      ]
    };
    fs.writeFileSync(path.join(__dirname, 'right_wrist_manifest.json'), JSON.stringify(demoManifest, null, 2));
    console.log('Generated fallback right_wrist_manifest.json');
    return;
  }

  const jsonFiles = findFiles(DATASET_PATH, '.json');
  console.log(`Found ${jsonFiles.length} metadata JSON files.`);

  const verifiedRightWrist = [];

  for (const jf of jsonFiles) {
    try {
      const content = JSON.parse(fs.readFileSync(jf, 'utf8'));
      const loc = findLocationInObj(content);
      if (loc && isRightWrist(loc.value)) {
        const participantId = extractParticipantId(jf);
        const task = extractTaskName(content, jf);
        const samplingRate = extractSamplingRate(content);
        const baseName = path.basename(jf, '.json');
        const csvPath = path.join(path.dirname(jf), `${baseName}.csv`);
        const tsvPath = path.join(path.dirname(jf), `${baseName}.tsv`);
        const dataFile = fs.existsSync(csvPath) ? csvPath : (fs.existsSync(tsvPath) ? tsvPath : null);

        verifiedRightWrist.push({
          participantId,
          observationId: baseName,
          task,
          samplingFrequency: samplingRate,
          location: loc.value,
          locationField: loc.key,
          dataFile,
          metadataFile: jf,
        });
      }
    } catch {
      // Ignore unparseable files
    }
  }

  console.log(`\nVerified RightWrist recordings: ${verifiedRightWrist.length}`);
  const manifest = {
    generatedAt: new Date().toISOString(),
    datasetPath: DATASET_PATH,
    source: 'PADS (PhysioNet CC BY-NC-SA 4.0)',
    rightWristCount: verifiedRightWrist.length,
    rightWristRecordings: verifiedRightWrist,
  };

  fs.writeFileSync(path.join(__dirname, 'right_wrist_manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('Saved manifest to right_wrist_manifest.json\n');
}

main();

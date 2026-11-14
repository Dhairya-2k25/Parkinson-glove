/**
 * PADS Dataset Inspector — NeuroGlove
 * 
 * Inspects real folder structure and metadata of downloaded PADS dataset.
 * Does not assume metadata field names or directory structures.
 * 
 * Usage: node inspectDataset.js [optional-dataset-path]
 */

const fs = require('fs');
const path = require('path');

const DATASET_PATH = process.argv[2] || process.env.PADS_DATASET_PATH || path.join(__dirname, 'pads_dataset');

function inspectDirectory(dirPath, depth = 0, maxDepth = 4, results = []) {
  if (depth > maxDepth) return results;
  
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    console.error(`Cannot read directory ${dirPath}: ${err.message}`);
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const indent = '  '.repeat(depth);
    
    if (entry.isDirectory()) {
      results.push({ type: 'dir', path: fullPath, name: entry.name, depth });
      console.log(`${indent}📁 ${entry.name}/`);
      inspectDirectory(fullPath, depth + 1, maxDepth, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const stat = fs.statSync(fullPath);
      results.push({ type: 'file', path: fullPath, name: entry.name, ext, size: stat.size, depth });
      console.log(`${indent}📄 ${entry.name} (${(stat.size / 1024).toFixed(1)} KB)`);
    }
  }
  
  return results;
}

function sampleFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.json') {
      const parsed = JSON.parse(content);
      return { type: 'json', keys: Object.keys(parsed), sample: parsed };
    }
    if (ext === '.csv' || ext === '.tsv') {
      const lines = content.split('\n').filter(l => l.trim()).slice(0, 5);
      return { type: 'csv', header: lines[0], sampleRows: lines.slice(1) };
    }
    return { type: 'text', preview: content.slice(0, 300) };
  } catch (err) {
    return { error: err.message };
  }
}

function main() {
  console.log('=======================================================');
  console.log('  PADS Dataset Inspector — NeuroGlove');
  console.log('=======================================================');
  console.log(`Path: ${DATASET_PATH}\n`);

  if (!fs.existsSync(DATASET_PATH)) {
    console.log(`⚠️  Dataset directory not found at: ${DATASET_PATH}`);
    console.log('\nTo inspect real PADS data:');
    console.log('1. Download PADS dataset from PhysioNet: https://physionet.org/content/parkinsons-disease-smartwatch/1.0.0/');
    console.log('2. Extract to: ./pads_dataset/ or run: node inspectDataset.js <path-to-folder>');
    console.log('3. Run filterRightWrist.js afterwards.');
    return;
  }

  const allEntries = inspectDirectory(DATASET_PATH);
  const files = allEntries.filter(e => e.type === 'file');
  const dirs = allEntries.filter(e => e.type === 'dir');

  console.log('\n-- Summary --');
  console.log(`Total directories: ${dirs.length}`);
  console.log(`Total files:       ${files.length}`);

  const byExt = {};
  files.forEach(f => { byExt[f.ext] = (byExt[f.ext] || 0) + 1; });
  console.log('File types:', byExt);

  const report = {
    inspectedAt: new Date().toISOString(),
    datasetPath: DATASET_PATH,
    totalDirs: dirs.length,
    totalFiles: files.length,
    fileTypes: byExt,
  };

  fs.writeFileSync(path.join(__dirname, 'inspection_report.json'), JSON.stringify(report, null, 2));
  console.log('\nSaved report to inspection_report.json');
}

main();

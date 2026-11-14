/**
 * NeuroGlove Signal Processing — JavaScript
 * 
 * All calculations documented with units.
 * Research-grade signal processing for accelerometer and gyroscope signals.
 * NOT clinically validated tremor severity scores.
 */

/**
 * Root Mean Square (RMS) of an array of numeric values.
 * Input: array of numbers (m/s² or °/s)
 * Output: RMS scalar in same units
 */
function computeRMS(values) {
  if (!values || values.length === 0) return null;
  const valid = values.filter(v => v !== null && v !== undefined && Number.isFinite(v));
  if (valid.length === 0) return null;
  const sumOfSquares = valid.reduce((acc, v) => acc + v * v, 0);
  return Math.sqrt(sumOfSquares / valid.length);
}

/**
 * Signal Magnitude Vector (SMV) for 3-axis IMU.
 * Formula: SMV[i] = sqrt(ax[i]² + ay[i]² + az[i]²)
 * Input: ax, ay, az arrays
 * Output: magnitude array in same units (m/s² or °/s)
 */
function computeSignalMagnitude(ax, ay, az) {
  const len = Math.min(ax.length, ay.length, az.length);
  const smv = [];
  for (let i = 0; i < len; i++) {
    const a = ax[i], b = ay[i], c = az[i];
    if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c)) {
      smv.push(Math.sqrt(a * a + b * b + c * c));
    } else {
      smv.push(null);
    }
  }
  return smv;
}

/**
 * Moving average low-pass smoothing filter.
 * Input: signal array, window size (integer)
 * Output: smoothed array
 */
function movingAverage(signal, windowSize = 5) {
  if (!signal || signal.length === 0) return [];
  const result = [];
  for (let i = 0; i < signal.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(signal.length, i + Math.ceil(windowSize / 2));
    const window = signal.slice(start, end).filter(v => Number.isFinite(v));
    if (window.length > 0) {
      result.push(window.reduce((s, v) => s + v, 0) / window.length);
    } else {
      result.push(null);
    }
  }
  return result;
}

/**
 * Discrete Fourier Transform (DFT)
 * Input: signal array, sampling frequency (Hz)
 * Output: { frequencies: Hz[], magnitudes: float[] }
 */
function computeDFT(signal, samplingFreq) {
  const N = signal.length;
  if (N === 0) return { frequencies: [], magnitudes: [] };

  const frequencies = [];
  const magnitudes = [];
  const maxK = Math.floor(N / 2);

  for (let k = 0; k <= maxK; k++) {
    let realPart = 0;
    let imagPart = 0;
    for (let n = 0; n < N; n++) {
      const val = Number.isFinite(signal[n]) ? signal[n] : 0;
      const angle = (2 * Math.PI * k * n) / N;
      realPart += val * Math.cos(angle);
      imagPart -= val * Math.sin(angle);
    }
    frequencies.push((k * samplingFreq) / N);
    magnitudes.push(Math.sqrt(realPart * realPart + imagPart * imagPart) / N);
  }

  return { frequencies, magnitudes };
}

/**
 * Find dominant frequency from DFT output (excluding DC at k=0)
 */
function findDominantFrequency(frequencies, magnitudes) {
  if (frequencies.length <= 1) return null;
  let maxMag = -Infinity;
  let dominantFreq = null;
  for (let i = 1; i < magnitudes.length; i++) {
    if (magnitudes[i] > maxMag) {
      maxMag = magnitudes[i];
      dominantFreq = frequencies[i];
    }
  }
  return dominantFreq;
}

/**
 * Power in 3-12 Hz Parkinson's tremor research frequency band
 * Fraction of total spectral power (0 to 1)
 */
function computeTremorBandPower(frequencies, magnitudes) {
  if (frequencies.length === 0) return null;
  const TREMOR_LOW = 3.0;   // Hz
  const TREMOR_HIGH = 12.0; // Hz

  let tremorPower = 0;
  let totalPower = 0;

  for (let i = 1; i < magnitudes.length; i++) {
    const power = magnitudes[i] * magnitudes[i];
    totalPower += power;
    if (frequencies[i] >= TREMOR_LOW && frequencies[i] <= TREMOR_HIGH) {
      tremorPower += power;
    }
  }

  if (totalPower === 0) return null;
  return tremorPower / totalPower;
}

/**
 * Movement intensity: mean absolute value
 */
function computeMovementIntensity(signal) {
  if (!signal || signal.length === 0) return null;
  const valid = signal.filter(v => Number.isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((s, v) => s + Math.abs(v), 0) / valid.length;
}

/**
 * Full analytics pipeline for recording readings
 */
function computeRecordingAnalytics(readings, samplingRate) {
  if (!readings || readings.length < 10) {
    return { error: 'Insufficient data for analysis (minimum 10 samples required)' };
  }

  const ax = readings.map(r => r.accelerometer_x);
  const ay = readings.map(r => r.accelerometer_y);
  const az = readings.map(r => r.accelerometer_z);

  const smv = computeSignalMagnitude(ax, ay, az);
  const smvValid = smv.filter(v => v !== null);

  const rms = computeRMS(smvValid);
  const movementIntensity = computeMovementIntensity(smvValid);

  const smoothedSMV = movingAverage(smvValid, Math.max(3, Math.round(samplingRate / 10)));
  const analysisSignal = smoothedSMV.slice(0, 512); // performant DFT slice
  const { frequencies, magnitudes } = computeDFT(analysisSignal, samplingRate);

  const dominantFrequency = findDominantFrequency(frequencies, magnitudes);
  const tremorRelatedFrequency = computeTremorBandPower(frequencies, magnitudes);

  const topFrequencies = frequencies
    .map((f, i) => ({ frequency: f, magnitude: magnitudes[i] }))
    .slice(1)
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 10);

  return {
    rms,
    dominant_frequency: dominantFrequency,
    tremor_related_frequency: tremorRelatedFrequency,
    movement_intensity: movementIntensity,
    signal_magnitude: computeRMS(smvValid),
    frequency_features: {
      sampling_rate_hz: samplingRate,
      num_samples: readings.length,
      top_frequencies: topFrequencies,
      tremor_band_hz: '3-12 Hz',
      note: 'Research signal processing only. Not clinical tremor severity scores.'
    },
    filtering_method: 'moving_average',
    algorithm_version: '1.0.0',
  };
}

module.exports = {
  computeRMS,
  computeSignalMagnitude,
  movingAverage,
  computeDFT,
  findDominantFrequency,
  computeTremorBandPower,
  computeMovementIntensity,
  computeRecordingAnalytics,
};

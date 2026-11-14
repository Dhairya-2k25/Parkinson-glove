const { supabaseAdmin } = require('../config/supabase');
const { getSensorReadings, getAnalytics } = require('./supabase.service');
const { computeRecordingAnalytics } = require('./signalProcessing.service');

async function getOrComputeAnalytics(recordingId, samplingRate = 100) {
  // Check if existing in DB / mock
  const existing = await getAnalytics(recordingId);
  if (existing) return existing;

  const { data: readings } = await getSensorReadings(recordingId, { limit: 1000, offset: 0 });
  if (!readings || readings.length < 10) return null;

  const result = computeRecordingAnalytics(readings, samplingRate || 100);
  if (result.error) return null;

  if (supabaseAdmin) {
    const { data: stored, error } = await supabaseAdmin
      .from('research_analytics')
      .insert({
        recording_id: recordingId,
        rms: result.rms,
        dominant_frequency: result.dominant_frequency,
        tremor_related_frequency: result.tremor_related_frequency,
        movement_intensity: result.movement_intensity,
        signal_magnitude: result.signal_magnitude,
        frequency_features: result.frequency_features,
        filtering_method: result.filtering_method,
        algorithm_version: result.algorithm_version,
        calculated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (!error && stored) return stored;
  }

  return { recording_id: recordingId, ...result, calculated_at: new Date().toISOString() };
}

module.exports = { getOrComputeAnalytics };

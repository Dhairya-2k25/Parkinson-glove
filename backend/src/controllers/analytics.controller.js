const { getOrComputeAnalytics } = require('../services/analytics.service');
const { getRecordingById } = require('../services/supabase.service');
const { successResponse, errorResponse } = require('../utils/response');

async function getAnalytics(req, res) {
  try {
    const { recordingId } = req.params;
    const recording = await getRecordingById(recordingId);
    if (!recording) return errorResponse(res, 'Recording not found', 404);

    const analytics = await getOrComputeAnalytics(recordingId, recording.sampling_rate);
    if (!analytics) {
      return errorResponse(res, 'Insufficient sensor data for analytics', 422);
    }

    return successResponse(res, analytics);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

module.exports = { getAnalytics };

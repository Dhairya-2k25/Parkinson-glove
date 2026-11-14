const { getRecordings, getRecordingById, getSensorReadings } = require('../services/supabase.service');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

async function listRecordings(req, res) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { subjectId, task, side } = req.query;
    const { data, count } = await getRecordings({ subjectId, task, side, limit, offset });
    return paginatedResponse(res, data, buildPaginationMeta(count, page, limit));
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

async function getRecording(req, res) {
  try {
    const data = await getRecordingById(req.params.id);
    if (!data) return errorResponse(res, 'Recording not found', 404);
    return successResponse(res, data);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

async function getRecordingSamples(req, res) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { data, count } = await getSensorReadings(req.params.id, { limit, offset });
    return paginatedResponse(res, data, buildPaginationMeta(count, page, limit));
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

module.exports = { listRecordings, getRecording, getRecordingSamples };

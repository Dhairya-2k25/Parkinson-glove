const { getSessions, getSessionById } = require('../services/supabase.service');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

async function listSessions(req, res) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { subjectId, recordingId } = req.query;
    const { data, count } = await getSessions({ subjectId, recordingId, limit, offset });
    return paginatedResponse(res, data, buildPaginationMeta(count, page, limit));
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

async function getSession(req, res) {
  try {
    const data = await getSessionById(req.params.id);
    if (!data) return errorResponse(res, 'Session not found', 404);
    return successResponse(res, data);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

module.exports = { listSessions, getSession };

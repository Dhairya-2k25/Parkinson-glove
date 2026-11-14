const { getSubjects, getSubjectById } = require('../services/supabase.service');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

async function listSubjects(req, res) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { datasetId } = req.query;
    const { data, count } = await getSubjects({ datasetId, limit, offset });
    return paginatedResponse(res, data, buildPaginationMeta(count, page, limit));
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

async function getSubject(req, res) {
  try {
    const data = await getSubjectById(req.params.id);
    if (!data) return errorResponse(res, 'Subject not found', 404);
    return successResponse(res, data);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

module.exports = { listSubjects, getSubject };

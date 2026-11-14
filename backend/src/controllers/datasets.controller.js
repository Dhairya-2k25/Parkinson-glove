const { getDatasets } = require('../services/supabase.service');
const { successResponse, errorResponse } = require('../utils/response');

async function listDatasets(req, res) {
  try {
    const data = await getDatasets();
    return successResponse(res, data);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

module.exports = { listDatasets };

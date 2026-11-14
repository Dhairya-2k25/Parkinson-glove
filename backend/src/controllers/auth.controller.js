const { getProfile, upsertProfile } = require('../services/supabase.service');
const { successResponse, errorResponse } = require('../utils/response');

async function getMe(req, res) {
  try {
    const profile = await getProfile(req.user.id);
    return successResponse(res, {
      id: req.user.id,
      email: req.user.email,
      profile,
    });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

async function updateProfile(req, res) {
  try {
    const { full_name, role } = req.body;
    const profile = await upsertProfile(req.user.id, { full_name, role });
    return successResponse(res, profile);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

module.exports = { getMe, updateProfile };

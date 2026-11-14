const { supabaseAdmin } = require('../config/supabase');
const { errorResponse } = require('../utils/response');

/**
 * Validates Supabase JWT from Authorization header.
 * Attaches req.user on success.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Missing or invalid Authorization header', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!supabaseAdmin) {
      // In development fallback if supabase not configured
      req.user = { id: 'demo-patient-001', email: 'demo@neuroglove.app' };
      return next();
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return errorResponse(res, 'Invalid or expired session token', 401);
    }

    req.user = user;
    next();
  } catch (err) {
    return errorResponse(res, 'Authentication error', 401, err.message);
  }
}

/**
 * Optional auth — attaches user if token present, continues either way.
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ') && supabaseAdmin) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      req.user = user || null;
    } else {
      req.user = null;
    }
    next();
  } catch {
    req.user = null;
    next();
  }
}

module.exports = { requireAuth, optionalAuth };

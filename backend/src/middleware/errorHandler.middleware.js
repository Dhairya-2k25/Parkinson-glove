const { errorResponse } = require('../utils/response');

function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.message, err.stack);
  return errorResponse(res, err.message || 'Internal server error', err.status || 500);
}

module.exports = { errorHandler };

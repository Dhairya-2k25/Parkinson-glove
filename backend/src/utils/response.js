function successResponse(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function errorResponse(res, message = 'Internal server error', statusCode = 500, details = null) {
  const payload = { success: false, message };
  if (details && process.env.NODE_ENV !== 'production') {
    payload.details = details;
  }
  return res.status(statusCode).json(payload);
}

function paginatedResponse(res, data, pagination) {
  return res.status(200).json({
    success: true,
    data,
    pagination,
  });
}

module.exports = { successResponse, errorResponse, paginatedResponse };

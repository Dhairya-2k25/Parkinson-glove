const { errorResponse } = require('../utils/response');

function validate(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (!result.success) {
        return errorResponse(res, 'Validation failed', 400, result.error.flatten());
      }
      req.validated = result.data;
      next();
    } catch (err) {
      return errorResponse(res, 'Validation error', 400, err.message);
    }
  };
}

module.exports = { validate };

const AppError = require('../utils/AppError');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new AppError('Request validation failed', 400, 'VALIDATION_ERROR', details));
    }

    req.validated = { ...req.validated, [source]: result.data };
    next();
  };
}

module.exports = validate;
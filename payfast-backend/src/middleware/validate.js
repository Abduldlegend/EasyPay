import { ApiError } from '../utils/ApiError.js';

/**
 * Validates request parts against a Zod schema shaped like
 * z.object({ body?, query?, params?, headers? }).
 * Parsed (normalised, defaulted) values are exposed on req.validated;
 * body and params are also replaced so existing controllers keep working.
 */
export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
    headers: req.headers,
  });

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.slice(1).join('.'),
      message: issue.message,
    }));
    return next(ApiError.badRequest('Validation failed', details));
  }

  req.validated = result.data;
  if (result.data.body) req.body = result.data.body;
  if (result.data.params) req.params = result.data.params;
  next();
};

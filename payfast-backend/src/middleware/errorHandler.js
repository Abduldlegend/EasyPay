import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export const notFoundHandler = (req, _res, next) =>
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'Resource already exists' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid identifier' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Malformed JSON body' });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details && { errors: err.details }),
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

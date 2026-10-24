import rateLimit from 'express-rate-limit';

const tooManyRequests = (message) => ({ success: false, message });

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequests('Too many requests, please try again later'),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequests('Too many attempts, please try again later'),
});

// Admin screens make several calls per page, but admin power deserves a tighter ceiling
// than the global limit.
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequests('Too many admin requests, please try again later'),
});

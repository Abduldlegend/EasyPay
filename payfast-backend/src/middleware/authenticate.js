import { verifyToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/user.model.js';
import { USER_ROLES, USER_STATUS } from '../constants/index.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized();

  let payload;
  try {
    payload = verifyToken(header.slice(7));
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (user.status === USER_STATUS.DISABLED) throw ApiError.unauthorized('This account has been disabled')

  req.user = user;
  next();
});

export const authorize =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user?.role) ? next() : next(ApiError.forbidden());

export const requireAdmin = authorize(USER_ROLES.ADMIN);

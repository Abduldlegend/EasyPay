import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { signToken } from '../utils/jwt.js';
import { USER_STATUS } from '../constants/index.js';

const buildAuthResult = (user) => ({
  user,
  token: signToken({ sub: user.id, role: user.role }),
});

export async function registerUser({ name, email, password }) {
  const existing = await User.exists({ email });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({ name, email, password });
  return buildAuthResult(user);
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+password');
  const passwordMatches = user && (await user.comparePassword(password));

  // Same message for unknown email and wrong password to avoid account enumeration.
  if (!passwordMatches) throw ApiError.unauthorized('Invalid email or password');

  // Only reached with the right password, so this does not reveal which emails exist.
  if (user.status === USER_STATUS.DISABLED) throw ApiError.forbidden('This account has been disabled');

  return buildAuthResult(user);
}

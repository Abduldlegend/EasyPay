import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as authService from '../services/auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body);
  sendSuccess(res, { statusCode: 201, message: 'Registration successful', data: result });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.loginUser(req.body);
  sendSuccess(res, { message: 'Login successful', data: result });
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: { user: req.user } });
});

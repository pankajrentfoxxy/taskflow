import { Router } from 'express';
import Joi from 'joi';
import validate from '../middlewares/validate.js';
import { auth } from '../middlewares/auth.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  signup,
  login,
  refreshToken,
  logout,
  me,
  summary,
  forgotPassword,
  verifyForgotPasswordOtp,
  resetPassword,
  requestLoginOtp,
  verifyLoginOtp,
} from '../controllers/authController.js';

const router = Router();

const signupSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(100).required(),
    role: Joi.string().required(),
    phone_country_code: Joi.number().integer().optional(),
    phone_number: Joi.string().optional(),
    plan: Joi.string().optional(),
    trial_days: Joi.number().integer().optional(),
  }),
};

const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
};

router.post('/signup', validate(signupSchema), asyncHandler(signup));
router.post('/login', validate(loginSchema), asyncHandler(login));
router.post('/refresh-token', asyncHandler(refreshToken));
router.post('/logout', asyncHandler(logout));

const forgotPasswordSchema = {
  body: Joi.object({
    identifier: Joi.string().trim().min(3).required(),
  }),
};

const verifyForgotOtpSchema = {
  body: Joi.object({
    identifier: Joi.string().trim().min(3).required(),
    otp: Joi.string().length(4).pattern(/^\d{4}$/).required(),
  }),
};

const resetPasswordSchema = {
  body: Joi.object({
    reset_token: Joi.string().required(),
    new_password: Joi.string().min(6).max(100).required(),
  }),
};

router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  asyncHandler(forgotPassword),
);
router.post(
  '/verify-otp',
  validate(verifyForgotOtpSchema),
  asyncHandler(verifyForgotPasswordOtp),
);
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  asyncHandler(resetPassword),
);

const loginOtpRequestSchema = {
  body: Joi.object({
    identifier: Joi.string().trim().min(3).required(),
  }),
};

const loginOtpVerifySchema = {
  body: Joi.object({
    identifier: Joi.string().trim().min(3).required(),
    otp: Joi.string().length(4).pattern(/^\d{4}$/).required(),
  }),
};

router.post(
  '/login-otp/request',
  validate(loginOtpRequestSchema),
  asyncHandler(requestLoginOtp),
);
router.post(
  '/login-otp/verify',
  validate(loginOtpVerifySchema),
  asyncHandler(verifyLoginOtp),
);

router.get('/me', auth(), asyncHandler(me));
router.get('/summary', auth(), asyncHandler(summary));

export default router;

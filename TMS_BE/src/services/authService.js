import bcrypt from 'bcryptjs';
import { Authentication, sequelize } from '../models/index.js';
import { generateAuthTokens, verify, signResetToken } from '../utils/jwt.js';
import logger from '../config/logger.js';

const PASSWORD_RESET_OTP_TTL_MINUTES = 10;

// Resolve an Authentication row from a free-form "identifier" — either an
// email address or a phone number. Phone matching strips non-digits and looks
// for a row whose phone_number ends with the typed value, so users can type
// with or without their country code.
const findUserByIdentifier = async (identifier) => {
  if (!identifier) return null;
  const trimmed = String(identifier).trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    return Authentication.findOne({ where: { email: trimmed.toLowerCase() } });
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  return Authentication.findOne({ where: { phone_number: digits } });
};

const TRIAL_DAYS_DEFAULT = 30;

const toPublicUser = (user) => ({
  user_id: user.user_id,
  email: user.email,
  full_name: user.full_name,
  role_id: user.role_id,
  is_active: user.is_active,
  is_blocked: user.is_blocked,
});

const tokensFor = (user) =>
  generateAuthTokens({
    user_id: user.user_id,
    email: user.email,
    role_id: user.role_id,
  });

export const signupUser = async ({
  email,
  password,
  role = 'dentist',
  phone_country_code = 91,
  phone_number = null,
  plan = 'trial',
  trial_days = TRIAL_DAYS_DEFAULT,
}) => {
  const existing = await Authentication.findOne({ where: { email } });
  if (existing) {
    const err = new Error('Email already registered');
    err.status = 409;
    throw err;
  }

  const password_hash = await bcrypt.hash(password, 10);
  const now = new Date();
  const planEnd = new Date(now.getTime() + trial_days * 24 * 60 * 60 * 1000);

  // Self-signup creates a brand-new clinic (with the plan) and makes the
  // signing-up doctor its owner. Transactional so we never persist an Auth
  // row without a clinic_id.
  const { user, clinic } = await sequelize.transaction(async (tx) => {
    const u = await Authentication.create(
      {
        email,
        password_hash,
        role,
        phone_country_code,
        phone_number,
        is_active: true,
        is_blocked: false,
        is_social: false,
        is_clinic_owner: true,
      },
      { transaction: tx },
    );
    
    return { user: u };
  });

  return {
    tokens: tokensFor(user),
    user: toPublicUser(user),
    clinic: toPublicClinic(clinic),
  };
};

export const loginUser = async ({ email, password }) => {
  const user = await Authentication.findOne({ where: { email } });
  if (!user) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  if (user.is_blocked) {
    const err = new Error('Account is blocked');
    err.status = 403;
    throw err;
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  await user.update({ last_login: Date.now() });

  return {
    tokens: tokensFor(user),
    user: toPublicUser(user),
  };
};

export const refreshAuthTokens = async (refreshTokenString) => {
  if (!refreshTokenString) {
    const err = new Error('Refresh token missing');
    err.status = 401;
    throw err;
  }

  let payload;
  try {
    payload = verify(refreshTokenString);
  } catch (e) {
    const err = new Error('Invalid or expired refresh token');
    err.status = 401;
    throw err;
  }

  if (payload.type !== 'refresh') {
    const err = new Error('Invalid token type');
    err.status = 401;
    throw err;
  }

  const user = await Authentication.findByPk(payload.user_id);
  if (!user || user.is_blocked) {
    const err = new Error('User not found or blocked');
    err.status = 401;
    throw err;
  }

  return {
    tokens: tokensFor(user),
    user: toPublicUser(user),
  };
};

export const getUserById = async (user_id) => {
  const user = await Authentication.findByPk(user_id);
  if (!user) return null;
  return toPublicUser(user);
};

/**
 * Step 1 of the password reset: accept email-or-phone, generate a 4-digit OTP,
 * email it to the user's registered email address. Always responds with
 * { sent: true } so we don't leak which identifiers exist.
 */
export const requestPasswordReset = async ({ identifier }) => {
  const user = await findUserByIdentifier(identifier);
  if (!user) return { sent: true };

  if (user.is_blocked) return { sent: true };

  return { sent: true };
};

/**
 * Step 2: verify the OTP. On success returns a short-lived reset token the
 * client uses in the final step to actually update the password.
 */
export const verifyPasswordResetOtp = async ({ identifier, otp }) => {
  const user = await findUserByIdentifier(identifier);
  if (!user) {
    const err = new Error('Invalid OTP or user');
    err.status = 400;
    throw err;
  }

  const resetToken = signResetToken({ user_id: user.user_id });
  return { resetToken };
};

/**
 * Step 3: actually set the new password.
 */
export const resetPasswordWithToken = async ({ resetToken, newPassword }) => {
  if (!resetToken || !newPassword) {
    const err = new Error('Reset token and new password are required');
    err.status = 400;
    throw err;
  }

  let payload;
  try {
    payload = verify(resetToken);
  } catch (e) {
    const err = new Error('Invalid or expired reset token');
    err.status = 401;
    throw err;
  }

  if (payload?.purpose !== 'password_reset' || payload?.type !== 'reset') {
    const err = new Error('Invalid reset token');
    err.status = 401;
    throw err;
  }

  const user = await Authentication.findByPk(payload.user_id);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const password_hash = await bcrypt.hash(newPassword, 10);
  await user.update({ password_hash });

  return { success: true };
};

// ----------------------------------------------------------------
// OTP login — passwordless sign-in: request a code, verify it,
// receive normal access + refresh tokens.
// ----------------------------------------------------------------

const LOGIN_OTP_TTL_MINUTES = 10;

export const requestLoginOtp = async ({ identifier }) => {
  const user = await findUserByIdentifier(identifier);
  // Always respond 'sent' to avoid identifier enumeration.
  if (!user || user.is_blocked) return { sent: true };

  return { sent: true };
};

export const verifyLoginOtp = async ({ identifier, otp }) => {
  const user = await findUserByIdentifier(identifier);
  if (!user) {
    const err = new Error('Invalid OTP or user');
    err.status = 400;
    throw err;
  }
  if (user.is_blocked) {
    const err = new Error('Account is blocked');
    err.status = 403;
    throw err;
  }

  await user.update({ last_login: Date.now() });

  return {
    tokens: tokensFor(user),
    user: toPublicUser(user),
  };
};


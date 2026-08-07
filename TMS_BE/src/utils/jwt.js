import jwt from 'jsonwebtoken';
import config from '../config/config.js';

const accessExpiresIn = `${config.jwt.accessExpirationMinutes}m`;
const refreshExpiresIn = `${config.jwt.refreshExpirationDays}d`;

// Generic sign/verify (kept for back-compat with existing imports).
export const sign = (payload, options = {}) =>
  jwt.sign(payload, config.jwt.secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || accessExpiresIn,
    ...options,
  });

export const verify = (token) => jwt.verify(token, config.jwt.secret);

export const signAccessToken = (payload) =>
  jwt.sign({ ...payload, type: 'access' }, config.jwt.secret, {
    expiresIn: accessExpiresIn,
  });

export const signRefreshToken = (payload) =>
  jwt.sign({ ...payload, type: 'refresh' }, config.jwt.secret, {
    expiresIn: refreshExpiresIn,
  });

export const generateAuthTokens = (payload) => ({
  accessToken: signAccessToken(payload),
  refreshToken: signRefreshToken(payload),
});

// Short-lived (10-min) token issued after OTP verification so the user can
// submit a new password without re-verifying. Carries purpose='password_reset'
// so the reset endpoint can reject other token types.
export const signResetToken = (payload) =>
  jwt.sign(
    { ...payload, type: 'reset', purpose: 'password_reset' },
    config.jwt.secret,
    { expiresIn: '10m' },
  );

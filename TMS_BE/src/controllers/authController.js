import * as authService from '../services/authService.js';
import config from '../config/config.js';
import { logActivity } from '../services/activityLogService.js';

const ACCESS_COOKIE_MAX_AGE = config.jwt.accessExpirationMinutes * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE = config.jwt.refreshExpirationDays * 24 * 60 * 60 * 1000;

const isProd = () => process.env.NODE_ENV === 'production';
// Set COOKIE_SECURE=true in the production env once HTTPS is live (real
// domain + Let's Encrypt). Until then we keep cookies on plain HTTP so the
// cPanel-temp-URL deploy actually retains a session.
const useSecureCookies = () => process.env.COOKIE_SECURE === 'true';

const baseCookieOpts = () => ({
  httpOnly: false,
  secure: useSecureCookies(),
  // `SameSite=None` only works with `Secure=true` (browser rule). Pair them.
  sameSite: useSecureCookies() ? 'None' : 'Lax',
  path: '/',
});

export const setAuthCookies = (res, tokens) => {
  res.cookie('accessToken', tokens.accessToken, {
    ...baseCookieOpts(),
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });
  res.cookie('refreshToken', tokens.refreshToken, {
    ...baseCookieOpts(),
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
};

const clearAuthCookies = (res) => {
  const opts = baseCookieOpts();
  res.clearCookie('accessToken', opts);
  res.clearCookie('refreshToken', opts);
};

export const signup = async (req, res) => {
  const { tokens, user, clinic } = await authService.signupUser(req.body);
  setAuthCookies(res, tokens);
  logActivity({
    userId: user?.user_id,
    action: "auth.signup",
    entityType: "user",
    entityId: user?.user_id,
    description: "User signed up",
    req,
    statusCode: 201,
  }).catch(() => {});
  res.status(201).json({ tokens, user, clinic });
};

export const login = async (req, res) => {
  const { tokens, user, clinic } = await authService.loginUser(req.body);
  setAuthCookies(res, tokens);
  logActivity({
    userId: user.user_id,
    action: "auth.login",
    entityType: "user",
    entityId: user.user_id,
    description: "User logged in",
    req,
    statusCode: 200,
  }).catch(() => {});
  res.json({ tokens, user, clinic });
};

export const refreshToken = async (req, res) => {
  const fromHeader = (req.headers.authorization || '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const fromCookie = req.cookies?.refreshToken;
  const fromBody = req.body?.refreshToken;
  const incoming = fromHeader || fromCookie || fromBody;

  const { tokens, user, clinic } = await authService.refreshAuthTokens(incoming);
  setAuthCookies(res, tokens);
  res.json({ tokens, user, clinic });
};

export const logout = async (req, res) => {
  clearAuthCookies(res);
  res.json({ message: 'Logged out' });
};

export const forgotPassword = async (req, res) => {
  const result = await authService.requestPasswordReset(req.body);
  res.json(result);
};

export const verifyForgotPasswordOtp = async (req, res) => {
  const result = await authService.verifyPasswordResetOtp(req.body);
  res.json(result);
};

export const resetPassword = async (req, res) => {
  const result = await authService.resetPasswordWithToken({
    resetToken: req.body.reset_token,
    newPassword: req.body.new_password,
  });
  res.json(result);
};

export const requestLoginOtp = async (req, res) => {
  const result = await authService.requestLoginOtp(req.body);
  res.json(result);
};

export const verifyLoginOtp = async (req, res) => {
  const { tokens, user, clinic } = await authService.verifyLoginOtp(req.body);
  setAuthCookies(res, tokens);
  res.json({ tokens, user, clinic });
};

export const me = async (req, res) => {
  const user = await authService.getUserById(req.user.user_id);
  if (!user) return res.status(404).json({ message: 'Not found' });
  res.json({ user });
};

export const summary = async (req, res) => {
  const data = await authService.getUserSummary(req.user.user_id, req.user.clinic_id);
  res.json(data);
};

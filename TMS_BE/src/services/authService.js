import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import { User } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { signToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";

export const login = async (email, password) => {
  if (!email || !password) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email and password required");
  }

  const user = await User.findOne({
    where: { email: String(email).toLowerCase().trim(), is_active: true },
  });

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  const accessToken = signToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  return {
    ok: true,
    user: { id: user.id, name: user.name, role: user.role },
    accessToken,
    refreshToken,
  };
};

export const refreshSession = async (refreshToken) => {
  if (!refreshToken) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Please authenticate");
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Please authenticate");
  }

  const user = await User.findOne({
    where: { id: payload.userId, is_active: true },
  });
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Please authenticate");
  }

  return {
    ok: true,
    accessToken: signToken(user.id),
    refreshToken: signRefreshToken(user.id),
  };
};

export const resetPassword = async ({ email, oldPassword, newPassword }) => {
  if (!email || !oldPassword || !newPassword) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email, old password, and new password are required");
  }
  if (String(newPassword).length < 6) {
    throw new ApiError(httpStatus.BAD_REQUEST, "New password must be at least 6 characters");
  }

  const user = await User.findOne({
    where: { email: String(email).toLowerCase().trim(), is_active: true },
  });

  if (!user || !bcrypt.compareSync(oldPassword, user.password_hash)) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid email or current password");
  }

  await user.update({ password_hash: bcrypt.hashSync(newPassword, 10) });

  return { ok: true };
};

export default { login, resetPassword, refreshSession };

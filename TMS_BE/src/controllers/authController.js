import httpStatus from "http-status";
import config from "../config/config.js";
import catchAsync from "../utils/catchAsync.js";
import * as authService from "../services/authService.js";

export const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password);
  const maxAge = config.jwt.accessExpirationMinutes * 60 * 1000;
  res.cookie("accessToken", result.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    maxAge,
  });
  res.json(result);
});

export const logout = catchAsync(async (_req, res) => {
  res.clearCookie("accessToken", { path: "/" });
  res.json({ ok: true });
});

export default { login, logout };

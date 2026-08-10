import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import { User } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { signToken } from "../utils/jwt.js";

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

  return {
    ok: true,
    user: { id: user.id, name: user.name, role: user.role },
    accessToken,
  };
};

export default { login };

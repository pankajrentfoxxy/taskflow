import jwt from "jsonwebtoken";
import httpStatus from "http-status";
import ApiError from "../utils/ApiError.js";
import { db } from "../models/index.js";

const isAuthorizedSuperAdmin = async (req, res, next) => {
  let token = null;

  if (req && req.cookies) {
    token = req?.cookies["accessToken"];
  }

  if (!token) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Access token is required");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.user_id) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "Invalid token: User ID not found"
      );
    }

    const userId = decoded.user_id;

    const superAdmin = db.SuperAdmin
      ? await db.SuperAdmin.findByPk(userId, {
          attributes: ["user_id", "email", "fullname", "is_blocked"],
        })
      : null;

    if (!superAdmin) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "SuperAdmin not found");
    }

    const tokenEmail = superAdmin.email;
    const validSuperAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (!validSuperAdminEmail) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Super admin email not configured"
      );
    }

    if (tokenEmail !== validSuperAdminEmail) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "You are not authorized as a super admin"
      );
    }

    req.user = superAdmin;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid token");
    }
    if (error.name === "TokenExpiredError") {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Token has expired");
    }

    throw error instanceof ApiError
      ? error
      : new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          "Failed to authenticate super admin"
        );
  }
};

export default isAuthorizedSuperAdmin;

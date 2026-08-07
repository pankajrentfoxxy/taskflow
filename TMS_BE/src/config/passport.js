import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { QueryTypes } from "sequelize";
import config from "./config.js";
import { sequelize, Authentication } from "../models/index.js";

const cookieExtractor = function (req) {
  let token = null;
  if (req && req.cookies) {
    token = req?.cookies["accessToken"];
  }
  return token;
};

const jwtOptions = {
  secretOrKey: config.jwt.secret,
  jwtFromRequest: ExtractJwt.fromExtractors([
    ExtractJwt.fromAuthHeaderAsBearerToken(),
    cookieExtractor,
  ]),
};

const jwtVerify = async (payload, done) => {
  try {
    if (!payload?.user_id) return done(null, false);

    const rows = await sequelize.query(
      `SELECT
         a.user_id,
         a.email,
         a.full_name,
         a.role_id,
         a.is_blocked,
         r.role_id AS role_role_id,
         r.slug AS role_slug
       FROM authentication a
       LEFT JOIN roles r ON r.role_id = a.role_id
       WHERE a.user_id = :userId
       LIMIT 1`,
      {
        replacements: { userId: payload.user_id },
        type: QueryTypes.SELECT,
      }
    );

    const user = rows[0];
    if (!user) return done(null, false);
    if (user.is_blocked) return done(null, false);

    return done(null, {
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      role_id: user.role_id,
      role: user.role_role_id
        ? {
            role_id: user.role_role_id,
            slug: user.role_slug,
          }
        : null,
    });
  } catch (error) {
    return done(error, false);
  }
};

const jwtAdminVerify = async (payload, done) => {
  try {
    if (!payload?.user_id) return done(null, false);
    const user = await Authentication.findByPk(payload.user_id);
    if (!user || user.role !== "admin") return done(null, false);
    return done(null, {
      user_id: user.user_id,
      email: user.email,
      role: user.role,
      clinic_id: user.clinic_id,
      is_clinic_owner: user.is_clinic_owner,
    });
  } catch (error) {
    return done(error, false);
  }
};

const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify);
const jwtAdminStrategy = new JwtStrategy(jwtOptions, jwtAdminVerify);

export { jwtStrategy, jwtAdminStrategy };

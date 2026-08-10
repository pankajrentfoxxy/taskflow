import jwt from "jsonwebtoken";
import config from "../config/config.js";

export const signToken = (userId) => {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: `${config.jwt.accessExpirationMinutes}m`,
  });
};

export const verifyToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};

export default { signToken, verifyToken };

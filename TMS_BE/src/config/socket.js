import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import config from "./config.js";
import { Authentication } from "../models/index.js";

let io = null;

function getTokenFromSocket(socket) {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;

  const header = socket.handshake.headers?.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice(7);
  }

  return null;
}

async function authenticateSocket(socket) {
  const token = getTokenFromSocket(socket);
  if (!token) {
    throw new Error("Authentication token missing");
  }

  const payload = jwt.verify(token, config.jwt.secret);
  if (!payload?.user_id) {
    throw new Error("Invalid token payload");
  }

  const user = await Authentication.findByPk(payload.user_id, {
    attributes: ["user_id", "email", "full_name", "is_blocked"],
  });

  if (!user || user.is_blocked) {
    throw new Error("User not authorized");
  }

  return user;
}

export function initSocket(httpServer) {
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : ["http://localhost:3000"];

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const user = await authenticateSocket(socket);
      socket.data.user = {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
      };
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.user.user_id;
    socket.join(getUserRoom(userId));

    socket.on("disconnect", () => {
      socket.leave(getUserRoom(userId));
    });
  });

  return io;
}

export function getUserRoom(userId) {
  return `user:${userId}`;
}

export function getIo() {
  return io;
}

"use client";

import { io } from "socket.io-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function getSocketBaseUrl() {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

  return API_BASE.replace(/\/api\/?$/, "");
}

let socket = null;
let currentToken = null;

export function getNotificationSocket(token) {
  if (!token) {
    disconnectNotificationSocket();
    return null;
  }

  if (socket && currentToken === token) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;
  socket = io(getSocketBaseUrl(), {
    auth: { token },
    transports: ["websocket", "polling"],
    autoConnect: true,
  });

  return socket;
}

export function disconnectNotificationSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentToken = null;
}

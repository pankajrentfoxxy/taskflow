import { io, type Socket } from 'socket.io-client';

export function socketBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  return raw.replace(/\/api\/?$/, '');
}

let socket: Socket | null = null;
let subscribers = 0;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

const DISCONNECT_DELAY_MS = 1000;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(socketBaseUrl(), {
      path: '/socket.io/',
      withCredentials: true,
      autoConnect: false,
      // Polling first is more reliable behind nginx; upgrades to websocket when ready.
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  subscribers += 1;
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

/** Release a subscriber; disconnect only after delay when nothing needs the socket. */
export function releaseSocket(): void {
  subscribers = Math.max(0, subscribers - 1);
  if (subscribers > 0) return;

  if (disconnectTimer) clearTimeout(disconnectTimer);
  disconnectTimer = setTimeout(() => {
    if (subscribers === 0 && socket?.connected) socket.disconnect();
    disconnectTimer = null;
  }, DISCONNECT_DELAY_MS);
}

/** Force disconnect (logout). */
export function disconnectSocket(): void {
  subscribers = 0;
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  if (socket) socket.disconnect();
}

export const REALTIME_TASK_EVENT = 'tf:task-changed';
export const REALTIME_PRESENCE_EVENT = 'tf:presence';
export const REALTIME_NOTIFICATION_EVENT = 'tf:notification';
export const REALTIME_ME_REFRESH_EVENT = 'tf:me-refresh';

export function dispatchTaskChanged(detail: unknown): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REALTIME_TASK_EVENT, { detail }));
}

export function dispatchPresence(detail: unknown): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REALTIME_PRESENCE_EVENT, { detail }));
}

export function dispatchNotification(detail: unknown): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REALTIME_NOTIFICATION_EVENT, { detail }));
}

export function dispatchMeRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(REALTIME_ME_REFRESH_EVENT));
}

export function onTaskChanged(handler: (detail: unknown) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const wrapped = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(REALTIME_TASK_EVENT, wrapped);
  return () => window.removeEventListener(REALTIME_TASK_EVENT, wrapped);
}

export function onPresenceUpdate(handler: (detail: { onlineCount?: number; onlineUsers?: number[] }) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const wrapped = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(REALTIME_PRESENCE_EVENT, wrapped);
  return () => window.removeEventListener(REALTIME_PRESENCE_EVENT, wrapped);
}

export function onNotification(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(REALTIME_NOTIFICATION_EVENT, handler);
  return () => window.removeEventListener(REALTIME_NOTIFICATION_EVENT, handler);
}

export function onMeRefresh(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(REALTIME_ME_REFRESH_EVENT, handler);
  return () => window.removeEventListener(REALTIME_ME_REFRESH_EVENT, handler);
}

import { io, type Socket } from 'socket.io-client';

export function socketBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  return raw.replace(/\/api\/?$/, '');
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(socketBaseUrl(), {
      path: '/socket.io/',
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) socket.disconnect();
}

export const REALTIME_TASK_EVENT = 'tf:task-changed';
export const REALTIME_PRESENCE_EVENT = 'tf:presence';
export const REALTIME_NOTIFICATION_EVENT = 'tf:notification';

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

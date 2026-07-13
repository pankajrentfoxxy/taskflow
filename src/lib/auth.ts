import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { getDb } from './db';

const SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';
const SESSION_DAYS = 30;
export const COOKIE_NAME = 'tf_session';

function hmac(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function createToken(userId: number): string {
  const exp = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  const payload = `${userId}.${exp}`;
  return `${payload}.${hmac(payload)}`;
}

export function verifyToken(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const payload = `${userId}.${exp}`;
  const expected = hmac(payload);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  if (Number(exp) < Date.now()) return null;
  return Number(userId);
}

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'CEO' | 'MANAGER' | 'MEMBER';
  team_id: number | null;
  is_active: number;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = verifyToken(token);
  if (!userId) return null;
  const db = getDb();
  const user = db
    .prepare('SELECT id, name, email, role, team_id, is_active FROM users WHERE id = ? AND is_active = 1')
    .get(userId) as SessionUser | undefined;
  return user ?? null;
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
export function forbidden(msg = 'Forbidden') {
  return Response.json({ error: msg }, { status: 403 });
}
export function badRequest(msg: string, code?: string) {
  return Response.json({ error: msg, code }, { status: 400 });
}

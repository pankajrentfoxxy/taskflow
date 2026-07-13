import { COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.set('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}

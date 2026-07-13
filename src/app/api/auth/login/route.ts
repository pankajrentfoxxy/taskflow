import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { createToken, COOKIE_NAME, badRequest } from '@/lib/auth';

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return badRequest('Email and password required');
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(String(email).toLowerCase().trim()) as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return Response.json({ error: 'Invalid email or password' }, { status: 401 });
  }
  const token = createToken(user.id);
  const res = Response.json({ ok: true, user: { id: user.id, name: user.name, role: user.role } });
  res.headers.set(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`
  );
  return res;
}

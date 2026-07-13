import { runSlaSweep } from '@/lib/cron';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    const url = new URL(req.url);
    if (auth !== `Bearer ${secret}` && url.searchParams.get('secret') !== secret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  const result = runSlaSweep(true);
  return Response.json({ ok: true, ...result });
}

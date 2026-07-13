import { getDb } from '@/lib/db';
import { getSessionUser, unauthorized } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const db = getDb();
  const att = db.prepare('SELECT * FROM attachments WHERE id = ?').get(Number(id)) as any;
  if (!att) return Response.json({ error: 'Not found' }, { status: 404 });
  const bytes = new Uint8Array(att.data);
  return new Response(bytes, {
    headers: {
      'Content-Type': att.mime_type,
      'Content-Disposition': `inline; filename="${encodeURIComponent(att.file_name)}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

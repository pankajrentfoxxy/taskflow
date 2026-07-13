import { getDb, now } from '@/lib/db';
import { getSessionUser, unauthorized, badRequest } from '@/lib/auth';

const MAX_SIZE = 25 * 1024 * 1024;
const ALLOWED_PREFIXES = ['image/', 'application/pdf', 'text/', 'application/vnd', 'application/msword', 'application/zip'];

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const form = await req.formData().catch(() => null);
  const file = form?.get('file') as File | null;
  if (!file) return badRequest('file field required');
  if (file.size > MAX_SIZE) return badRequest('File exceeds 25 MB limit');
  const mime = file.type || 'application/octet-stream';
  if (!ALLOWED_PREFIXES.some((p) => mime.startsWith(p))) return badRequest(`File type ${mime} not allowed`);
  const buf = Buffer.from(await file.arrayBuffer());
  const db = getDb();
  const projectId = form?.get('projectId') ? Number(form.get('projectId')) : null;
  const id = db.prepare(
    'INSERT INTO attachments (uploader_id, file_name, mime_type, size, data, project_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(user.id, file.name || 'file', mime, file.size, buf, projectId, now()).lastInsertRowid;
  return Response.json({ id, fileName: file.name, mimeType: mime, size: file.size });
}

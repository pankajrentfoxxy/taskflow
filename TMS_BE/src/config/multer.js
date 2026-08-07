import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');
const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Folder strategy:
    //   uploads/<user_id>/<owner-segment>/
    // For /api/patients/:id/reports → segment = req.params.id (the patient id).
    // For /api/documents (generic), the caller can pass owner_type/owner_id as
    // URL query params (req.query is parsed before multer runs); otherwise
    // files land in the generic 'misc' folder.
    let segment = req.params.id;
    if (!segment) {
      const ot = req.query.owner_type;
      const oid = req.query.owner_id;
      segment = ot && oid ? `${ot}-${oid}` : 'misc';
    }
    const dir = path.join(UPLOAD_ROOT, String(req.user?.user_id || 'anon'), String(segment));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const random = crypto.randomBytes(12).toString('hex');
    cb(null, `${Date.now()}-${random}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ok =
    file.mimetype === 'application/pdf' ||
    file.mimetype.startsWith('image/');
  if (!ok) {
    return cb(new Error('Only PDF and image files are allowed'));
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_BYTES },
});

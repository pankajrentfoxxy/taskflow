import multer from "multer";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔹 Memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 🔹 Disk storage
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.resolve(
      __dirname,
      "..",
      "..",
      process.env.UPLOAD_DIR || "uploads",
      "icons"
    );
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const diskUpload = multer({ storage: diskStorage });

const diskSingle = diskUpload.single("file");
const diskMulti = diskUpload.array("files", 20);

const uploadSingle = upload.single("file");
const uploadMulti = upload.array("files", 20);

export { uploadSingle, uploadMulti, diskSingle, diskMulti };

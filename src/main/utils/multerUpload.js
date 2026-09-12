import multer from 'multer';
import path from 'path';
import fs from 'fs';

const TMP_DIR = path.join(process.cwd(), 'tmp');

if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, TMP_DIR),
    filename: (req, file, cb) =>
        cb(
            null,
            `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname) || '.jpg'}`,
        ),
});

export const commonUpload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
});


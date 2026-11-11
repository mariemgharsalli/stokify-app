const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { uploadDir } = require("../config/paths");

const logosDest = uploadDir("logos");
fs.mkdirSync(logosDest, { recursive: true });

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, logosDest),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const idPart = req.params?.id ?? "new";
    cb(null, `logo_${idPart}_${Date.now()}${ext}`);
  },
});

const logoFilter = (_req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  cb(null, allowed.includes(file.mimetype));
};

const logoUpload = multer({
  storage: logoStorage,
  fileFilter: logoFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single("logo");

const justificatifsDest = uploadDir("reglements");
fs.mkdirSync(justificatifsDest, { recursive: true });

const justificatifStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, justificatifsDest),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    const base =
      path
        .basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 40) || "justificatif";
    cb(null, `reg_${Date.now()}_${base}${ext}`);
  },
});

const justificatifFilter = (_req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
  const ext = path.extname(file.originalname || "").toLowerCase();
  const okExt = [".jpg", ".jpeg", ".png", ".webp", ".pdf"].includes(ext);
  cb(null, allowed.includes(file.mimetype) || okExt);
};

const justificatifUpload = multer({
  storage: justificatifStorage,
  fileFilter: justificatifFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("pieceJointe");

module.exports = logoUpload;
module.exports.logoUpload = logoUpload;
module.exports.justificatifUpload = justificatifUpload;

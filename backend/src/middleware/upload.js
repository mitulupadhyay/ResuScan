const multer = require("multer");
const ApiError = require("../utils/ApiError");

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(ApiError.badRequest("Only PDF files are accepted"));
    }
    cb(null, true);
  },
});

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) =>
    file.mimetype === "application/pdf" || file.mimetype === DOCX
      ? cb(null, true)
      : cb(ApiError.badRequest("Only PDF or Word (.docx) files are accepted")),
});

/** Accepts a PDF or .docx; sets req.file.kind to "pdf" | "docx" after checking the real file signature. */
const uploadResume =
  (field = "file") =>
  (req, res, next) => {
    resumeUpload.single(field)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return next(ApiError.badRequest(err.code === "LIMIT_FILE_SIZE" ? "File exceeds 5MB limit" : err.message));
      }
      if (err) return next(err);
      if (!req.file) return next(ApiError.badRequest("No file uploaded"));
      const head = req.file.buffer.subarray(0, 5);
      if (req.file.mimetype === "application/pdf" && head.toString("latin1") === "%PDF-") req.file.kind = "pdf";
      else if (req.file.mimetype === DOCX && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) req.file.kind = "docx";
      else return next(ApiError.badRequest("That file is not a valid PDF or Word document"));
      next();
    });
  };

const uploadPdf =
  (field = "file") =>
  (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(ApiError.badRequest("PDF exceeds 5MB limit"));
        }
        return next(ApiError.badRequest(err.message));
      }
      if (err) return next(err);
      if (!req.file) return next(ApiError.badRequest("No file uploaded"));
      if (req.file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
        return next(ApiError.badRequest("That file is not a valid PDF"));
      }
      next();
    });
  };

module.exports = { uploadPdf, uploadResume };
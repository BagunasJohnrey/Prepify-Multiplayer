import multer from "multer";

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed"));
        }
    }
});

// Verify PDF magic bytes (%PDF-) to prevent content-type spoofing
const verifyPdfMagicBytes = (buffer) => {
    if (!buffer || buffer.length < 5) return false;
    const header = buffer.toString('ascii', 0, 5);
    return header === '%PDF-';
};

export const uploadPdf = (req, res, next) => {
    upload.single("pdfFile")(req, res, (err) => {
        if (err) {
            if (err.message === "Only PDF files are allowed") {
                return res.status(400).json({ error: "Only PDF files are allowed" });
            }
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({ error: "File too large (max 5MB)" });
            }
            return res.status(400).json({ error: "Upload failed" });
        }
        // Validate PDF magic bytes even if mimetype passed
        if (req.file && !verifyPdfMagicBytes(req.file.buffer)) {
            return res.status(400).json({ error: "File is not a valid PDF" });
        }
        next();
    });
};
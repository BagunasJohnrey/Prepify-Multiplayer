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
        next();
    });
};
import express from "express";
import * as quizController from "../controllers/quizController.js";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { uploadPdf } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/quizzes", quizController.getQuizzes);
router.get("/quiz/:id", quizController.getQuizById);
router.delete("/quiz/:id", verifyToken, verifyAdmin, quizController.deleteQuiz);
router.post("/generate", verifyToken, uploadPdf, quizController.generateQuiz);

export default router;
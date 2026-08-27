import express from "express";
import * as quizController from "../controllers/quizController.js";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { uploadPdf } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/quizzes", quizController.getQuizzes);
router.get("/tags", quizController.getTags);
router.get("/quiz/:id", quizController.getQuizById);
router.get("/shared/:shareId", quizController.getSharedQuiz);
router.delete("/quiz/:id", verifyToken, verifyAdmin, quizController.deleteQuiz);
router.post("/generate", verifyToken, uploadPdf, quizController.generateQuiz);

// Result endpoints (authenticated user)
router.post("/results", verifyToken, quizController.saveResult);
router.get("/results", verifyToken, quizController.getHistory);
router.get("/results/:id", verifyToken, quizController.getResultById);
router.get("/wrong-answers", verifyToken, quizController.getWrongAnswers);
router.get("/wrong-answers/quizzes", verifyToken, quizController.getQuizzesWithWrongAnswers);
router.get("/stats", verifyToken, quizController.getQuizStats);

export default router;
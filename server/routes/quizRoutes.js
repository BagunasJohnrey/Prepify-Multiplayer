import express from "express";
import * as quizController from "../controllers/quizController.js";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { uploadPdf } from "../middleware/uploadMiddleware.js";
import {
  getQuizzesSchema,
  getQuizByIdSchema,
  getSharedQuizSchema,
  deleteQuizSchema,
  generateQuizSchema,
  saveResultSchema,
  getHistorySchema,
  getResultByIdSchema,
  getWrongAnswersSchema,
  getQuizStatsSchema,
  validate
} from "../middleware/validate.js";

const router = express.Router();

router.get("/quizzes", validate(getQuizzesSchema), quizController.getQuizzes);
router.get("/tags", quizController.getTags);
router.get("/quiz/:id", validate(getQuizByIdSchema), quizController.getQuizById);
router.get("/shared/:shareId", validate(getSharedQuizSchema), quizController.getSharedQuiz);
router.delete("/quiz/:id", verifyToken, verifyAdmin, validate(deleteQuizSchema), quizController.deleteQuiz);
router.post("/generate", verifyToken, uploadPdf, validate(generateQuizSchema), quizController.generateQuiz);

// Result endpoints (authenticated user)
router.post("/results", verifyToken, validate(saveResultSchema), quizController.saveResult);
router.get("/results", verifyToken, validate(getHistorySchema), quizController.getHistory);
router.get("/results/:id", verifyToken, validate(getResultByIdSchema), quizController.getResultById);
router.get("/wrong-answers", verifyToken, validate(getWrongAnswersSchema), quizController.getWrongAnswers);
router.get("/wrong-answers/quizzes", verifyToken, quizController.getQuizzesWithWrongAnswers);
router.get("/stats", verifyToken, validate(getQuizStatsSchema), quizController.getQuizStats);

export default router;
import { z } from "zod";
import Quiz from "../models/Quiz.js";
import Result from "../models/Result.js";
import { parsePDFBuffer } from "../utils/pdfParser.js";
import { generateQuizQuestions } from "../utils/aiService.js";

// Schema for validating AI response
const QuizSchema = z.array(z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  answer: z.string(),
  explanation: z.string()
}));

// Sanitize user input for AI prompt injection prevention
const sanitizePromptInput = (input, maxLen = 500) => {
  if (!input) return '';
  return String(input)
    .replace(/[^\w\s.,;:!?'"()-]/g, '')
    .trim()
    .substring(0, maxLen);
};

export const getQuizzes = async (req, res) => {
  try {
    const { course, page, limit, search, difficulty, tag } = req.query;

    if (page || limit || search || difficulty || tag) {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12));
      const result = await Quiz.getAllPaginated(course, pageNum, limitNum, search, difficulty, tag);
      return res.json(result);
    }

    const quizzes = await Quiz.getAll(course);
    res.json(quizzes);
  } catch {
    res.status(500).json({ error: "Failed to load quizzes" });
  }
};

export const getTags = async (req, res) => {
  try {
    const tags = await Quiz.getAllTags();
    res.json(tags);
  } catch {
    res.status(500).json({ error: "Failed to load tags" });
  }
};

export const getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ error: "Not found" });
    res.json(quiz);
  } catch {
    res.status(500).json({ error: "Failed to load quiz" });
  }
};

export const getSharedQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findByShareId(req.params.shareId);
    if (!quiz) return res.status(404).json({ error: "Quiz not found or link invalid" });
    // Strip answers from shared quiz to prevent answer leakage
    let questions;
    if (typeof quiz.questions === 'string') {
      questions = JSON.parse(quiz.questions);
    } else if (Array.isArray(quiz.questions)) {
      questions = quiz.questions;
    } else {
      questions = [];
    }
    const sanitizedQuestions = questions.map(({ answer, ...rest }) => rest);
    res.json({ ...quiz, questions: sanitizedQuestions, shared: true });
  } catch {
    res.status(500).json({ error: "Failed to load quiz" });
  }
};

export const deleteQuiz = async (req, res) => {
    try {
        await Quiz.delete(req.params.id);
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: "Failed to delete quiz" });
    }
};

export const saveResult = async (req, res) => {
  try {
    const { quizId, history } = req.body;
    if (!quizId || !Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Fetch the actual quiz from the DB to validate answers server-side
    const quiz = await Quiz.findById(quizId);
    if (!quiz || !quiz.questions) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    let questions;
    if (typeof quiz.questions === 'string') {
      questions = JSON.parse(quiz.questions);
    } else if (Array.isArray(quiz.questions)) {
      questions = quiz.questions;
    } else {
      return res.status(500).json({ error: "Invalid quiz data" });
    }

    const total = questions.length;
    if (total === 0) {
      return res.status(400).json({ error: "Quiz has no questions" });
    }

    // Build a map of correct answers from the DB
    const correctAnswerMap = new Map();
    for (const q of questions) {
      correctAnswerMap.set(q.question, q.answer);
    }

    // Validate each history entry and recalculate score
    let verifiedScore = 0;
    const verifiedHistory = history.map((entry) => {
      const correctAnswer = correctAnswerMap.get(entry.question);
      if (correctAnswer === undefined) {
        // Question not found in quiz — treat as wrong
        return { ...entry, isCorrect: false, correct: null };
      }
      const isCorrect = entry.selected === correctAnswer;
      if (isCorrect) verifiedScore++;
      return { ...entry, isCorrect, correct: correctAnswer };
    });

    const percentage = Math.round((verifiedScore / total) * 100);
    const result = await Result.create(req.user.id, quizId, verifiedScore, total, verifiedHistory, percentage);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to save result" });
  }
};

export const getHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const { search, course, difficulty } = req.query;
    const history = await Result.getUserHistory(req.user.id, page, limit, search, course, difficulty);
    res.json(history);
  } catch {
    res.status(500).json({ error: "Failed to load history" });
  }
};

export const getResultById = async (req, res) => {
  try {
    const result = await Result.getById(req.params.id, req.user.id);
    if (!result) return res.status(404).json({ error: "Not found" });
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to load result" });
  }
};

export const getWrongAnswers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const { search, course, quiz_id } = req.query;
    const wrongAnswers = await Result.getWrongAnswers(req.user.id, page, limit, search, course, quiz_id);
    res.json(wrongAnswers);
  } catch {
    res.status(500).json({ error: "Failed to load wrong answers" });
  }
};

export const getQuizzesWithWrongAnswers = async (req, res) => {
  try {
    const quizzes = await Result.getQuizzesWithWrongAnswers(req.user.id);
    res.json(quizzes);
  } catch {
    res.status(500).json({ error: "Failed to load quizzes" });
  }
};

export const getQuizStats = async (req, res) => {
  try {
    const stats = await Result.getStats(req.user.id);
    res.json(stats);
  } catch {
    res.status(500).json({ error: "Failed to load stats" });
  }
};

// Unified generateQuiz with Strict Deduplication and Retries
export const generateQuiz = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });
  
  const { course, customTitle, numQuestions, difficulty, description, tags } = req.body;
  const totalQuestionsNeeded = parseInt(numQuestions) || 10;
  const BATCH_SIZE = 10; 

  try {
    const text = await parsePDFBuffer(req.file.buffer);
    
    if (text.length < 50) {
      throw new Error("Not enough text extracted.");
    }

    const maxTextLength = 60000;
    const safeText = text.length > maxTextLength ? text.substring(0, maxTextLength) : text;

    let allQuestions = [];
    const numBatches = Math.ceil(totalQuestionsNeeded / BATCH_SIZE);
    const chunkSize = Math.ceil(safeText.length / numBatches);
    const io = req.app.get('socketio');

    // Tracking for the while loop
    let attempts = 0;
    const maxAttempts = numBatches + 3; // Allow up to 3 extra API calls to replace duplicates
    let currentChunkIndex = 0;

    // Use a while loop to ensure we keep going until we have enough UNIQUE questions
    while (allQuestions.length < totalQuestionsNeeded && attempts < maxAttempts) {
      attempts++;
      
      if (io && req.user && req.user.id) {
         io.emit(`generateProgress_${req.user.id}`, { 
           current: attempts, 
           total: Math.max(numBatches, attempts) 
         });
      }

      const remainingNeeded = totalQuestionsNeeded - allQuestions.length;
      const currentBatchCount = Math.min(BATCH_SIZE, remainingNeeded);

      // Cycle through chunks (if we need extra attempts, we loop back to earlier text)
      const chunkToUse = currentChunkIndex % numBatches;
      const startIdx = chunkToUse * chunkSize;
      const endIdx = Math.min((chunkToUse + 1) * chunkSize + 500, safeText.length);
      const batchText = safeText.substring(startIdx, endIdx);

      const existingQuestionTexts = allQuestions.map(q => q.question).join("\n- ");

      const prompt = `
        Create a strictly valid JSON exam based on the text segment below.
        
        CONTEXT:
        - Course Type: ${sanitizePromptInput(course)}
        - Difficulty: ${sanitizePromptInput(difficulty)}
        - Description/Focus: ${sanitizePromptInput(description) || "General coverage"}
        - Count: Generate exactly ${currentBatchCount} unique questions.

        [CRITICAL] YOU MUST NOT GENERATE ANY QUESTION THAT IS SIMILAR TO THESE:
        - ${existingQuestionTexts}
        
        RULES:
        1. Return ONLY a JSON array. No Markdown blocks.
        2. Multiple Choice: Exactly 4 options.
        3. No "All of the above" or "None of the above".
        4. The "answer" field must MATCH exactly one of the strings in "options".
        5. Provide a short "explanation".

        JSON FORMAT:
        [
          {
            "question": "Unique Question text?",
            "options": ["A", "B", "C", "D"], 
            "answer": "A", 
            "explanation": "..."
          }
        ]

        TEXT DATA:
        ${batchText}
      `;

      const batchQuestions = await generateQuizQuestions(prompt);
      
      if (Array.isArray(batchQuestions)) {
        // STRICT JAVASCRIPT DEDUPLICATION
        const uniqueBatch = [];
        const existingSet = new Set(allQuestions.map(q => q.question.toLowerCase().trim()));

        for (const q of batchQuestions) {
            // Normalize string to catch exact matches despite capitalization/spaces
            const normalizedQ = q.question.toLowerCase().trim();
            
            // Only add if we haven't seen this exact question before AND we still need more
            if (!existingSet.has(normalizedQ) && (allQuestions.length + uniqueBatch.length) < totalQuestionsNeeded) {
                existingSet.add(normalizedQ);
                uniqueBatch.push(q);
            }
        }

        allQuestions = [...allQuestions, ...uniqueBatch];
        currentChunkIndex++; // Move to next chunk of text
      }
    }

    if (allQuestions.length === 0) {
      throw new Error("AI failed to generate any valid unique questions.");
    }

    // Final Validation and DB Save
    const validation = QuizSchema.safeParse(allQuestions);
    if (!validation.success) throw new Error("AI generated invalid format.");

    const title = customTitle || `Exam - ${new Date().toLocaleDateString()}`;

    let parsedTags = [];
    if (tags) {
      parsedTags = String(tags).split(',').map(t => t.trim()).filter(Boolean).slice(0, 10);
    }

    const newQuiz = await Quiz.create(title, course, difficulty, description, JSON.stringify(allQuestions), allQuestions.length, parsedTags);

    res.json(newQuiz);
  } catch {
    res.status(500).json({ error: "Failed to generate quiz. Please try again." });
  }
};

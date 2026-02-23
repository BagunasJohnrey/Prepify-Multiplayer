import { z } from "zod";
import Quiz from "../models/Quiz.js";
import { parsePDFBuffer } from "../utils/pdfParser.js";
import { generateQuizQuestions } from "../utils/aiService.js";

// Schema for validating AI response
const QuizSchema = z.array(z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  answer: z.string(),
  explanation: z.string()
}));

export const getQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.getAll(req.query.course);
    res.json(quizzes);
  } catch (err) {
    console.error("GET Quizzes Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ error: "Not found" });
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteQuiz = async (req, res) => {
    try {
        await Quiz.delete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error("Delete Error:", err);
        res.status(500).json({ error: "Failed to delete quiz" });
    }
};

// Unified generateQuiz with Chunking, Batching, and Socket.io Progress
export const generateQuiz = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });
  
  const { course, customTitle, numQuestions, difficulty, description } = req.body;
  const totalQuestionsNeeded = parseInt(numQuestions) || 10;
  const BATCH_SIZE = 10; 

  try {
    console.log("1. Parsing PDF...");
    const text = await parsePDFBuffer(req.file.buffer);
    
    if (text.length < 50) {
      throw new Error("Not enough text extracted.");
    }

    // 1. Define a maximum safe limit for the entire text (e.g., 60k chars)
    const maxTextLength = 60000;
    const safeText = text.length > maxTextLength ? text.substring(0, maxTextLength) : text;

    let allQuestions = [];
    const numBatches = Math.ceil(totalQuestionsNeeded / BATCH_SIZE);

    // 2. Calculate how large each text chunk should be based on the number of batches
    const chunkSize = Math.ceil(safeText.length / numBatches);

    const io = req.app.get('socketio');

    console.log(`2. Starting Batched Generation (${numBatches} total batches)...`);

    for (let i = 0; i < numBatches; i++) {
      if (io && req.user && req.user.id) {
         io.emit(`generateProgress_${req.user.id}`, { 
           current: i + 1, 
           total: numBatches 
         });
      }

      const remainingNeeded = totalQuestionsNeeded - allQuestions.length;
      const currentBatchCount = Math.min(BATCH_SIZE, remainingNeeded);

      // 3. Extract the specific chunk of text for THIS batch
      const startIdx = i * chunkSize;
      // Add a 500-character overlap to the endIdx so we don't cut off mid-sentence
      const endIdx = Math.min((i + 1) * chunkSize + 500, safeText.length);
      const batchText = safeText.substring(startIdx, endIdx);

      const existingQuestionTexts = allQuestions.map(q => q.question).join("\n- ");

      // Note: We now feed it `batchText` instead of the whole `truncatedText`
      const prompt = `
        Create a strictly valid JSON exam based on the text segment below.
        
        CONTEXT:
        - Course Type: ${course}
        - Difficulty: ${difficulty}
        - Description/Focus: ${description || "General coverage"}
        - Count: ${currentBatchCount} questions.
        - Document Progress: You are reading segment ${i + 1} out of ${numBatches}.

        ${allQuestions.length > 0 ? `[CRITICAL] DO NOT repeat the following questions:
        - ${existingQuestionTexts}` : ""}
        
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

        TEXT DATA (SEGMENT ${i + 1}):
        ${batchText}
      `;

      console.log(`>> Generating Batch ${i + 1}/${numBatches}... (Text length: ${batchText.length})`);
      const batchQuestions = await generateQuizQuestions(prompt);
      
      if (Array.isArray(batchQuestions)) {
        allQuestions = [...allQuestions, ...batchQuestions];
      }
    }

    // Final Validation and DB Save
    const validation = QuizSchema.safeParse(allQuestions);
    if (!validation.success) throw new Error("AI generated invalid format.");

    const title = customTitle || `Exam - ${new Date().toLocaleDateString()}`;
    const newQuiz = await Quiz.create(title, course, difficulty, description, JSON.stringify(allQuestions), allQuestions.length);

    res.json(newQuiz);
  } catch (err) {
    console.error("GENERATION ERROR:", err);
    res.status(500).json({ error: "Failed to generate quiz. " + err.message });
  }
};

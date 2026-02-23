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

// Unified generateQuiz with Batching Support for 50 questions
export const generateQuiz = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });
  
  const { course, customTitle, numQuestions, difficulty, description } = req.body;
  const totalQuestionsNeeded = parseInt(numQuestions) || 10;
  
  // Batch size of 10 is the most stable for free-tier APIs
  const BATCH_SIZE = 10; 

  try {
    console.log("1. Parsing PDF...");
    const text = await parsePDFBuffer(req.file.buffer);
    
    if (text.length < 50) {
      throw new Error("Not enough text extracted. The PDF might be scanned images.");
    }

    const truncatedText = text.length > 25000 ? text.substring(0, 25000) : text;

    let allQuestions = [];
    const numBatches = Math.ceil(totalQuestionsNeeded / BATCH_SIZE);

    console.log(`2. Starting Batched Generation (${numBatches} total batches)...`);

    for (let i = 0; i < numBatches; i++) {
      const remainingNeeded = totalQuestionsNeeded - allQuestions.length;
      const currentBatchCount = Math.min(BATCH_SIZE, remainingNeeded);

      const prompt = `
        Create a strictly valid JSON exam based on the text below.
        
        CONTEXT:
        - Course Type: ${course}
        - Difficulty: ${difficulty}
        - Description/Focus: ${description || "General coverage"}
        - Count: ${currentBatchCount} questions.
        - Batch Info: This is batch ${i + 1} of ${numBatches}. 
        
        RULES:
        1. Return ONLY a JSON array. No Markdown blocks, no intro/outro.
        2. Multiple Choice: Exactly 4 options.
        3. Do not use "All of the above" or "None of the above".
        4. The "answer" field must MATCH exactly one of the strings in "options".
        5. Provide a short "explanation".
        6. [CRITICAL] Ensure all 4 options are of similar length.

        JSON FORMAT:
        [
          {
            "question": "Question text here?",
            "options": ["A", "B", "C", "D"], 
            "answer": "A", 
            "explanation": "..."
          }
        ]

        TEXT DATA:
        ${truncatedText}
      `;

      console.log(`>> Generating Batch ${i + 1}/${numBatches} (${currentBatchCount} questions)...`);
      const batchQuestions = await generateQuizQuestions(prompt);
      
      if (Array.isArray(batchQuestions)) {
        allQuestions = [...allQuestions, ...batchQuestions];
      }
    }

    // Validate the complete combined array
    const validation = QuizSchema.safeParse(allQuestions);
    if (!validation.success) {
        console.error("Batch Validation Failed:", JSON.stringify(validation.error.format(), null, 2));
        throw new Error("AI generated an invalid format in one of the batches.");
    }

    console.log("3. Saving to Database...");
    const title = customTitle || `Exam - ${new Date().toLocaleDateString()}`;
    
    const newQuiz = await Quiz.create(
        title, 
        course, 
        difficulty, 
        description, 
        JSON.stringify(allQuestions), 
        allQuestions.length
    );

    console.log("4. Success!");
    res.json(newQuiz);

  } catch (err) {
    console.error("GENERATION ERROR:", err);
    res.status(500).json({ error: "Failed to generate quiz. " + err.message });
  }
};

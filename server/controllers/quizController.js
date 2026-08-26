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
    res.status(500).json({ error: "Failed to load quizzes" });
  }
};

export const getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ error: "Not found" });
    res.json(quiz);
  } catch (err) {
    console.error("Get Quiz Error:", err);
    res.status(500).json({ error: "Failed to load quiz" });
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

// Unified generateQuiz with Strict Deduplication and Retries
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

    console.log(`2. Starting Batched Generation (Target: ${totalQuestionsNeeded} Qs)...`);

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
        - Course Type: ${course}
        - Difficulty: ${difficulty}
        - Description/Focus: ${description || "General coverage"}
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

      console.log(`>> Generating Batch ${attempts}... (Need ${remainingNeeded} more valid Qs)`);
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
            } else if (existingSet.has(normalizedQ)) {
                console.log(`>> [FILTERED DUPLICATE]: ${q.question}`);
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
    const newQuiz = await Quiz.create(title, course, difficulty, description, JSON.stringify(allQuestions), allQuestions.length);

    res.json(newQuiz);
  } catch (err) {
    console.error("GENERATION ERROR:", err);
    res.status(500).json({ error: "Failed to generate quiz. Please try again." });
  }
};

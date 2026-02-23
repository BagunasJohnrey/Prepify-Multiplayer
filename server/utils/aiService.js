import dotenv from "dotenv";
dotenv.config();

const FREE_MODELS = [
  "google/gemini-2.0-flash-lite-preview-02-05:free",
  "google/gemma-3-27b-it:free",
  "arcee-ai/trinity-large-preview:free",
  "deepseek/deepseek-r1-distill-qwen-32b:free",
  "stepfun/step-3.5-flash:free",
  "qwen/qwen-2-7b-instruct:free"
];

// Determine the live domain of the backend service from Render's standard environment variables
const RENDER_EXTERNAL_HOSTNAME = process.env.RENDER_EXTERNAL_HOSTNAME;
const REFERER_URL = RENDER_EXTERNAL_HOSTNAME ? `https://${RENDER_EXTERNAL_HOSTNAME}` : "http://localhost:3000";

export const generateQuiz = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });
  
  const { course, customTitle, numQuestions, difficulty, description } = req.body;
  const totalQuestionsNeeded = parseInt(numQuestions) || 10;
  // Define batch size (10 is stable for free models)
  const BATCH_SIZE = 10; 

  try {
    console.log("1. Parsing PDF...");
    const text = await parsePDFBuffer(req.file.buffer);
    
    if (text.length < 50) {
      throw new Error("Not enough text extracted. The PDF might be scanned images.");
    }

    // Keep truncation reasonable to ensure it fits in context windows
    const truncatedText = text.length > 15000 ? text.substring(0, 15000) : text;

    let allQuestions = [];
    const numBatches = Math.ceil(totalQuestionsNeeded / BATCH_SIZE);

    console.log(`2. Starting Batched Generation (${numBatches} batches)...`);

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
        - [IMPORTANT] Ensure these questions are unique and do not overlap with previous topics if possible.
        
        RULES:
        1. Return ONLY a JSON array. No Markdown blocks, no intro/outro.
        2. Multiple Choice: Exactly 4 options.
        3. Do not use "All of the above" or "None of the above".
        4. The "answer" field must MATCH exactly one of the strings in "options".
        5. Provide a short "explanation".

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

    // Validate the final combined array
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

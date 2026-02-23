import dotenv from "dotenv";
dotenv.config();

// UPDATED: Using verified active free model IDs to avoid 404 errors
const FREE_MODELS = [
  "google/gemini-2.0-flash-lite-preview-02-05:free",
  "google/gemma-3-27b-it:free",
  "arcee-ai/trinity-large-preview:free",
  "deepseek/deepseek-r1-distill-qwen-32b:free",
  "stepfun/step-3.5-flash:free",
  "qwen/qwen-2-7b-instruct:free"
];

const RENDER_EXTERNAL_HOSTNAME = process.env.RENDER_EXTERNAL_HOSTNAME;
const REFERER_URL = RENDER_EXTERNAL_HOSTNAME ? `https://${RENDER_EXTERNAL_HOSTNAME}` : "http://localhost:3000";

export const generateQuizQuestions = async (prompt) => {
    let questions = null;
    let lastError = null;

    for (const model of FREE_MODELS) {
        try {
            console.log(`>> Trying model: ${model}...`);
            
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": REFERER_URL, 
                    "X-Title": "Prepify App - Render Backend"
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: "user", content: prompt }],
                    // ADDED: Limit output to prevent 402 "Insufficient Credits" errors
                    max_tokens: 1500 
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Status ${response.status} - ${errText}`);
            }

            const data = await response.json();
            
            if (!data.choices || !data.choices[0]) {
               throw new Error("Invalid structure from API");
            }

            let rawText = data.choices[0].message.content;
            
            // Clean Markdown blocks
            rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
            const jsonStartIndex = rawText.indexOf('[');
            const jsonEndIndex = rawText.lastIndexOf(']');
            if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
                rawText = rawText.substring(jsonStartIndex, jsonEndIndex + 1);
            }

            questions = JSON.parse(rawText);
            console.log(`>> Success with ${model}!`);
            return questions; // Return immediately on success

        } catch (err) {
            console.warn(`>> Model ${model} failed: ${err.message}`);
            lastError = err;
        }
    }

    throw new Error("All AI models failed. Last error: " + (lastError?.message || "Unknown"));
};

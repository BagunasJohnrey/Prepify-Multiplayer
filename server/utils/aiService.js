import dotenv from "dotenv";
dotenv.config();

const FREE_MODELS = [
  "google/gemini-2.0-flash-exp:free",           
  "google/gemini-2.5-flash-lite-preview-09-2025",       
  "meta-llama/llama-3.3-70b-instruct:free",     
  "deepseek/deepseek-r1-distill-llama-70b:free",
  "openai/gpt-oss-20b:free" 
];

// Determine the live domain of the backend service from Render's standard environment variables
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
                    // UPDATED: Use a dynamic referer/title based on the Render host
                    "HTTP-Referer": REFERER_URL, 
                    "X-Title": "Prepify App - Render Backend"
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: "user", content: prompt }]
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
            rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
            const jsonStartIndex = rawText.indexOf('[');
            const jsonEndIndex = rawText.lastIndexOf(']');
            if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
                rawText = rawText.substring(jsonStartIndex, jsonEndIndex + 1);
            }

            questions = JSON.parse(rawText);
            console.log(`>> Success with ${model}!`);
            break; 

        } catch (err) {
            console.warn(`>> Model ${model} failed: ${err.message}`);
            lastError = err;
        }
    }

    if (!questions) {
        throw new Error("All AI models failed. Please try again later. Last error: " + (lastError?.message || "Unknown"));
    }

    return questions;
};
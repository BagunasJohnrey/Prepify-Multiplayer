import dotenv from "dotenv";
dotenv.config();

// Direct providers: Google Gemini and Groq (OpenAI-compatible).
// They fall back to each other; the primary alternates each call to balance load.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

let toggle = 0;

const extractJson = (rawText) => {
  let text = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1) {
    text = text.substring(start, end + 1);
  }
  return JSON.parse(text);
};

const callGemini = async (prompt) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1500 }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return extractJson(text);
};

const callGroq = async (prompt) => {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Missing GROQ_API_KEY");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned no content");
  return extractJson(text);
};

export const generateQuizQuestions = async (prompt) => {
  // Alternate the primary provider each call so load is shared and neither is
  // always the fallback. Falls back to the other on any failure.
  const order = (++toggle % 2 === 0) ? [callGemini, callGroq] : [callGroq, callGemini];
  let lastError;

  for (const provider of order) {
    try {
      const name = provider === callGemini ? "Gemini" : "Groq";
      console.log(`>> Trying ${name}...`);
      const questions = await provider(prompt);
      console.log(`>> Success with ${name}!`);
      return questions;
    } catch (err) {
      console.warn(`>> ${provider === callGemini ? "Gemini" : "Groq"} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw new Error("All AI providers failed. Last error: " + (lastError?.message || "Unknown"));
};

import dotenv from "dotenv";
dotenv.config();

// Direct providers: Google Gemini and Groq (OpenAI-compatible).
// Each provider tries its candidate model list in order; if all fail, the other
// provider is used as fallback. The primary provider alternates each call to
// balance load. All values can be overridden via env.

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;

const geminiModels = (process.env.GEMINI_MODELS || "gemini-2.5-flash,gemini-2.5-pro")
  .split(",").map((s) => s.trim()).filter(Boolean);
const groqModels = (process.env.GROQ_MODELS || "openai/gpt-oss-120b,qwen/qwen3.8-27b,qwen/qwen3.6-27b,openai/gpt-oss-20b,groq/compound-mini")
  .split(",").map((s) => s.trim()).filter(Boolean);

let toggle = 0;

const AI_CALL_TIMEOUT_MS = 60000;

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_CALL_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const extractJson = (rawText) => {
  let text = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.substring(start, end + 1);
  }

  try {
    return JSON.parse(text);
  } catch {
    // Salvage truncated JSON: cut back to the last complete object and close the array.
    const lastBrace = text.lastIndexOf("}");
    if (lastBrace !== -1) {
      return JSON.parse(text.substring(0, lastBrace + 1) + "]");
    }
    throw new Error("Could not parse JSON from AI response");
  }
};

const callGemini = async (prompt, model) => {
  if (!GEMINI_KEY) throw new Error("Missing GEMINI_API_KEY");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192 }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status} (${model}): ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini (${model}) returned no content`);
  return extractJson(text);
};

const callGroq = async (prompt, model) => {
  if (!GROQ_KEY) throw new Error("Missing GROQ_API_KEY");

  const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq ${res.status} (${model}): ${errText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq (${model}) returned no content`);
  return extractJson(text);
};

const deadProviders = new Set();

const tryProvider = async (name, key, models, callFn, prompt) => {
  if (!key) throw new Error(`Missing ${name} API key`);
  if (deadProviders.has(name)) throw new Error(`${name} unavailable (cached)`);

  let lastError;
  let allModelNotFound = true;

  for (const model of models) {
    try {
      const questions = await callFn(prompt, model);
      return questions;
    } catch (err) {
      if (!/model_not_found|does not exist or you do not have access/i.test(err.message)) {
        allModelNotFound = false;
      }
      lastError = err;
    }
  }

  if (allModelNotFound) {
    deadProviders.add(name);
  } else {
    console.warn(`>> ${name} failed: ${lastError?.message || "all models failed"}`);
  }
  throw lastError || new Error(`${name} unavailable`);
};

export const generateQuizQuestions = async (prompt) => {
  const gemini = () => tryProvider("Gemini", GEMINI_KEY, geminiModels, callGemini, prompt);
  const groq = () => tryProvider("Groq", GROQ_KEY, groqModels, callGroq, prompt);

  // Alternate the primary provider each call; fall back to the other.
  const order = (++toggle % 2 === 0) ? [gemini, groq] : [groq, gemini];
  let lastError;

  for (const provider of order) {
    try {
      return await provider();
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error("All AI providers/models failed. Last error: " + (lastError?.message || "Unknown"));
};

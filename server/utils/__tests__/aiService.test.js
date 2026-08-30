import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

global.fetch = vi.fn();

import { generateQuizQuestions } from '../aiService.js';

describe('aiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.GROQ_API_KEY = 'test-groq-key';
    process.env.GEMINI_MODELS = 'gemini-test';
    process.env.GROQ_MODELS = 'groq-test';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
  });

  function mockGeminiSuccess(questions) {
    return {
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: JSON.stringify(questions) }] } }]
      })
    };
  }

  function mockGroqSuccess(questions) {
    return {
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify(questions) } }]
      })
    };
  }

  function mockFailure(status, providerName, modelName) {
    return {
      ok: false,
      status,
      text: () => Promise.resolve(`${providerName} ${status} (${modelName}): Server error`)
    };
  }

  describe('generateQuizQuestions', () => {
    it('should return questions on success', async () => {
      global.fetch.mockResolvedValue(mockGeminiSuccess([{ question: 'Test?' }]));

      const result = await generateQuizQuestions('test prompt');
      expect(result).toEqual([{ question: 'Test?' }]);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should fall back to second provider when first fails', async () => {
      // First provider returns 500 for all its models, second succeeds
      global.fetch
        .mockResolvedValue(mockFailure(500, 'Gemini', 'gemini-test'))
        .mockResolvedValue(mockFailure(500, 'Gemini', 'gemini-2.5-pro'))
        .mockResolvedValue(mockGroqSuccess([{ question: 'From Groq' }]));

      const result = await generateQuizQuestions('test prompt');
      expect(result).toEqual([{ question: 'From Groq' }]);
    });

    it('should throw when all providers fail', async () => {
      global.fetch
        .mockResolvedValue(mockFailure(500, 'Gemini', 'gemini-test'))
        .mockResolvedValue(mockFailure(500, 'Gemini', 'gemini-2.5-pro'))
        .mockResolvedValue(mockFailure(500, 'Groq', 'groq-test'))
        .mockResolvedValue(mockFailure(500, 'Groq', 'groq/compound-mini'));

      await expect(generateQuizQuestions('prompt')).rejects.toThrow('All AI providers/models failed');
    });

    it('should return parsed JSON from markdown code block', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '```json\n[{"question": "From markdown"}]\n```' }] } }]
        })
      });

      const result = await generateQuizQuestions('test prompt');
      expect(result).toEqual([{ question: 'From markdown' }]);
    });

    it('should handle truncated JSON by salvaging complete objects', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '[{"question": "test1"}, {"question": "test2"' }] } }]
        })
      });

      const result = await generateQuizQuestions('test prompt');
      // extractJson salvages by cutting to last complete } and closing array
      // Input: [{"question": "test1"}, {"question": "test2"
      // Last } is at end of first object, so result is [{"question": "test1"}]
      expect(result).toEqual([{ question: 'test1' }]);
    });

    it('should throw on completely invalid JSON from AI', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'not json at all' }] } }]
        })
      });

      await expect(generateQuizQuestions('prompt')).rejects.toThrow();
    });
  });
});

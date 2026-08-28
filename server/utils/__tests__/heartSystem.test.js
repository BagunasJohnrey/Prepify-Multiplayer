import { describe, it, expect, vi } from 'vitest';
import { calculateHearts } from '../heartSystem.js';

describe('heartSystem', () => {
  describe('calculateHearts', () => {
    it('should return current hearts when already at max', () => {
      const result = calculateHearts(3, Date.now());
      expect(result.hearts).toBe(3);
      expect(result.lastMs).toBeCloseTo(Date.now(), -2); // Within 100ms
    });

    it('should return current hearts when no timestamp provided', () => {
      const result = calculateHearts(1, null);
      expect(result.hearts).toBe(1);
      expect(result.lastMs).toBeCloseTo(Date.now(), -2);
    });

    it('should return current hearts when timestamp is NaN', () => {
      const result = calculateHearts(1, NaN);
      expect(result.hearts).toBe(1);
      expect(result.lastMs).toBeCloseTo(Date.now(), -2);
    });

    it('should regenerate hearts based on elapsed time', () => {
      // 2 minutes ago = 1 heart should regenerate
      const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
      const result = calculateHearts(1, twoMinutesAgo);
      expect(result.hearts).toBe(2);
      expect(result.lastMs).toBeCloseTo(Date.now(), -2);
    });

    it('should regenerate multiple hearts based on elapsed time', () => {
      // 5 minutes ago = 2 hearts should regenerate (from 1)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const result = calculateHearts(1, fiveMinutesAgo);
      expect(result.hearts).toBe(3); // Capped at max 3
      expect(result.lastMs).toBeCloseTo(Date.now(), -2);
    });

    it('should not exceed max hearts', () => {
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      const result = calculateHearts(2, tenMinutesAgo);
      expect(result.hearts).toBe(3); // Max is 3
    });

    it('should not regenerate if not enough time passed', () => {
      // 1 minute ago = not enough for regeneration (2 min per heart)
      const oneMinuteAgo = Date.now() - 1 * 60 * 1000;
      const result = calculateHearts(1, oneMinuteAgo);
      expect(result.hearts).toBe(1);
      expect(result.lastMs).toBe(oneMinuteAgo); // Should keep original timestamp
    });

    it('should handle edge case at exactly regeneration boundary', () => {
      // Exactly 2 minutes ago
      const exactlyTwoMinutesAgo = Date.now() - 2 * 60 * 1000;
      const result = calculateHearts(1, exactlyTwoMinutesAgo);
      expect(result.hearts).toBe(2);
    });

    it('should handle fractional regeneration correctly', () => {
      // 3 minutes ago = 1.5 hearts, should floor to 1
      const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
      const result = calculateHearts(1, threeMinutesAgo);
      expect(result.hearts).toBe(2); // 1 + floor(1.5) = 2
    });
  });
});
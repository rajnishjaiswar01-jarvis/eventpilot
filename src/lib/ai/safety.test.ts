/**
 * Tests for AI safety layer.
 * Covers: input sanitization, response validation, JSON extraction,
 * rate limiting interface, error classification, prompt building.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  sanitizeUserContent,
  buildSafePrompt,
  validateAIResponse,
  extractJSON,
  classifyAIError,
  isRetryableError,
  getRetryDelay,
  getRateLimitDelay,
  recordRequest,
  rateLimiter,
  AI_SAFETY_CONFIG,
} from '@/lib/ai/safety';

describe('AI Safety Layer', () => {
  // ─── Input Sanitization ───────────────────────────

  describe('sanitizeUserContent', () => {
    it('truncates long input', () => {
      const longInput = 'a'.repeat(AI_SAFETY_CONFIG.MAX_INPUT_LENGTH + 1000);
      const result = sanitizeUserContent(longInput);
      expect(result.length).toBe(AI_SAFETY_CONFIG.MAX_INPUT_LENGTH);
    });

    it('preserves short input', () => {
      expect(sanitizeUserContent('hello')).toBe('hello');
    });

    it('handles empty string', () => {
      expect(sanitizeUserContent('')).toBe('');
    });
  });

  describe('buildSafePrompt', () => {
    it('separates system instructions from user data', () => {
      const prompt = buildSafePrompt('You are a helpful assistant', {
        eventName: 'My Wedding',
        description: 'A beautiful ceremony',
      });
      expect(prompt).toContain('You are a helpful assistant');
      expect(prompt).toContain('USER-PROVIDED DATA');
      expect(prompt).toContain('[eventName]: """My Wedding"""');
      expect(prompt).toContain('[description]: """A beautiful ceremony"""');
    });

    it('truncates oversized user data values', () => {
      const longValue = 'x'.repeat(AI_SAFETY_CONFIG.MAX_INPUT_LENGTH + 500);
      const prompt = buildSafePrompt('System', { data: longValue });
      // The user data should be truncated
      expect(prompt.length).toBeLessThan(
        AI_SAFETY_CONFIG.MAX_INPUT_LENGTH + 500 // some overhead for structure
      );
    });
  });

  // ─── Response Validation ──────────────────────────

  describe('validateAIResponse', () => {
    const testSchema = z.object({
      name: z.string(),
      budget: z.number(),
    });

    it('validates correct JSON', () => {
      const result = validateAIResponse('{"name": "Test", "budget": 1000}', testSchema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test');
        expect(result.data.budget).toBe(1000);
      }
    });

    it('extracts JSON from markdown code block', () => {
      const wrapped = '```json\n{"name": "Test", "budget": 500}\n```';
      const result = validateAIResponse(wrapped, testSchema);
      expect(result.success).toBe(true);
    });

    it('extracts JSON embedded in text', () => {
      const text = 'Here is the result: {"name": "Event", "budget": 2000} Hope that helps!';
      const result = validateAIResponse(text, testSchema);
      expect(result.success).toBe(true);
    });

    it('rejects non-JSON response', () => {
      const result = validateAIResponse('This is just plain text with no JSON', testSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('INVALID_JSON');
      }
    });

    it('rejects schema-invalid JSON', () => {
      const result = validateAIResponse('{"name": 123, "budget": "not a number"}', testSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('SCHEMA_VALIDATION_FAILED');
      }
    });

    it('rejects oversized response', () => {
      const huge = JSON.stringify({ name: 'x'.repeat(AI_SAFETY_CONFIG.MAX_RESPONSE_LENGTH), budget: 0 });
      const result = validateAIResponse(huge, testSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('RESPONSE_TOO_LARGE');
      }
    });

    it('rejects malformed JSON', () => {
      const result = validateAIResponse('{name: broken}', testSchema);
      expect(result.success).toBe(false);
    });

    it('handles empty response', () => {
      const result = validateAIResponse('', testSchema);
      expect(result.success).toBe(false);
    });
  });

  // ─── JSON Extraction ──────────────────────────────

  describe('extractJSON', () => {
    it('extracts direct JSON', () => {
      expect(extractJSON('{"a":1}')).toBe('{"a":1}');
    });

    it('extracts from code block', () => {
      const text = 'Here:\n```json\n{"a":1}\n```\nDone';
      expect(extractJSON(text)).toBe('{"a":1}');
    });

    it('extracts first JSON object from mixed text', () => {
      const text = 'Result: {"a":1} and also {"b":2}';
      const result = extractJSON(text);
      expect(result).toBe('{"a":1}');
    });

    it('handles nested objects correctly', () => {
      const text = 'Here: {"a": {"b": 1}, "c": 2} done';
      const result = extractJSON(text);
      expect(JSON.parse(result!)).toEqual({ a: { b: 1 }, c: 2 });
    });

    it('handles strings containing braces', () => {
      const json = '{"text": "hello {world}"}';
      const text = `Result: ${json} end`;
      const result = extractJSON(text);
      expect(JSON.parse(result!)).toEqual({ text: 'hello {world}' });
    });

    it('returns null for no JSON', () => {
      expect(extractJSON('just plain text')).toBeNull();
    });

    it('returns null for unbalanced braces', () => {
      expect(extractJSON('{{{')).toBeNull();
    });
  });

  // ─── Rate Limiting ────────────────────────────────

  describe('rate limiting', () => {
    it('rateLimiter implements RateLimiter interface', () => {
      expect(typeof rateLimiter.getDelay).toBe('function');
      expect(typeof rateLimiter.recordRequest).toBe('function');
    });

    it('getRateLimitDelay returns a number', () => {
      expect(typeof getRateLimitDelay()).toBe('number');
    });

    it('recordRequest does not throw', () => {
      expect(() => recordRequest()).not.toThrow();
    });
  });

  // ─── Error Classification ────────────────────────

  describe('classifyAIError', () => {
    it('classifies 429 as rate_limit', () => {
      expect(classifyAIError(429)).toBe('rate_limit');
    });

    it('classifies 408 as timeout', () => {
      expect(classifyAIError(408)).toBe('timeout');
    });

    it('classifies 401/403 as auth_error', () => {
      expect(classifyAIError(401)).toBe('auth_error');
      expect(classifyAIError(403)).toBe('auth_error');
    });

    it('classifies 5xx as server_error', () => {
      expect(classifyAIError(500)).toBe('server_error');
      expect(classifyAIError(503)).toBe('server_error');
    });

    it('classifies other codes as unknown', () => {
      expect(classifyAIError(400)).toBe('unknown');
      expect(classifyAIError(404)).toBe('unknown');
    });
  });

  describe('isRetryableError', () => {
    it('rate_limit is retryable', () => expect(isRetryableError('rate_limit')).toBe(true));
    it('timeout is retryable', () => expect(isRetryableError('timeout')).toBe(true));
    it('server_error is retryable', () => expect(isRetryableError('server_error')).toBe(true));
    it('auth_error is not retryable', () => expect(isRetryableError('auth_error')).toBe(false));
    it('unknown is not retryable', () => expect(isRetryableError('unknown')).toBe(false));
  });

  describe('getRetryDelay', () => {
    it('uses exponential backoff', () => {
      expect(getRetryDelay(0)).toBe(1000);
      expect(getRetryDelay(1)).toBe(2000);
      expect(getRetryDelay(2)).toBe(4000);
    });
  });
});

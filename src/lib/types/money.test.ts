/**
 * Tests for the Money model.
 * Covers: construction, arithmetic, rounding, allocation, formatting, edge cases,
 * decimal string parsing, and financial determinism.
 */

import { describe, it, expect } from 'vitest';
import {
  moneyFromMinor,
  moneyFromMajor,
  moneyFromDecimalString,
  moneyToMajor,
  moneyAdd,
  moneySubtract,
  moneyMultiply,
  moneyAllocate,
  moneySum,
  moneyZero,
  moneyIsNegative,
  moneyIsZero,
  moneyCompare,
  bankersRound,
  moneyFormat,
} from '@/lib/types/money';

describe('Money model', () => {
  // ─── Construction ───────────────────────────────────

  describe('moneyFromMinor', () => {
    it('creates money from integer minor units', () => {
      const m = moneyFromMinor(15000, 'INR');
      expect(m.amountMinor).toBe(15000);
      expect(m.currency).toBe('INR');
    });

    it('throws on non-integer values', () => {
      expect(() => moneyFromMinor(100.5, 'INR')).toThrow('safe integer');
    });

    it('throws on unsafe integers', () => {
      expect(() => moneyFromMinor(Number.MAX_SAFE_INTEGER + 1, 'INR')).toThrow('safe integer');
    });

    it('throws on NaN', () => {
      expect(() => moneyFromMinor(NaN, 'INR')).toThrow('safe integer');
    });

    it('throws on Infinity', () => {
      expect(() => moneyFromMinor(Infinity, 'INR')).toThrow('safe integer');
    });

    it('allows negative integers', () => {
      const m = moneyFromMinor(-500, 'USD');
      expect(m.amountMinor).toBe(-500);
    });

    it('allows zero', () => {
      const m = moneyFromMinor(0, 'EUR');
      expect(m.amountMinor).toBe(0);
    });
  });

  describe('moneyFromMajor', () => {
    it('converts major units to minor units', () => {
      const m = moneyFromMajor(150, 'INR');
      expect(m.amountMinor).toBe(15000);
    });

    it('handles decimal major units', () => {
      const m = moneyFromMajor(150.75, 'INR');
      expect(m.amountMinor).toBe(15075);
    });

    it('documents IEEE 754 imprecision for 10.005', () => {
      // 10.005 as a float64 is actually 10.004999999999999...
      // So 10.005 * 100 = 1000.4999... which rounds to 1000.
      // This is the CORRECT behavior for a float input.
      const m = moneyFromMajor(10.005, 'USD');
      expect(m.amountMinor).toBe(1000);
    });
  });

  // ─── Decimal String Construction ────────────────────

  describe('moneyFromDecimalString', () => {
    it('parses exact integer', () => {
      expect(moneyFromDecimalString('150', 'INR').amountMinor).toBe(15000);
    });

    it('parses exact two-decimal value', () => {
      expect(moneyFromDecimalString('150.75', 'INR').amountMinor).toBe(15075);
    });

    it('parses single decimal digit', () => {
      expect(moneyFromDecimalString('10.5', 'USD').amountMinor).toBe(1050);
    });

    it('applies banker rounding: 10.005 → 1000 (round to even)', () => {
      // Exact decimal 10.005 → 1000.5 minor → round to even → 1000
      const m = moneyFromDecimalString('10.005', 'USD');
      expect(m.amountMinor).toBe(1000);
    });

    it('applies banker rounding: 10.015 → 1002 (round to even)', () => {
      // Exact decimal 10.015 → 1001.5 minor → round to even → 1002
      const m = moneyFromDecimalString('10.015', 'USD');
      expect(m.amountMinor).toBe(1002);
    });

    it('applies banker rounding: 10.025 → 1002 (round to even)', () => {
      const m = moneyFromDecimalString('10.025', 'USD');
      expect(m.amountMinor).toBe(1002);
    });

    it('applies banker rounding: 10.035 → 1004 (round to even)', () => {
      const m = moneyFromDecimalString('10.035', 'USD');
      expect(m.amountMinor).toBe(1004);
    });

    it('rounds up when digit > 5', () => {
      expect(moneyFromDecimalString('10.006', 'USD').amountMinor).toBe(1001);
      expect(moneyFromDecimalString('10.009', 'USD').amountMinor).toBe(1001);
    });

    it('truncates when digit < 5', () => {
      expect(moneyFromDecimalString('10.004', 'USD').amountMinor).toBe(1000);
      expect(moneyFromDecimalString('10.001', 'USD').amountMinor).toBe(1000);
    });

    it('handles many decimal places', () => {
      // 10.0051 → has remainder after 5, so rounds up
      expect(moneyFromDecimalString('10.0051', 'USD').amountMinor).toBe(1001);
    });

    it('handles negative values', () => {
      expect(moneyFromDecimalString('-150.75', 'INR').amountMinor).toBe(-15075);
    });

    it('handles zero', () => {
      expect(moneyFromDecimalString('0', 'USD').amountMinor).toBe(0);
      expect(moneyFromDecimalString('0.00', 'USD').amountMinor).toBe(0);
    });

    it('throws on invalid string', () => {
      expect(() => moneyFromDecimalString('abc', 'INR')).toThrow('Invalid decimal');
      expect(() => moneyFromDecimalString('', 'INR')).toThrow('Invalid decimal');
      expect(() => moneyFromDecimalString('10.5.3', 'INR')).toThrow('Invalid decimal');
    });

    it('handles whitespace', () => {
      expect(moneyFromDecimalString('  100.50  ', 'INR').amountMinor).toBe(10050);
    });
  });

  describe('moneyToMajor', () => {
    it('converts minor to major', () => {
      expect(moneyToMajor(moneyFromMinor(15075, 'INR'))).toBe(150.75);
    });

    it('handles zero', () => {
      expect(moneyToMajor(moneyFromMinor(0, 'USD'))).toBe(0);
    });
  });

  // ─── Arithmetic ─────────────────────────────────────

  describe('moneyAdd', () => {
    it('adds two money values', () => {
      const a = moneyFromMinor(1000, 'INR');
      const b = moneyFromMinor(2500, 'INR');
      const result = moneyAdd(a, b);
      expect(result.amountMinor).toBe(3500);
      expect(result.currency).toBe('INR');
    });

    it('throws on currency mismatch', () => {
      const a = moneyFromMinor(1000, 'INR');
      const b = moneyFromMinor(2500, 'USD');
      expect(() => moneyAdd(a, b)).toThrow('Currency mismatch');
    });
  });

  describe('moneySubtract', () => {
    it('subtracts money values', () => {
      const a = moneyFromMinor(5000, 'USD');
      const b = moneyFromMinor(3000, 'USD');
      expect(moneySubtract(a, b).amountMinor).toBe(2000);
    });

    it('allows negative results', () => {
      const a = moneyFromMinor(1000, 'USD');
      const b = moneyFromMinor(3000, 'USD');
      expect(moneySubtract(a, b).amountMinor).toBe(-2000);
    });
  });

  describe('moneyMultiply', () => {
    it('multiplies by scalar', () => {
      const m = moneyFromMinor(1000, 'INR');
      expect(moneyMultiply(m, 3).amountMinor).toBe(3000);
    });

    it('rounds result', () => {
      const m = moneyFromMinor(1000, 'INR');
      expect(moneyMultiply(m, 0.333).amountMinor).toBe(333);
    });

    it('handles zero factor', () => {
      const m = moneyFromMinor(1000, 'INR');
      expect(moneyMultiply(m, 0).amountMinor).toBe(0);
    });
  });

  // ─── Allocation ─────────────────────────────────────

  describe('moneyAllocate', () => {
    it('splits evenly with no remainder', () => {
      const m = moneyFromMinor(900, 'INR');
      const parts = moneyAllocate(m, [1, 1, 1]);
      expect(parts.map((p) => p.amountMinor)).toEqual([300, 300, 300]);
    });

    it('distributes remainder correctly', () => {
      const m = moneyFromMinor(1000, 'INR');
      const parts = moneyAllocate(m, [1, 1, 1]);
      const amounts = parts.map((p) => p.amountMinor);
      expect(amounts.reduce((a, b) => a + b, 0)).toBe(1000);
      expect(amounts).toEqual([334, 333, 333]);
    });

    it('handles weighted allocation', () => {
      const m = moneyFromMinor(10000, 'INR');
      const parts = moneyAllocate(m, [50, 30, 20]);
      const amounts = parts.map((p) => p.amountMinor);
      expect(amounts.reduce((a, b) => a + b, 0)).toBe(10000);
      expect(amounts).toEqual([5000, 3000, 2000]);
    });

    it('sum always equals original (property test)', () => {
      const m = moneyFromMinor(9999, 'USD');
      const parts = moneyAllocate(m, [1, 2, 3, 4]);
      const sum = parts.reduce((s, p) => s + p.amountMinor, 0);
      expect(sum).toBe(9999);
    });

    it('handles single-part allocation', () => {
      const m = moneyFromMinor(1000, 'INR');
      const parts = moneyAllocate(m, [1]);
      expect(parts[0].amountMinor).toBe(1000);
    });

    it('handles large number of parts', () => {
      const m = moneyFromMinor(100, 'USD');
      const ratios = Array(100).fill(1);
      const parts = moneyAllocate(m, ratios);
      expect(parts.reduce((s, p) => s + p.amountMinor, 0)).toBe(100);
    });

    it('throws on empty ratios', () => {
      const m = moneyFromMinor(1000, 'INR');
      expect(() => moneyAllocate(m, [])).toThrow('zero parts');
    });

    it('throws on all-zero ratios', () => {
      const m = moneyFromMinor(1000, 'INR');
      expect(() => moneyAllocate(m, [0, 0, 0])).toThrow('positive');
    });
  });

  // ─── Sum & Comparison ───────────────────────────────

  describe('moneySum', () => {
    it('sums an array', () => {
      const values = [
        moneyFromMinor(100, 'INR'),
        moneyFromMinor(200, 'INR'),
        moneyFromMinor(300, 'INR'),
      ];
      expect(moneySum(values).amountMinor).toBe(600);
    });

    it('throws on empty array', () => {
      expect(() => moneySum([])).toThrow('empty array');
    });

    it('throws on mixed currencies', () => {
      expect(() => moneySum([
        moneyFromMinor(100, 'INR'),
        moneyFromMinor(200, 'USD'),
      ])).toThrow('Currency mismatch');
    });
  });

  describe('moneyCompare', () => {
    it('returns -1 when a < b', () => {
      expect(moneyCompare(moneyFromMinor(100, 'INR'), moneyFromMinor(200, 'INR'))).toBe(-1);
    });

    it('returns 0 when equal', () => {
      expect(moneyCompare(moneyFromMinor(100, 'INR'), moneyFromMinor(100, 'INR'))).toBe(0);
    });

    it('returns 1 when a > b', () => {
      expect(moneyCompare(moneyFromMinor(200, 'INR'), moneyFromMinor(100, 'INR'))).toBe(1);
    });
  });

  // ─── Utility ────────────────────────────────────────

  describe('moneyZero', () => {
    it('creates zero value', () => {
      const z = moneyZero('GBP');
      expect(z.amountMinor).toBe(0);
      expect(z.currency).toBe('GBP');
      expect(moneyIsZero(z)).toBe(true);
    });
  });

  describe('moneyIsNegative', () => {
    it('detects negative', () => {
      expect(moneyIsNegative(moneyFromMinor(-1, 'INR'))).toBe(true);
      expect(moneyIsNegative(moneyFromMinor(0, 'INR'))).toBe(false);
      expect(moneyIsNegative(moneyFromMinor(1, 'INR'))).toBe(false);
    });
  });

  // ─── Banker's Rounding ──────────────────────────────

  describe('bankersRound', () => {
    it('rounds .5 to even (down to 0)', () => {
      expect(bankersRound(0.5)).toBe(0);
    });

    it('rounds .5 to even (up to 2)', () => {
      expect(bankersRound(1.5)).toBe(2);
    });

    it('rounds .5 to even (down to 2)', () => {
      expect(bankersRound(2.5)).toBe(2);
    });

    it('rounds .5 to even (up to 4)', () => {
      expect(bankersRound(3.5)).toBe(4);
    });

    it('rounds normally for non-.5', () => {
      expect(bankersRound(2.3)).toBe(2);
      expect(bankersRound(2.7)).toBe(3);
    });

    it('handles negative .5 values', () => {
      // -0.5 → floor is -1, decimal is 0.5, -1 is odd → round to 0
      expect(bankersRound(-0.5)).toBe(0);
      // -1.5 → floor is -2, decimal is 0.5, -2 is even → stay at -2
      expect(bankersRound(-1.5)).toBe(-2);
    });

    it('handles exact integers', () => {
      expect(bankersRound(5)).toBe(5);
      expect(bankersRound(0)).toBe(0);
      expect(bankersRound(-3)).toBe(-3);
    });

    it('throws on NaN', () => {
      expect(() => bankersRound(NaN)).toThrow('non-finite');
    });

    it('throws on Infinity', () => {
      expect(() => bankersRound(Infinity)).toThrow('non-finite');
    });
  });

  // ─── Formatting ─────────────────────────────────────

  describe('moneyFormat', () => {
    it('formats INR with ₹ symbol', () => {
      const formatted = moneyFormat(moneyFromMinor(150075, 'INR'));
      expect(formatted).toContain('₹');
      expect(formatted).toContain('1,500.75');
    });

    it('formats USD with $ symbol', () => {
      const formatted = moneyFormat(moneyFromMinor(10050, 'USD'));
      expect(formatted).toContain('$');
      expect(formatted).toContain('100.50');
    });

    it('formats zero', () => {
      const formatted = moneyFormat(moneyZero('INR'));
      expect(formatted).toContain('0.00');
    });

    it('formats negative amounts', () => {
      const formatted = moneyFormat(moneyFromMinor(-5000, 'USD'));
      expect(formatted).toContain('50.00');
    });
  });

  // ─── Determinism ────────────────────────────────────

  describe('financial determinism', () => {
    it('produces identical results across repeated calculations', () => {
      const results: number[] = [];
      for (let i = 0; i < 100; i++) {
        const a = moneyFromMinor(3333, 'INR');
        const b = moneyFromMinor(6667, 'INR');
        results.push(moneyAdd(a, b).amountMinor);
      }
      expect(new Set(results).size).toBe(1);
      expect(results[0]).toBe(10000);
    });

    it('avoids classic floating-point issue (0.1 + 0.2)', () => {
      const a = moneyFromMinor(10, 'USD');
      const b = moneyFromMinor(20, 'USD');
      const sum = moneyAdd(a, b);
      expect(sum.amountMinor).toBe(30);
    });

    it('decimal string path is deterministic for half-cent values', () => {
      // Run 100 times — must always produce same result
      const results: number[] = [];
      for (let i = 0; i < 100; i++) {
        results.push(moneyFromDecimalString('10.005', 'USD').amountMinor);
      }
      expect(new Set(results).size).toBe(1);
      expect(results[0]).toBe(1000); // banker's round to even
    });
  });
});

/**
 * Tests for business rules validation engine.
 * Covers: date validation, budget overflow, negative costs, task state consistency.
 */

import { describe, it, expect } from 'vitest';
import {
  validateEventBusinessRules,
  getErrors,
  getWarnings,
  hasErrors,
} from '@/lib/engine/business-rules';
import type { EventData } from '@/lib/types/domain';

function makeEvent(overrides: Partial<EventData> = {}): EventData {
  return {
    id: 'evt-1',
    name: 'Test Event',
    description: '',
    category: 'wedding',
    status: 'planning',
    startDate: '2027-06-01T00:00:00Z',
    endDate: '2027-06-02T00:00:00Z',
    location: 'Test Venue',
    expectedGuests: 100,
    currency: 'INR',
    totalBudgetMinor: 10000000, // 1,00,000 INR
    budgetItems: [],
    tasks: [],
    vendors: [],
    teamMembers: [],
    risks: [],
    createdAt: '2027-01-01T00:00:00Z',
    updatedAt: '2027-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('Business Rules Engine', () => {
  // ─── Date Validation ──────────────────────────────

  describe('date validation', () => {
    it('accepts valid date range', () => {
      const event = makeEvent();
      const results = validateEventBusinessRules(event);
      expect(getErrors(results).filter((r) => r.code.includes('DATE'))).toHaveLength(0);
    });

    it('detects end date before start date', () => {
      const event = makeEvent({
        startDate: '2027-06-15T00:00:00Z',
        endDate: '2027-06-01T00:00:00Z',
      });
      const results = validateEventBusinessRules(event);
      const errors = getErrors(results);
      expect(errors.some((e) => e.code === 'END_BEFORE_START')).toBe(true);
    });

    it('detects invalid start date', () => {
      const event = makeEvent({ startDate: 'not-a-date' });
      const results = validateEventBusinessRules(event);
      expect(getErrors(results).some((e) => e.code === 'INVALID_START_DATE')).toBe(true);
    });

    it('warns when task due date is after event end', () => {
      const event = makeEvent({
        tasks: [{
          id: 't1', title: 'Late Task', description: '', status: 'pending',
          priority: 'medium', dueDate: '2027-12-01T00:00:00Z',
          assigneeId: '', dependsOn: [], completedAt: '',
        }],
      });
      const results = validateEventBusinessRules(event);
      expect(getWarnings(results).some((w) => w.code === 'TASK_DUE_AFTER_EVENT')).toBe(true);
    });
  });

  // ─── Budget Validation ────────────────────────────

  describe('budget validation', () => {
    it('detects budget overflow', () => {
      const event = makeEvent({
        totalBudgetMinor: 100000,
        budgetItems: [
          { id: 'b1', name: 'Venue', category: 'venue', estimatedAmountMinor: 80000, actualAmountMinor: 0, isPaid: false, notes: '' },
          { id: 'b2', name: 'Catering', category: 'catering', estimatedAmountMinor: 50000, actualAmountMinor: 0, isPaid: false, notes: '' },
        ],
      });
      const results = validateEventBusinessRules(event);
      expect(getErrors(results).some((e) => e.code === 'BUDGET_OVERFLOW')).toBe(true);
    });

    it('detects negative estimated cost', () => {
      const event = makeEvent({
        budgetItems: [
          { id: 'b1', name: 'Bad Item', category: 'venue', estimatedAmountMinor: -5000, actualAmountMinor: 0, isPaid: false, notes: '' },
        ],
      });
      const results = validateEventBusinessRules(event);
      expect(getErrors(results).some((e) => e.code === 'NEGATIVE_ESTIMATED_COST')).toBe(true);
    });

    it('detects negative actual cost', () => {
      const event = makeEvent({
        budgetItems: [
          { id: 'b1', name: 'Bad Item', category: 'venue', estimatedAmountMinor: 5000, actualAmountMinor: -100, isPaid: false, notes: '' },
        ],
      });
      const results = validateEventBusinessRules(event);
      expect(getErrors(results).some((e) => e.code === 'NEGATIVE_ACTUAL_COST')).toBe(true);
    });

    it('warns when actual exceeds estimated', () => {
      const event = makeEvent({
        budgetItems: [
          { id: 'b1', name: 'Venue', category: 'venue', estimatedAmountMinor: 50000, actualAmountMinor: 60000, isPaid: true, notes: '' },
        ],
      });
      const results = validateEventBusinessRules(event);
      expect(getWarnings(results).some((w) => w.code === 'ACTUAL_EXCEEDS_ESTIMATED')).toBe(true);
    });

    it('passes for valid budget within limits', () => {
      const event = makeEvent({
        totalBudgetMinor: 100000,
        budgetItems: [
          { id: 'b1', name: 'Venue', category: 'venue', estimatedAmountMinor: 40000, actualAmountMinor: 38000, isPaid: true, notes: '' },
          { id: 'b2', name: 'Catering', category: 'catering', estimatedAmountMinor: 30000, actualAmountMinor: 0, isPaid: false, notes: '' },
        ],
      });
      const results = validateEventBusinessRules(event);
      expect(hasErrors(results)).toBe(false);
    });
  });

  // ─── Task State Consistency ───────────────────────

  describe('task validation', () => {
    it('detects self-dependency', () => {
      const event = makeEvent({
        tasks: [{
          id: 't1', title: 'Self Dep', description: '', status: 'pending',
          priority: 'medium', dueDate: '', assigneeId: '', dependsOn: ['t1'], completedAt: '',
        }],
      });
      const results = validateEventBusinessRules(event);
      expect(getErrors(results).some((e) => e.code === 'SELF_DEPENDENCY')).toBe(true);
    });

    it('detects invalid dependency reference', () => {
      const event = makeEvent({
        tasks: [{
          id: 't1', title: 'Orphan Dep', description: '', status: 'pending',
          priority: 'medium', dueDate: '', assigneeId: '', dependsOn: ['nonexistent'], completedAt: '',
        }],
      });
      const results = validateEventBusinessRules(event);
      expect(getErrors(results).some((e) => e.code === 'INVALID_DEPENDENCY_REF')).toBe(true);
    });

    it('warns on completed task without completion date', () => {
      const event = makeEvent({
        tasks: [{
          id: 't1', title: 'No Date', description: '', status: 'completed',
          priority: 'medium', dueDate: '', assigneeId: '', dependsOn: [], completedAt: '',
        }],
      });
      const results = validateEventBusinessRules(event);
      expect(getWarnings(results).some((w) => w.code === 'COMPLETED_NO_DATE')).toBe(true);
    });

    it('warns on completed task with incomplete dependencies', () => {
      const event = makeEvent({
        tasks: [
          { id: 't1', title: 'Dependency', description: '', status: 'pending', priority: 'medium', dueDate: '', assigneeId: '', dependsOn: [], completedAt: '' },
          { id: 't2', title: 'Dependent', description: '', status: 'completed', priority: 'medium', dueDate: '', assigneeId: '', dependsOn: ['t1'], completedAt: '2027-06-01T00:00:00Z' },
        ],
      });
      const results = validateEventBusinessRules(event);
      expect(getWarnings(results).some((w) => w.code === 'COMPLETED_WITH_INCOMPLETE_DEPS')).toBe(true);
    });
  });

  // ─── Team References ──────────────────────────────

  describe('team reference validation', () => {
    it('warns on invalid assignee reference', () => {
      const event = makeEvent({
        tasks: [{
          id: 't1', title: 'Assigned', description: '', status: 'pending',
          priority: 'medium', dueDate: '', assigneeId: 'ghost-member', dependsOn: [], completedAt: '',
        }],
      });
      const results = validateEventBusinessRules(event);
      expect(getWarnings(results).some((w) => w.code === 'INVALID_ASSIGNEE_REF')).toBe(true);
    });

    it('passes when assignee exists', () => {
      const event = makeEvent({
        teamMembers: [{ id: 'tm1', name: 'Alice', role: 'organizer', email: '', phone: '', responsibilities: '' }],
        tasks: [{
          id: 't1', title: 'Assigned', description: '', status: 'pending',
          priority: 'medium', dueDate: '', assigneeId: 'tm1', dependsOn: [], completedAt: '',
        }],
      });
      const results = validateEventBusinessRules(event);
      expect(getWarnings(results).some((w) => w.code === 'INVALID_ASSIGNEE_REF')).toBe(false);
    });
  });

  // ─── Helpers ──────────────────────────────────────

  describe('helper functions', () => {
    it('hasErrors returns false for clean event', () => {
      const event = makeEvent();
      expect(hasErrors(validateEventBusinessRules(event))).toBe(false);
    });
  });
});

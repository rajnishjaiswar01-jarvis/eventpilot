/**
 * Tests for simulation engine.
 * Covers: snapshot isolation, immutability, modifications, comparisons.
 */

import { describe, it, expect } from 'vitest';
import {
  deepCloneEventData,
  createScenario,
  applyBudgetModification,
  applyGuestCountModification,
  compareScenarioToOriginal,
  promoteScenario,
} from '@/lib/engine/simulation';
import type { EventData } from '@/lib/types/domain';

function makeEvent(): EventData {
  return {
    id: 'evt-1',
    name: 'Test Event',
    description: '',
    category: 'wedding',
    status: 'planning',
    startDate: '2027-06-01T00:00:00Z',
    endDate: '2027-06-02T00:00:00Z',
    location: 'Test Venue',
    expectedGuests: 200,
    currency: 'INR',
    totalBudgetMinor: 10000000,
    budgetItems: [
      { id: 'b1', name: 'Venue', category: 'venue', estimatedAmountMinor: 500000, actualAmountMinor: 0, isPaid: false, notes: '' },
      { id: 'b2', name: 'Catering', category: 'catering', estimatedAmountMinor: 300000, actualAmountMinor: 0, isPaid: false, notes: '' },
    ],
    tasks: [
      { id: 't1', title: 'Book Venue', description: '', status: 'pending', priority: 'high', dueDate: '2027-05-01T00:00:00Z', assigneeId: '', dependsOn: [], completedAt: '' },
    ],
    vendors: [],
    teamMembers: [],
    risks: [],
    createdAt: '2027-01-01T00:00:00Z',
    updatedAt: '2027-01-01T00:00:00Z',
  };
}

describe('Simulation Engine', () => {
  // ─── Deep Clone ───────────────────────────────────

  describe('deepCloneEventData', () => {
    it('creates an independent copy', () => {
      const original = makeEvent();
      const clone = deepCloneEventData(original);

      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);
    });

    it('mutations to clone do not affect original', () => {
      const original = makeEvent();
      const clone = deepCloneEventData(original);

      clone.name = 'Modified';
      clone.budgetItems[0].estimatedAmountMinor = 999999;

      expect(original.name).toBe('Test Event');
      expect(original.budgetItems[0].estimatedAmountMinor).toBe(500000);
    });
  });

  // ─── Scenario Creation ────────────────────────────

  describe('createScenario', () => {
    it('creates scenario with snapshot of original', () => {
      const original = makeEvent();
      const scenario = createScenario(original, 'Budget Cut Scenario');

      expect(scenario.sourceEventId).toBe('evt-1');
      expect(scenario.name).toBe('Budget Cut Scenario');
      expect(scenario.snapshotData).toEqual(original);
      expect(scenario.snapshotData).not.toBe(original);
    });

    it('scenario snapshot is independent of original', () => {
      const original = makeEvent();
      const scenario = createScenario(original, 'Test');

      original.name = 'Changed After Snapshot';
      expect(scenario.snapshotData.name).toBe('Test Event');
    });
  });

  // ─── Budget Modification ──────────────────────────

  describe('applyBudgetModification', () => {
    it('returns new scenario with modified budget', () => {
      const original = makeEvent();
      const scenario = createScenario(original, 'Test');
      const modified = applyBudgetModification(scenario, 'b1', 750000);

      expect(modified.snapshotData.budgetItems[0].estimatedAmountMinor).toBe(750000);
      // Original scenario unchanged
      expect(scenario.snapshotData.budgetItems[0].estimatedAmountMinor).toBe(500000);
    });

    it('tracks modifications', () => {
      const original = makeEvent();
      const scenario = createScenario(original, 'Test');
      const modified = applyBudgetModification(scenario, 'b1', 750000);

      expect(modified.modifications).toHaveProperty('budget.b1.estimated');
    });

    it('throws for non-existent budget item', () => {
      const original = makeEvent();
      const scenario = createScenario(original, 'Test');
      expect(() => applyBudgetModification(scenario, 'nonexistent', 100)).toThrow('not found');
    });
  });

  // ─── Guest Count Modification ─────────────────────

  describe('applyGuestCountModification', () => {
    it('returns new scenario with modified guest count', () => {
      const original = makeEvent();
      const scenario = createScenario(original, 'Test');
      const modified = applyGuestCountModification(scenario, 300);

      expect(modified.snapshotData.expectedGuests).toBe(300);
      expect(scenario.snapshotData.expectedGuests).toBe(200);
    });
  });

  // ─── Comparison ───────────────────────────────────

  describe('compareScenarioToOriginal', () => {
    it('computes correct differences', () => {
      const original = makeEvent();
      const scenario = createScenario(original, 'Test');
      const modified = applyBudgetModification(scenario, 'b1', 750000);
      const modified2 = applyGuestCountModification(modified, 300);

      const comparison = compareScenarioToOriginal(original, modified2);

      expect(comparison.budgetDifferenceMinor).toBe(250000); // 750000 - 500000
      expect(comparison.guestDifference).toBe(100); // 300 - 200
    });

    it('returns zero differences for unmodified scenario', () => {
      const original = makeEvent();
      const scenario = createScenario(original, 'Test');

      const comparison = compareScenarioToOriginal(original, scenario);
      expect(comparison.budgetDifferenceMinor).toBe(0);
      expect(comparison.guestDifference).toBe(0);
    });
  });

  // ─── Promotion ────────────────────────────────────

  describe('promoteScenario', () => {
    it('preserves original event ID', () => {
      const original = makeEvent();
      const scenario = createScenario(original, 'Test');
      const modified = applyBudgetModification(scenario, 'b1', 750000);
      const promoted = promoteScenario(modified);

      expect(promoted.id).toBe('evt-1');
      expect(promoted.budgetItems[0].estimatedAmountMinor).toBe(750000);
    });

    it('does not mutate the scenario', () => {
      const original = makeEvent();
      const scenario = createScenario(original, 'Test');
      const modified = applyBudgetModification(scenario, 'b1', 750000);
      promoteScenario(modified);

      // Scenario data unchanged
      expect(modified.snapshotData.budgetItems[0].estimatedAmountMinor).toBe(750000);
    });

    it('promoted data is independent of scenario', () => {
      const original = makeEvent();
      const scenario = createScenario(original, 'Test');
      const modified = applyBudgetModification(scenario, 'b1', 750000);
      const promoted = promoteScenario(modified);

      // Mutating promoted should not affect scenario
      promoted.name = 'Mutated';
      expect(modified.snapshotData.name).toBe('Test Event');
    });
  });

  // ─── Deep copy isolation ──────────────────────────

  describe('deep copy isolation', () => {
    it('nested array mutations do not leak', () => {
      const original = makeEvent();
      const clone = deepCloneEventData(original);

      clone.budgetItems.push({
        id: 'b-new', name: 'New', category: 'venue',
        estimatedAmountMinor: 100, actualAmountMinor: 0,
        isPaid: false, notes: '',
      });

      expect(original.budgetItems).toHaveLength(2);
      expect(clone.budgetItems).toHaveLength(3);
    });

    it('chained scenario modifications are independent', () => {
      const original = makeEvent();
      const s1 = createScenario(original, 'S1');
      const s2 = applyBudgetModification(s1, 'b1', 100);
      const s3 = applyBudgetModification(s2, 'b1', 200);

      expect(s1.snapshotData.budgetItems[0].estimatedAmountMinor).toBe(500000);
      expect(s2.snapshotData.budgetItems[0].estimatedAmountMinor).toBe(100);
      expect(s3.snapshotData.budgetItems[0].estimatedAmountMinor).toBe(200);
    });
  });
});

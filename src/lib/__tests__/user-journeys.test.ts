/**
 * User Journey Tests — Priority 3.
 *
 * Tests the critical user workflows by exercising business logic, store operations,
 * schemas, engines and persistence. These are pure logic tests (no DOM rendering)
 * that verify the same code paths the UI exercises.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CreateEventInputSchema, EventDataSchema } from '../schemas/event.schema';
import {
  createScenario,
  applyGuestCountModification,
  applyBudgetModification,
  compareScenarioToOriginal,
  promoteScenario,
  deepCloneEventData,
} from '../engine/simulation';
import {
  buildDependencyGraph,
  detectCycles,
  topologicalSort,
  validateDependencies,
} from '../engine/dependency-graph';
import { exportEventsToJSON, importEventsFromJSON } from '../stores/persistence';
import { moneyFromMinor, moneyFormat, moneyFromDecimalString } from '../types/money';
import type { EventData, Task, BudgetItem } from '../types/domain';

// ─── Helpers ────────────────────────────────────────────

function makeEvent(overrides: Partial<EventData> = {}): EventData {
  return {
    id: 'evt-test-1',
    name: 'Test Event',
    description: 'A test event',
    category: 'college_festival',
    status: 'planning',
    startDate: '2026-12-15',
    endDate: '2026-12-17',
    location: 'Main Campus',
    expectedGuests: 500,
    currency: 'INR',
    totalBudgetMinor: 20000000, // ₹2,00,000
    budgetItems: [],
    tasks: [],
    vendors: [],
    teamMembers: [],
    risks: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeBudgetItem(overrides: Partial<BudgetItem> = {}): BudgetItem {
  return {
    id: 'bi-1',
    name: 'Venue Booking',
    category: 'venue',
    estimatedAmountMinor: 5000000,
    actualAmountMinor: 0,
    isPaid: false,
    notes: '',
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Book venue',
    description: 'Confirm the venue',
    status: 'pending',
    priority: 'high',
    dueDate: '2026-11-15',
    assigneeId: '',
    dependsOn: [],
    completedAt: '',
    ...overrides,
  };
}

// ─── Journey 1: Create an event successfully ────────────

describe('Journey 1: Create an event successfully', () => {
  it('validates valid CreateEventInput', () => {
    const input = {
      name: 'TechFest 2026',
      description: 'Annual college technology festival',
      category: 'college_festival',
      startDate: '2026-12-15',
      endDate: '2026-12-17',
      location: 'Main Campus',
      expectedGuests: 500,
      currency: 'INR',
      totalBudgetMajor: 200000,
    };

    const result = CreateEventInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('TechFest 2026');
      expect(result.data.category).toBe('college_festival');
      expect(result.data.totalBudgetMajor).toBe(200000);
    }
  });

  it('creates an EventData that passes schema validation', () => {
    const event = makeEvent();
    const result = EventDataSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

// ─── Journey 2: Reject invalid event input ──────────────

describe('Journey 2: Reject invalid event input', () => {
  it('rejects missing event name', () => {
    const result = CreateEventInputSchema.safeParse({
      name: '',
      category: 'wedding',
      startDate: '2026-12-15',
      endDate: '2026-12-17',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid date', () => {
    const result = CreateEventInputSchema.safeParse({
      name: 'Test',
      category: 'wedding',
      startDate: 'not-a-date',
      endDate: '2026-12-17',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative budget', () => {
    const result = CreateEventInputSchema.safeParse({
      name: 'Test',
      category: 'wedding',
      startDate: '2026-12-15',
      endDate: '2026-12-17',
      totalBudgetMajor: -1000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const result = CreateEventInputSchema.safeParse({
      name: 'Test',
      category: 'party_rave',
      startDate: '2026-12-15',
      endDate: '2026-12-17',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative guest count', () => {
    const result = CreateEventInputSchema.safeParse({
      name: 'Test',
      category: 'birthday',
      startDate: '2026-12-15',
      endDate: '2026-12-17',
      expectedGuests: -5,
    });
    expect(result.success).toBe(false);
  });
});

// ─── Journey 3: Add and edit a budget item ──────────────

describe('Journey 3: Add and edit a budget item', () => {
  it('adds a budget item and verifies totals', () => {
    const event = makeEvent();
    const bi = makeBudgetItem({ estimatedAmountMinor: 5000000 }); // ₹50,000
    const updated = { ...event, budgetItems: [bi] };

    const total = updated.budgetItems.reduce((s, i) => s + i.estimatedAmountMinor, 0);
    expect(total).toBe(5000000);
    expect(moneyFormat(moneyFromMinor(total, 'INR'))).toContain('50,000');
  });

  it('edits a budget item amount', () => {
    const bi = makeBudgetItem({ estimatedAmountMinor: 5000000 });
    const edited: BudgetItem = { ...bi, estimatedAmountMinor: 7500000 };
    expect(edited.estimatedAmountMinor).toBe(7500000);
    expect(edited.id).toBe(bi.id);
  });

  it('validates budget items through EventDataSchema', () => {
    const event = makeEvent({
      budgetItems: [makeBudgetItem()],
    });
    const result = EventDataSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('uses exact decimal string conversion for financial input', () => {
    const m = moneyFromDecimalString('50000.50', 'INR');
    expect(m.amountMinor).toBe(5000050);
    expect(moneyFormat(m)).toContain('50,000.50');
  });
});

// ─── Journey 4: Create and update a task ────────────────

describe('Journey 4: Create and update a task', () => {
  it('creates a valid task', () => {
    const task = makeTask();
    expect(task.status).toBe('pending');
    expect(task.priority).toBe('high');
  });

  it('updates task status to in_progress', () => {
    const task = makeTask();
    const updated: Task = { ...task, status: 'in_progress' };
    expect(updated.status).toBe('in_progress');
  });

  it('marks task as completed with completedAt timestamp', () => {
    const task = makeTask();
    const now = new Date().toISOString();
    const completed: Task = { ...task, status: 'completed', completedAt: now };
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBe(now);
  });

  it('detects task dependency cycles', () => {
    const tasks: Task[] = [
      makeTask({ id: 'a', title: 'A', dependsOn: ['b'] }),
      makeTask({ id: 'b', title: 'B', dependsOn: ['a'] }),
    ];
    const graph = buildDependencyGraph(tasks);
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('topological sort respects dependencies', () => {
    const tasks: Task[] = [
      makeTask({ id: 'design', title: 'Design', dependsOn: [] }),
      makeTask({ id: 'build', title: 'Build', dependsOn: ['design'] }),
      makeTask({ id: 'test', title: 'Test', dependsOn: ['build'] }),
    ];
    const graph = buildDependencyGraph(tasks);
    const sorted = topologicalSort(graph);
    expect(sorted).not.toBeNull();
    if (sorted) {
      const designIdx = sorted.indexOf('design');
      const buildIdx = sorted.indexOf('build');
      const testIdx = sorted.indexOf('test');
      expect(designIdx).toBeLessThan(buildIdx);
      expect(buildIdx).toBeLessThan(testIdx);
    }
  });

  it('validates scheduling conflicts', () => {
    const tasks: Task[] = [
      makeTask({ id: 'dep', title: 'Dependency', dueDate: '2026-12-20' }),
      makeTask({ id: 'main', title: 'Main Task', dueDate: '2026-12-10', dependsOn: ['dep'] }),
    ];
    const results = validateDependencies(tasks);
    const conflicts = results.filter((r) => r.code === 'DUE_BEFORE_DEPENDENCY');
    expect(conflicts.length).toBeGreaterThan(0);
  });
});

// ─── Journey 5: Apply a valid AI recommendation ────────

describe('Journey 5: Apply a valid AI recommendation', () => {
  it('transforms AI budget suggestions into valid budget items', () => {
    // Simulate AI-generated budget recommendation
    const aiBudgetSuggestion = {
      name: 'Stage Setup',
      category: 'equipment',
      estimatedAmountMinor: 3000000,
    };

    const budgetItem: BudgetItem = {
      id: `ai-bi-${Date.now()}`,
      name: aiBudgetSuggestion.name,
      category: aiBudgetSuggestion.category as BudgetItem['category'],
      estimatedAmountMinor: aiBudgetSuggestion.estimatedAmountMinor,
      actualAmountMinor: 0,
      isPaid: false,
      notes: 'AI-recommended',
    };

    const event = makeEvent({ budgetItems: [budgetItem] });
    const result = EventDataSchema.safeParse(event);
    expect(result.success).toBe(true);
    expect(event.budgetItems[0].name).toBe('Stage Setup');
    expect(event.budgetItems[0].estimatedAmountMinor).toBe(3000000);
  });

  it('rejects AI recommendation with invalid category', () => {
    const event = makeEvent({
      budgetItems: [{
        id: 'ai-bad',
        name: 'Invalid Item',
        category: 'weapons' as any, // Invalid
        estimatedAmountMinor: 1000,
        actualAmountMinor: 0,
        isPaid: false,
        notes: '',
      }],
    });
    const result = EventDataSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

// ─── Journey 6: Create a simulation ─────────────────────

describe('Journey 6: Create a simulation', () => {
  it('creates a scenario with an independent snapshot', () => {
    const event = makeEvent({
      budgetItems: [makeBudgetItem()],
      tasks: [makeTask()],
    });

    const scenario = createScenario(event, 'Test Scenario');

    expect(scenario.name).toBe('Test Scenario');
    expect(scenario.sourceEventId).toBe(event.id);
    expect(scenario.snapshotData.expectedGuests).toBe(event.expectedGuests);
    expect(scenario.modifications).toEqual({});

    // Verify it's a deep copy — mutating snapshot doesn't affect original
    scenario.snapshotData.expectedGuests = 9999;
    expect(event.expectedGuests).toBe(500);
  });

  it('applies guest count modification', () => {
    const event = makeEvent();
    const scenario = createScenario(event, 'More Guests');
    const modified = applyGuestCountModification(scenario, 800);

    expect(modified.snapshotData.expectedGuests).toBe(800);
    expect(modified.modifications).toHaveProperty('event.expectedGuests');

    // Original scenario not mutated
    expect(scenario.snapshotData.expectedGuests).toBe(500);
  });

  it('applies budget item modification', () => {
    const event = makeEvent({
      budgetItems: [makeBudgetItem({ id: 'bi-1', estimatedAmountMinor: 5000000 })],
    });
    const scenario = createScenario(event, 'Budget Change');
    const modified = applyBudgetModification(scenario, 'bi-1', 8000000);

    expect(modified.snapshotData.budgetItems[0].estimatedAmountMinor).toBe(8000000);
    // Original scenario unchanged
    expect(scenario.snapshotData.budgetItems[0].estimatedAmountMinor).toBe(5000000);
  });

  it('throws on modifying non-existent budget item', () => {
    const event = makeEvent({ budgetItems: [] });
    const scenario = createScenario(event, 'Bad Mod');
    expect(() => applyBudgetModification(scenario, 'fake-id', 1000)).toThrow();
  });

  it('compares scenario to original correctly', () => {
    const event = makeEvent({
      budgetItems: [makeBudgetItem({ estimatedAmountMinor: 5000000 })],
    });
    const scenario = createScenario(event, 'Compare');
    const modified = applyGuestCountModification(
      applyBudgetModification(scenario, 'bi-1', 8000000),
      700
    );
    const comparison = compareScenarioToOriginal(event, modified);

    expect(comparison.guestDifference).toBe(200); // 700 - 500
    expect(comparison.budgetDifferenceMinor).toBe(3000000); // 8M - 5M
  });
});

// ─── Journey 7: Discard simulation without changing original ─

describe('Journey 7: Discard simulation without changing original', () => {
  it('original event remains unchanged after scenario operations', () => {
    const event = makeEvent({
      expectedGuests: 500,
      totalBudgetMinor: 20000000,
      budgetItems: [makeBudgetItem({ estimatedAmountMinor: 5000000 })],
    });

    // Deep clone to preserve original
    const originalCopy = deepCloneEventData(event);

    // Create and modify scenario
    let scenario = createScenario(event, 'Discardable');
    scenario = applyGuestCountModification(scenario, 1000);
    scenario = applyBudgetModification(scenario, 'bi-1', 10000000);

    // "Discard" — just stop using the scenario
    // Verify original is untouched
    expect(event.expectedGuests).toBe(originalCopy.expectedGuests);
    expect(event.totalBudgetMinor).toBe(originalCopy.totalBudgetMinor);
    expect(event.budgetItems[0].estimatedAmountMinor).toBe(originalCopy.budgetItems[0].estimatedAmountMinor);

    // Scenario has modifications but original doesn't
    expect(scenario.snapshotData.expectedGuests).toBe(1000);
    expect(event.expectedGuests).toBe(500);
  });
});

// ─── Journey 8: Promote a simulation successfully ───────

describe('Journey 8: Promote a simulation successfully', () => {
  it('promoteScenario returns new EventData with scenario values', () => {
    const event = makeEvent({
      budgetItems: [makeBudgetItem({ estimatedAmountMinor: 5000000 })],
    });
    let scenario = createScenario(event, 'Promote Me');
    scenario = applyGuestCountModification(scenario, 750);
    scenario = applyBudgetModification(scenario, 'bi-1', 7000000);

    const promoted = promoteScenario(scenario);

    expect(promoted.id).toBe(event.id); // Preserves original ID
    expect(promoted.expectedGuests).toBe(750);
    expect(promoted.budgetItems[0].estimatedAmountMinor).toBe(7000000);

    // Original event still unchanged
    expect(event.expectedGuests).toBe(500);
    expect(event.budgetItems[0].estimatedAmountMinor).toBe(5000000);
  });

  it('promoted data passes schema validation', () => {
    const event = makeEvent({
      budgetItems: [makeBudgetItem()],
    });
    const scenario = createScenario(event, 'Valid Promote');
    const promoted = promoteScenario(scenario);
    const result = EventDataSchema.safeParse(promoted);
    expect(result.success).toBe(true);
  });
});

// ─── Journey 9: Export, import, and recover saved data ──

describe('Journey 9: Export, import, and recover saved data', () => {
  it('round-trips events through export/import', () => {
    const events: EventData[] = [
      makeEvent({ id: 'evt-1', name: 'Event One', budgetItems: [makeBudgetItem()] }),
      makeEvent({ id: 'evt-2', name: 'Event Two', expectedGuests: 1000 }),
    ];

    const exported = exportEventsToJSON(events);
    const imported = importEventsFromJSON(exported);

    expect(imported.success).toBe(true);
    if (imported.success) {
      expect(imported.events).toHaveLength(2);
      expect(imported.events[0].name).toBe('Event One');
      expect(imported.events[1].expectedGuests).toBe(1000);
      expect(imported.events[0].budgetItems).toHaveLength(1);
    }
  });

  it('rejects invalid JSON on import', () => {
    const result = importEventsFromJSON('not json {{{');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid JSON');
    }
  });

  it('rejects import with missing events field', () => {
    const result = importEventsFromJSON(JSON.stringify({ data: [] }));
    expect(result.success).toBe(false);
  });

  it('skips invalid events but imports valid ones', () => {
    const validEvent = makeEvent({ id: 'good', name: 'Good Event' });
    const exportJson = JSON.stringify({
      version: 1,
      events: [
        validEvent,
        { id: 'bad', name: '' }, // Invalid: empty name fails min(1) check
      ],
    });

    const result = importEventsFromJSON(exportJson);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.events).toHaveLength(1);
      expect(result.events[0].id).toBe('good');
    }
  });

  it('handles completely corrupt data gracefully', () => {
    const result = importEventsFromJSON(JSON.stringify({
      events: [null, undefined, 42, 'string'],
    }));
    // All events invalid — should fail
    expect(result.success).toBe(false);
  });
});

// ─── Journey 8: Date Validation ─────────────────────────

describe('Journey 8 — Past Date Validation', () => {
  function todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function futureStr(daysAhead: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const baseInput = {
    name: 'Test Event',
    description: '',
    category: 'conference' as const,
    location: '',
    expectedGuests: 50,
    currency: 'INR' as const,
    totalBudgetMajor: 10000,
  };

  it('rejects a start date in the past', () => {
    const result = CreateEventInputSchema.safeParse({
      ...baseInput,
      startDate: '2002-12-05',
      endDate: '2002-12-06',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const startError = result.error.issues.find((i) => i.path.includes('startDate'));
      expect(startError).toBeDefined();
      expect(startError!.message).toMatch(/cannot be earlier than today/i);
    }
  });

  it('accepts today as start date', () => {
    const today = todayStr();
    const result = CreateEventInputSchema.safeParse({
      ...baseInput,
      startDate: today,
      endDate: today,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a future start date', () => {
    const result = CreateEventInputSchema.safeParse({
      ...baseInput,
      startDate: futureStr(30),
      endDate: futureStr(31),
    });
    expect(result.success).toBe(true);
  });

  it('rejects end date before start date', () => {
    const result = CreateEventInputSchema.safeParse({
      ...baseInput,
      startDate: futureStr(10),
      endDate: futureStr(5),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const endError = result.error.issues.find((i) => i.path.includes('endDate'));
      expect(endError).toBeDefined();
      expect(endError!.message).toMatch(/on or after start date/i);
    }
  });

  it('accepts same start and end date', () => {
    const date = futureStr(7);
    const result = CreateEventInputSchema.safeParse({
      ...baseInput,
      startDate: date,
      endDate: date,
    });
    expect(result.success).toBe(true);
  });

  it('does NOT block past dates in EventDataSchema (historical data)', () => {
    const result = EventDataSchema.safeParse({
      id: 'hist-1',
      name: 'Historical Event',
      description: '',
      category: 'conference',
      status: 'completed',
      startDate: '2020-01-15',
      endDate: '2020-01-16',
      location: '',
      expectedGuests: 100,
      currency: 'INR',
      totalBudgetMinor: 500000,
      budgetItems: [],
      tasks: [],
      vendors: [],
      teamMembers: [],
      risks: [],
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });
});

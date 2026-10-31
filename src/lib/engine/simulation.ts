/**
 * Simulation Engine.
 *
 * Provides safe, immutable snapshot-based simulation.
 * Original event data is NEVER modified during simulation.
 * Each scenario operates on an independent deep copy.
 */

import type { EventData, SimulationScenario } from '../types/domain';

/**
 * Create a deep copy of event data for simulation.
 * Uses JSON serialization round-trip. This is safe for our domain types
 * (no Date objects, functions, undefined, or circular references).
 * Does NOT use structuredClone to avoid Node.js version requirements.
 */
export function deepCloneEventData(event: EventData): EventData {
  return JSON.parse(JSON.stringify(event)) as EventData;
}

/**
 * Create a new simulation scenario from an event.
 * The scenario contains an independent snapshot of the event data.
 */
export function createScenario(
  event: EventData,
  name: string,
  description: string = ''
): SimulationScenario {
  return {
    id: generateId(),
    sourceEventId: event.id,
    name,
    description,
    snapshotData: deepCloneEventData(event),
    modifications: {},
    createdAt: new Date().toISOString(),
  };
}

/**
 * Apply a budget modification to a scenario.
 * Returns a NEW scenario with the modification applied — never mutates in place.
 */
export function applyBudgetModification(
  scenario: SimulationScenario,
  budgetItemId: string,
  newEstimatedMinor: number
): SimulationScenario {
  const updatedData = deepCloneEventData(scenario.snapshotData);
  const item = updatedData.budgetItems.find((b) => b.id === budgetItemId);

  if (!item) {
    throw new Error(`Budget item "${budgetItemId}" not found in scenario`);
  }

  const oldValue = item.estimatedAmountMinor;
  item.estimatedAmountMinor = newEstimatedMinor;

  return {
    ...scenario,
    snapshotData: updatedData,
    modifications: {
      ...scenario.modifications,
      [`budget.${budgetItemId}.estimated`]: {
        from: oldValue,
        to: newEstimatedMinor,
      },
    },
  };
}

/**
 * Apply a guest count modification to a scenario.
 */
export function applyGuestCountModification(
  scenario: SimulationScenario,
  newGuestCount: number
): SimulationScenario {
  const updatedData = deepCloneEventData(scenario.snapshotData);
  const oldValue = updatedData.expectedGuests;
  updatedData.expectedGuests = newGuestCount;

  return {
    ...scenario,
    snapshotData: updatedData,
    modifications: {
      ...scenario.modifications,
      ['event.expectedGuests']: {
        from: oldValue,
        to: newGuestCount,
      },
    },
  };
}

/**
 * Compare a scenario snapshot to the original event.
 * Returns a summary of differences.
 */
export function compareScenarioToOriginal(
  original: EventData,
  scenario: SimulationScenario
): ScenarioComparison {
  const snap = scenario.snapshotData;

  const originalBudgetTotal = original.budgetItems.reduce(
    (sum, item) => sum + item.estimatedAmountMinor, 0
  );
  const scenarioBudgetTotal = snap.budgetItems.reduce(
    (sum, item) => sum + item.estimatedAmountMinor, 0
  );

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    budgetDifferenceMinor: scenarioBudgetTotal - originalBudgetTotal,
    guestDifference: snap.expectedGuests - original.expectedGuests,
    taskCountDifference: snap.tasks.length - original.tasks.length,
    modifications: scenario.modifications,
  };
}

export interface ScenarioComparison {
  readonly scenarioId: string;
  readonly scenarioName: string;
  readonly budgetDifferenceMinor: number;
  readonly guestDifference: number;
  readonly taskCountDifference: number;
  readonly modifications: Record<string, unknown>;
}

/**
 * Promote a scenario to replace the original event.
 * Returns a new EventData derived from the scenario snapshot.
 * The caller is responsible for confirming this action with the user.
 *
 * IMPORTANT: This function only returns the new data.
 * It does NOT persist or overwrite anything.
 */
export function promoteScenario(scenario: SimulationScenario): EventData {
  const promoted = deepCloneEventData(scenario.snapshotData);
  // Preserve the original event ID
  return {
    ...promoted,
    id: scenario.sourceEventId,
    updatedAt: new Date().toISOString(),
  };
}

/** Simple ID generator */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

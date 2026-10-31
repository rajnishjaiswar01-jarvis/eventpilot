/**
 * Local Data Persistence Layer.
 *
 * - Schema versioning for safe data migration
 * - Malformed data recovery (falls back to defaults)
 * - Hydration-safe access (avoids Next.js SSR/client mismatches)
 * - Export/import with validation
 */

import { EventDataSchema } from '../schemas/event.schema';
import type { EventData } from '../types/domain';

/** Current persistence schema version. Increment when data shape changes. */
export const PERSISTENCE_SCHEMA_VERSION = 1;

const STORAGE_PREFIX = 'eventpilot';

interface PersistedStore {
  version: number;
  events: EventData[];
  lastUpdated: string;
}

/** Check if running in browser (not SSR). */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Load events from localStorage with schema validation.
 * Returns empty array if data is missing, malformed, or outdated.
 * Never throws.
 */
export function loadEvents(): EventData[] {
  if (!isBrowser()) return [];

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:events`);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!isPersistedStore(parsed)) {
      console.warn('[EventPilot] Persisted data has invalid structure, returning empty');
      return [];
    }

    if (parsed.version !== PERSISTENCE_SCHEMA_VERSION) {
      console.warn(
        `[EventPilot] Persisted data version ${parsed.version} differs from current ${PERSISTENCE_SCHEMA_VERSION}. Attempting migration.`
      );
      return migrateData(parsed);
    }

    const validEvents: EventData[] = [];
    for (const event of parsed.events) {
      const result = EventDataSchema.safeParse(event);
      if (result.success) {
        validEvents.push(result.data);
      } else {
        console.warn(
          `[EventPilot] Skipping corrupted event "${(event as unknown as Record<string, unknown>)?.name ?? 'unknown'}":`,
          result.error.issues.map((i) => i.message).join(', ')
        );
      }
    }

    return validEvents;
  } catch (error) {
    console.warn('[EventPilot] Failed to load persisted data:', error);
    return [];
  }
}

/** Save events to localStorage with schema version. */
export function saveEvents(events: EventData[]): boolean {
  if (!isBrowser()) return false;

  try {
    const store: PersistedStore = {
      version: PERSISTENCE_SCHEMA_VERSION,
      events,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(`${STORAGE_PREFIX}:events`, JSON.stringify(store));
    return true;
  } catch (error) {
    console.error('[EventPilot] Failed to save data:', error);
    return false;
  }
}

/** Export all event data as validated JSON for user download. */
export function exportEventsToJSON(events: EventData[]): string {
  const exportData = {
    version: PERSISTENCE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    eventCount: events.length,
    events,
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Import events from a JSON string with full validation.
 * Returns validated events or an error message.
 */
export function importEventsFromJSON(
  jsonString: string
): { success: true; events: EventData[] } | { success: false; error: string } {
  try {
    const parsed: unknown = JSON.parse(jsonString);

    if (typeof parsed !== 'object' || parsed === null || !('events' in parsed)) {
      return { success: false, error: 'Invalid export format: missing "events" field' };
    }

    const data = parsed as { events: unknown[]; version?: number };

    if (!Array.isArray(data.events)) {
      return { success: false, error: 'Invalid export format: "events" must be an array' };
    }

    const validEvents: EventData[] = [];
    const errors: string[] = [];

    for (let i = 0; i < data.events.length; i++) {
      const result = EventDataSchema.safeParse(data.events[i]);
      if (result.success) {
        validEvents.push(result.data);
      } else {
        errors.push(
          `Event ${i + 1}: ${result.error.issues.map((issue) => issue.message).join(', ')}`
        );
      }
    }

    if (errors.length > 0 && validEvents.length === 0) {
      return { success: false, error: `All events failed validation:\n${errors.join('\n')}` };
    }

    if (errors.length > 0) {
      console.warn(`[EventPilot] Imported ${validEvents.length} events, skipped ${errors.length} invalid`);
    }

    return { success: true, events: validEvents };
  } catch {
    return { success: false, error: 'Invalid JSON format' };
  }
}

function isPersistedStore(data: unknown): data is PersistedStore {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.version === 'number' &&
    Array.isArray(obj.events) &&
    typeof obj.lastUpdated === 'string'
  );
}

function migrateData(persisted: PersistedStore): EventData[] {
  console.info(`[EventPilot] Migrating from v${persisted.version} to v${PERSISTENCE_SCHEMA_VERSION}`);

  const validEvents: EventData[] = [];
  for (const event of persisted.events) {
    const result = EventDataSchema.safeParse(event);
    if (result.success) {
      validEvents.push(result.data);
    }
  }

  saveEvents(validEvents);
  return validEvents;
}

/** Clear all EventPilot data from localStorage. */
export function clearAllData(): boolean {
  if (!isBrowser()) return false;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}:events`);
    return true;
  } catch {
    return false;
  }
}

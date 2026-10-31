/**
 * Tests for persistence layer.
 * Covers: schema versioning, malformed data, export/import validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  exportEventsToJSON,
  importEventsFromJSON,
  PERSISTENCE_SCHEMA_VERSION,
} from '@/lib/stores/persistence';
import type { EventData } from '@/lib/types/domain';

function makeValidEvent(overrides: Partial<EventData> = {}): EventData {
  return {
    id: 'evt-test-1',
    name: 'Test Event',
    description: 'A test event',
    category: 'wedding',
    status: 'draft',
    startDate: '2027-06-01T00:00:00Z',
    endDate: '2027-06-02T00:00:00Z',
    location: 'Test Venue',
    expectedGuests: 100,
    currency: 'INR',
    totalBudgetMinor: 1000000,
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

describe('Persistence Layer', () => {
  // â”€â”€â”€ Export/Import â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  describe('exportEventsToJSON', () => {
    it('creates valid JSON with version and events', () => {
      const events = [makeValidEvent()];
      const json = exportEventsToJSON(events);
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe(PERSISTENCE_SCHEMA_VERSION);
      expect(parsed.events).toHaveLength(1);
      expect(parsed.events[0].id).toBe('evt-test-1');
      expect(parsed.exportedAt).toBeDefined();
    });

    it('exports empty array', () => {
      const json = exportEventsToJSON([]);
      const parsed = JSON.parse(json);
      expect(parsed.events).toHaveLength(0);
      expect(parsed.eventCount).toBe(0);
    });
  });

  describe('importEventsFromJSON', () => {
    it('imports valid exported data', () => {
      const events = [makeValidEvent()];
      const json = exportEventsToJSON(events);
      const result = importEventsFromJSON(json);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.events).toHaveLength(1);
        expect(result.events[0].name).toBe('Test Event');
      }
    });

    it('rejects invalid JSON', () => {
      const result = importEventsFromJSON('not json at all');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid JSON');
      }
    });

    it('rejects missing events field', () => {
      const result = importEventsFromJSON('{"version": 1}');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('missing "events"');
      }
    });

    it('rejects non-array events field', () => {
      const result = importEventsFromJSON('{"events": "not an array"}');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('must be an array');
      }
    });

    it('skips invalid events and keeps valid ones', () => {
      const events = [
        makeValidEvent({ id: 'good-1' }),
        { id: 'bad-1', name: '' }, // Missing required fields
      ];
      const json = JSON.stringify({ events, version: 1 });
      const result = importEventsFromJSON(json);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.events).toHaveLength(1);
        expect(result.events[0].id).toBe('good-1');
      }
    });

    it('fails when all events are invalid', () => {
      const json = JSON.stringify({ events: [{ broken: true }] });
      const result = importEventsFromJSON(json);
      expect(result.success).toBe(false);
    });

    it('roundtrips correctly', () => {
      const original = [
        makeValidEvent({ id: 'evt-1', name: 'Event 1' }),
        makeValidEvent({ id: 'evt-2', name: 'Event 2', category: 'conference' }),
      ];
      const json = exportEventsToJSON(original);
      const result = importEventsFromJSON(json);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.events).toHaveLength(2);
        expect(result.events[0].name).toBe('Event 1');
        expect(result.events[1].category).toBe('conference');
      }
    });
  });
});

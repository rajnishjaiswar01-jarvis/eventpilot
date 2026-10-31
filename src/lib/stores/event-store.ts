/**
 * Event Store using Zustand.
 * Manages event CRUD with localStorage persistence.
 * Uses hydration-safe lazy initialization to avoid SSR mismatches.
 */

import { create } from 'zustand';
import type { EventData } from '../types/domain';
import type { CreateEventInput } from '../schemas/event.schema';
import { moneyFromMajor } from '../types/money';
import { loadEvents, saveEvents } from './persistence';

interface EventStoreState {
  events: EventData[];
  isHydrated: boolean;

  hydrate: () => void;
  addEvent: (input: CreateEventInput) => EventData;
  updateEvent: (id: string, updates: Partial<Omit<EventData, 'id' | 'createdAt'>>) => void;
  deleteEvent: (id: string) => void;
  getEvent: (id: string) => EventData | undefined;
}

function generateId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const useEventStore = create<EventStoreState>((set, get) => ({
  events: [],
  isHydrated: false,

  hydrate: () => {
    const events = loadEvents();
    set({ events, isHydrated: true });
  },

  addEvent: (input: CreateEventInput): EventData => {
    const now = new Date().toISOString();
    const budget = moneyFromMajor(input.totalBudgetMajor, input.currency);

    const newEvent: EventData = {
      id: generateId(),
      name: input.name,
      description: input.description,
      category: input.category,
      status: 'draft',
      startDate: input.startDate,
      endDate: input.endDate,
      location: input.location,
      expectedGuests: input.expectedGuests,
      currency: input.currency,
      totalBudgetMinor: budget.amountMinor,
      budgetItems: [],
      tasks: [],
      vendors: [],
      teamMembers: [],
      risks: [],
      createdAt: now,
      updatedAt: now,
    };

    set((state) => {
      const updated = [...state.events, newEvent];
      saveEvents(updated);
      return { events: updated };
    });

    return newEvent;
  },

  updateEvent: (id, updates) => {
    set((state) => {
      const updated = state.events.map((event) =>
        event.id === id
          ? { ...event, ...updates, updatedAt: new Date().toISOString() }
          : event
      );
      saveEvents(updated);
      return { events: updated };
    });
  },

  deleteEvent: (id) => {
    set((state) => {
      const updated = state.events.filter((event) => event.id !== id);
      saveEvents(updated);
      return { events: updated };
    });
  },

  getEvent: (id) => {
    return get().events.find((event) => event.id === id);
  },
}));

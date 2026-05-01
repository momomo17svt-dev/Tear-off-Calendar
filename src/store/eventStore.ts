import { create } from 'zustand';
import {
  deleteEvent as dbDeleteEvent,
  getAllEvents,
  insertEvent as dbInsertEvent,
  updateEvent as dbUpdateEvent,
} from '@/db/events';
import type { CalendarEvent, NewCalendarEvent } from '@/types/event';

interface EventState {
  events: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
  loadEvents: () => Promise<void>;
  addEvent: (event: NewCalendarEvent) => Promise<void>;
  editEvent: (id: number, patch: Partial<NewCalendarEvent>) => Promise<void>;
  removeEvent: (id: number) => Promise<void>;
  getEventsForDate: (date: string) => CalendarEvent[];
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  isLoading: false,
  error: null,

  loadEvents: async () => {
    set({ isLoading: true, error: null });
    try {
      const events = await getAllEvents();
      set({ events, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  addEvent: async (event) => {
    await dbInsertEvent(event);
    await get().loadEvents();
  },

  editEvent: async (id, patch) => {
    await dbUpdateEvent(id, patch);
    await get().loadEvents();
  },

  removeEvent: async (id) => {
    await dbDeleteEvent(id);
    set({ events: get().events.filter((e) => e.id !== id) });
  },

  getEventsForDate: (date) => {
    const monthDay = date.slice(5);
    return get().events.filter(
      (e) =>
        e.date === date || (e.is_annual === 1 && e.date.slice(5) === monthDay)
    );
  },
}));

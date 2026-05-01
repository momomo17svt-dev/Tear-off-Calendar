import * as Calendar from 'expo-calendar';
import { create } from 'zustand';
import type { NativeCalendarEvent } from '@/types/event';
import {
  createNativeEvent,
  deleteNativeEvent,
  fetchNativeEventsForRange,
  getAvailableCalendars,
  toDateString,
  updateNativeEvent,
} from '@/utils/nativeCalendar';

interface NativeCalendarState {
  eventsByDate: Record<string, NativeCalendarEvent[]>;
  availableCalendars: Calendar.Calendar[];
  isLoading: boolean;
  fetchAll: () => Promise<void>;
  refetchDate: (date: string) => Promise<void>;
  getEventsForDate: (date: string) => NativeCalendarEvent[];
  addEvent: (
    calendarId: string,
    params: { title: string; startDate: Date; endDate: Date; isAllDay: boolean; notes?: string | null }
  ) => Promise<void>;
  editEvent: (
    eventId: string,
    params: { title?: string; startDate?: Date; endDate?: Date; isAllDay?: boolean; notes?: string | null }
  ) => Promise<void>;
  removeEvent: (eventId: string, date: string) => Promise<void>;
  purgeStaleEvent: (eventId: string) => void;
  loadCalendars: () => Promise<void>;
}

function getSelectedCalendarIds(): string[] {
  try {
    const { useSettingsStore } = require('@/store/settingsStore');
    return useSettingsStore.getState().selectedCalendarIds ?? [];
  } catch {
    return [];
  }
}

export const useNativeCalendarStore = create<NativeCalendarState>((set, get) => ({
  eventsByDate: {},
  availableCalendars: [],
  isLoading: false,

  loadCalendars: async () => {
    const cals = await getAvailableCalendars();
    set({ availableCalendars: cals });
  },

  fetchAll: async () => {
    set({ isLoading: true });
    try {
      const now = new Date();
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setMonth(end.getMonth() + 12);
      end.setHours(23, 59, 59, 999);

      const selectedIds = getSelectedCalendarIds();
      const events = await fetchNativeEventsForRange(start, end, selectedIds);

      const byDate: Record<string, NativeCalendarEvent[]> = {};
      for (const ev of events) {
        const startDay = new Date(ev.startDate);
        startDay.setHours(0, 0, 0, 0);

        const endDay = new Date(ev.endDate);
        if (ev.isAllDay) {
          // iOS の終日イベントは endDate が翌日0時（排他的）なので1ms引いて包括的な最終日にする
          endDay.setTime(endDay.getTime() - 1);
        }
        endDay.setHours(0, 0, 0, 0);

        const cursor = new Date(startDay);
        while (cursor <= endDay) {
          const key = toDateString(cursor);
          if (!byDate[key]) byDate[key] = [];
          byDate[key].push(ev);
          cursor.setDate(cursor.getDate() + 1);
        }
      }
      set({ eventsByDate: byDate, isLoading: false });
    } catch (e) {
      console.error('fetchAll error:', e);
      set({ isLoading: false });
    }
  },

  refetchDate: async (date: string) => {
    const selectedIds = getSelectedCalendarIds();
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59`);
    const events = await fetchNativeEventsForRange(start, end, selectedIds);
    set((s) => ({
      eventsByDate: { ...s.eventsByDate, [date]: events },
    }));
  },

  getEventsForDate: (date: string) => {
    return get().eventsByDate[date] ?? [];
  },

  addEvent: async (calendarId, params) => {
    const id = await createNativeEvent(calendarId, params);
    if (id) {
      await get().refetchDate(toDateString(params.startDate));
    }
  },

  editEvent: async (eventId, params) => {
    await updateNativeEvent(eventId, params);
    const date = params.startDate
      ? toDateString(params.startDate)
      : toDateString(new Date());
    await get().refetchDate(date);
  },

  removeEvent: async (eventId, _date) => {
    await deleteNativeEvent(eventId);
    await get().fetchAll();
  },

  purgeStaleEvent: (eventId) => {
    set((s) => {
      const updated: Record<string, NativeCalendarEvent[]> = {};
      for (const [date, events] of Object.entries(s.eventsByDate)) {
        updated[date] = events.filter((e) => e.id !== eventId);
      }
      return { eventsByDate: updated };
    });
  },
}));

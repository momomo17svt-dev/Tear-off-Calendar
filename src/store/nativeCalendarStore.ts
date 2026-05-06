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

  /**
   * 利用可能なカレンダー（iCloud, Google等）のリストを読み込む
   * 設定画面でのカレンダー選択肢として使用されます。
   */
  loadCalendars: async () => {
    const cals = await getAvailableCalendars();
    set({ availableCalendars: cals });
  },

  /**
   * システムカレンダーからイベントをフェッチし、日付ごとのRecord形式に加工して保持する
   * 起動時やカレンダー設定変更時に呼び出されます。
   */
  fetchAll: async () => {
    set({ isLoading: true });
    try {
      const now = new Date();
      // 取得範囲の設定：前後にある程度の余裕を持たせてフェッチする
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3); // 3ヶ月前から
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(now);
      end.setMonth(end.getMonth() + 12);   // 12ヶ月後まで
      end.setHours(23, 59, 59, 999);

      // 設定ストアから現在選択されているカレンダーIDを取得
      const selectedIds = getSelectedCalendarIds();
      // 外部APIを呼び出して生のイベントリストを取得
      const events = await fetchNativeEventsForRange(start, end, selectedIds);

      // 取得したイベントを日付(YYYY-MM-DD)ごとにグルーピングする
      const byDate: Record<string, NativeCalendarEvent[]> = {};
      for (const ev of events) {
        const startDay = new Date(ev.startDate);
        startDay.setHours(0, 0, 0, 0);

        const endDay = new Date(ev.endDate);
        if (ev.isAllDay) {
          /**
           * iOSの「終日」イベントの補正：
           * iOSでは終日予定の終了時刻が「翌日の00:00:00」として返ってくる（Exclusive）。
           * そのまま比較するとカレンダー上で1日多く表示されてしまうため、
           * 1ミリ秒引くことで当日（23:59:59.999）に収まるように調整する。
           */
          endDay.setTime(endDay.getTime() - 1);
        }
        endDay.setHours(0, 0, 0, 0);

        /**
         * 複数日にまたがる予定の処理：
         * 開始日から終了日までループし、各日付のキーに対してイベントを登録する。
         * これにより「2泊3日の予定」がカレンダーの各日に正しく表示される。
         */
        const cursor = new Date(startDay);
        while (cursor <= endDay) {
          const key = toDateString(cursor);
          if (!byDate[key]) byDate[key] = [];
          byDate[key].push(ev);
          cursor.setDate(cursor.getDate() + 1);
        }
      }
      // 加工済みのマップをステートに反映
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

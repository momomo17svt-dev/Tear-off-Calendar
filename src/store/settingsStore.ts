/**
 * 設定管理用グローバルストア (Zustand)
 * アプリのテーマ、ダークモード、背景設定、カレンダー選択状態などの
 * 状態管理と、DB（SQLite）への永続化ロジックを統合して提供します。
 */
import { create } from 'zustand';
import * as FileSystem from 'expo-file-system/legacy';
import { getAllSettings, setSetting } from '@/db/settings';

import { AppTheme, CardStyle } from '@/types/settings';

interface SettingsState {
  isBgEnabled: boolean;
  bgUri: string | null;
  bgUris: string[];
  bgMode: 'fixed' | 'random';
  appTheme: AppTheme;
  isDarkMode: boolean;
  selectedCalendarIds: string[];
  defaultCalendarId: string | null;
  lastViewedDay: string | null;
  lastViewedMonth: string | null;
  cardStyle: CardStyle;
  /** 課金で広告非表示プランを購入済みか */
  isPremium: boolean;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  setBgEnabled: (enabled: boolean) => Promise<void>;
  setBgUri: (uri: string | null) => Promise<void>;
  addBgUri: (uri: string) => Promise<void>;
  removeBgUri: (uri: string) => Promise<void>;
  setBgMode: (mode: 'fixed' | 'random') => Promise<void>;
  setAppTheme: (theme: AppTheme) => Promise<void>;
  setDarkMode: (enabled: boolean) => Promise<void>;
  setSelectedCalendarIds: (ids: string[]) => Promise<void>;
  setDefaultCalendarId: (id: string | null) => Promise<void>;
  setLastViewedDay: (date: string) => Promise<void>;
  setLastViewedMonth: (date: string) => Promise<void>;
  setCardStyle: (style: CardStyle) => Promise<void>;
  /** 課金状態を更新する（StoreKit/Billing 連携時に呼ぶ） */
  setPremium: (enabled: boolean) => Promise<void>;
  /** 日付ごとの固定背景画像 (YYYY-MM-DD → URI) */
  perDayBgUris: Record<string, string>;
  /** カードの画像エリアタップで選んだ画像をその日付に紐付ける */
  setDayBgUri: (date: string, uri: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // --- 初期状態 (Default State) ---
  isBgEnabled: true,          // 背景表示の有効フラグ
  bgUri: null,                // 現在設定されている背景画像のURI
  bgUris: [],                 // ユーザーが追加した背景画像URIのリスト
  bgMode: 'fixed',            // 背景の切り替えモード ('fixed':固定, 'random':ランダム)
  appTheme: 'washi',          // アプリの視覚テーマ
  isDarkMode: false,          // ダークモードの有効フラグ
  selectedCalendarIds: [],    // 表示対象として選択されたシステムカレンダーのID
  defaultCalendarId: null,    // 予定追加時のデフォルトカレンダーID
  lastViewedDay: null,
  lastViewedMonth: null,
  cardStyle: 'tear-off',      // デフォルトのカードデザイン
  isPremium: false,           // 課金未購入をデフォルト
  perDayBgUris: {},           // 日付ごとの固定背景画像
  isLoading: false,           // 設定読み込み中フラグ

  /**
   * データベースから設定を読み込み、ストアの状態を更新する
   */
  loadSettings: async () => {
    set({ isLoading: true });
    const s = await getAllSettings(); // DB層(SQLite)から全設定を取得
    
    // ストアの状態をDBの値で同期
    set({
      isBgEnabled: s.isBgEnabled,
      bgUri: s.bgUri,
      bgUris: s.bgUris,
      bgMode: s.bgMode,
      appTheme: s.appTheme,
      isDarkMode: s.isDarkMode,
      selectedCalendarIds: s.selectedCalendarIds,
      defaultCalendarId: s.defaultCalendarId,
      lastViewedDay: s.lastViewedDay,
      lastViewedMonth: s.lastViewedMonth,
      cardStyle: s.cardStyle,
      isPremium: s.isPremium,
      perDayBgUris: s.perDayBgUris,
      isLoading: false,
    });
  },

  setBgEnabled: async (enabled) => {
    await setSetting('is_bg_enabled', enabled ? '1' : '0');
    set({ isBgEnabled: enabled });
  },

  setBgUri: async (uri) => {
    await setSetting('bg_uri', uri ?? '');
    set({ bgUri: uri });
  },

  addBgUri: async (uri) => {
    const { bgUris, bgUri } = get();
    if (bgUris.includes(uri)) return;
    const newUris = [...bgUris, uri];
    await setSetting('bg_uris', JSON.stringify(newUris));
    
    // Automatically set as fixed bgUri if it's the first one
    if (!bgUri) {
      await setSetting('bg_uri', uri);
      set({ bgUris: newUris, bgUri: uri });
    } else {
      set({ bgUris: newUris });
    }
  },

  removeBgUri: async (uri) => {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (e) {
      console.warn('Failed to delete image file', e);
    }

    const { bgUris, bgUri } = get();
    const newUris = bgUris.filter(u => u !== uri);
    await setSetting('bg_uris', JSON.stringify(newUris));
    
    if (bgUri === uri) {
      const nextUri = newUris.length > 0 ? newUris[0] : null;
      await setSetting('bg_uri', nextUri ?? '');
      set({ bgUris: newUris, bgUri: nextUri });
    } else {
      set({ bgUris: newUris });
    }
  },

  setBgMode: async (mode) => {
    await setSetting('bg_mode', mode);
    set({ bgMode: mode });
  },

  setAppTheme: async (theme) => {
    await setSetting('app_theme', theme);
    set({ appTheme: theme });
  },

  setDarkMode: async (enabled) => {
    await setSetting('is_dark_mode', enabled ? '1' : '0');
    set({ isDarkMode: enabled });
  },

  setSelectedCalendarIds: async (ids) => {
    await setSetting('selected_calendar_ids', JSON.stringify(ids));
    set({ selectedCalendarIds: ids });
  },

  setDefaultCalendarId: async (id) => {
    await setSetting('default_calendar_id', id ?? '');
    set({ defaultCalendarId: id });
  },

  setLastViewedDay: async (date) => {
    await setSetting('last_viewed_day', date);
    set({ lastViewedDay: date });
  },

  setLastViewedMonth: async (date) => {
    await setSetting('last_viewed_month', date);
    set({ lastViewedMonth: date });
  },

  setCardStyle: async (style) => {
    await setSetting('card_style', style);
    set({ cardStyle: style });
  },

  setPremium: async (enabled) => {
    await setSetting('is_premium', enabled ? '1' : '0');
    set({ isPremium: enabled });
  },

  setDayBgUri: async (date, uri) => {
    const { perDayBgUris } = get();
    const next = { ...perDayBgUris, [date]: uri };
    await setSetting('per_day_bg_uris', JSON.stringify(next));
    set({ perDayBgUris: next, isBgEnabled: true });
  },
}));

/**
 * ヘルスケア連携用グローバルストア (Zustand)
 *
 * 役割:
 * - HealthKit の認証状態管理
 * - 日付ごとのヘルスデータキャッシュ（セッション中再取得不要）
 * - 表示項目 ON/OFF などのユーザー設定（SQLite 永続化）
 */
import { Platform } from 'react-native';
import { create } from 'zustand';

import { getSetting, setSetting } from '@/db/settings';
import { fetchDayHealth, initHealthKit, type DayHealthData } from '@/utils/healthKit';

export interface HealthDisplaySettings {
  healthEnabled: boolean;
  showSteps: boolean;
  showSleep: boolean;
  showHeartRate: boolean;
  showActiveEnergy: boolean;
  showWeight: boolean;
}

interface HealthState extends HealthDisplaySettings {
  authorized: boolean;
  authError: string | null;
  cache: Record<string, DayHealthData>;
  loadingDates: Record<string, boolean>;

  loadSettings: () => Promise<void>;
  setHealthEnabled: (v: boolean) => Promise<void>;
  setShowItem: (
    key: Exclude<keyof HealthDisplaySettings, 'healthEnabled'>,
    v: boolean
  ) => Promise<void>;
  authorize: () => Promise<void>;
  fetchForDate: (dateStr: string) => Promise<void>;
  getForDate: (dateStr: string) => DayHealthData | null;
}

const ITEM_DB_KEY: Record<
  Exclude<keyof HealthDisplaySettings, 'healthEnabled'>,
  string
> = {
  showSteps:        'health_show_steps',
  showSleep:        'health_show_sleep',
  showHeartRate:    'health_show_heart_rate',
  showActiveEnergy: 'health_show_active_energy',
  showWeight:       'health_show_weight',
};

export const useHealthStore = create<HealthState>((set, get) => ({
  // ── 表示設定（デフォルト全 ON） ──
  healthEnabled:    false,
  showSteps:        true,
  showSleep:        true,
  showHeartRate:    true,
  showActiveEnergy: true,
  showWeight:       true,

  // ── 認証 ──
  authorized: false,
  authError:  null,

  // ── データキャッシュ ──
  cache:        {},
  loadingDates: {},

  /**
   * SQLite から健康設定を読み込んでストアに反映する。
   * _layout.tsx の初期化シーケンスで呼ぶ。
   */
  loadSettings: async () => {
    const [enabled, steps, sleep, hr, ae, wt] = await Promise.all([
      getSetting('health_enabled'),
      getSetting('health_show_steps'),
      getSetting('health_show_sleep'),
      getSetting('health_show_heart_rate'),
      getSetting('health_show_active_energy'),
      getSetting('health_show_weight'),
    ]);
    set({
      healthEnabled:    enabled === '1',
      showSteps:        steps    !== '0',
      showSleep:        sleep    !== '0',
      showHeartRate:    hr       !== '0',
      showActiveEnergy: ae       !== '0',
      showWeight:       wt       !== '0',
    });
  },

  /** ヘルスケア連携全体の ON/OFF */
  setHealthEnabled: async (v) => {
    await setSetting('health_enabled', v ? '1' : '0');
    set({ healthEnabled: v });
    if (v && !get().authorized) {
      await get().authorize();
    }
  },

  /** 各表示項目の ON/OFF */
  setShowItem: async (key, v) => {
    await setSetting(ITEM_DB_KEY[key] as any, v ? '1' : '0');
    set({ [key]: v } as Pick<HealthState, typeof key>);
  },

  /**
   * HealthKit 権限リクエスト。
   * iOS のみ実行し、Android では即 authorized=true にする（ガード用）。
   */
  authorize: async () => {
    if (Platform.OS !== 'ios') {
      set({ authorized: true });
      return;
    }
    try {
      await initHealthKit();
      set({ authorized: true, authError: null });
    } catch (e) {
      set({ authError: String(e) });
    }
  },

  /**
   * 指定日のヘルスデータを取得してキャッシュに保存する。
   * 未認証・ロード中・キャッシュ済みの場合はスキップ。
   */
  fetchForDate: async (dateStr) => {
    const { authorized, cache, loadingDates } = get();
    if (!authorized || loadingDates[dateStr] || cache[dateStr]) return;

    set((s) => ({ loadingDates: { ...s.loadingDates, [dateStr]: true } }));
    try {
      const data = await fetchDayHealth(dateStr);
      set((s) => ({ cache: { ...s.cache, [dateStr]: data } }));
    } finally {
      set((s) => ({ loadingDates: { ...s.loadingDates, [dateStr]: false } }));
    }
  },

  getForDate: (dateStr) => get().cache[dateStr] ?? null,
}));

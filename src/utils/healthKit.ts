/**
 * HealthKit データ取得ユーティリティ (iOS 専用)
 *
 * react-native-health ラッパー。
 * - initHealthKit()  : 権限リクエスト & HealthKit 初期化
 * - fetchDayHealth() : 指定日の全ヘルスデータを並列取得してまとめて返す
 */
import { Platform } from 'react-native';

// iOS 専用モジュール。Android や Expo Go では一切インポートしない。
// Expo Go にはネイティブモジュールが同梱されていないため require が失敗する場合がある。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AppleHealthKit: any = null;
if (Platform.OS === 'ios') {
  try {
    const mod = require('react-native-health');
    // ESM default export と CommonJS export の両方に対応
    AppleHealthKit = mod.default ?? mod;
  } catch {
    // Expo Go など、react-native-health が含まれないビルドでは無視する
  }
}

export interface DayHealthData {
  steps: number | null;
  activeEnergy: number | null; // kcal
  sleepMinutes: number | null; // 前夜の合計就寝時間（分）
  heartRateAvg: number | null; // bpm（その日の平均）
  weight: number | null;       // kg（その日の最新記録）
}

// 権限リクエスト対象の HealthKit データ型
const PERMISSIONS = {
  permissions: {
    read: [] as string[],
    write: [] as string[],
  },
};

let _initialized = false;

/**
 * HealthKit の初期化（権限ダイアログ表示）。
 * 再呼び出しは即 resolve する（OS 側でキャッシュ済み）。
 */
export function initHealthKit(): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
  if (!AppleHealthKit) {
    return Promise.reject(
      new Error(
        'HealthKit ネイティブモジュールが見つかりません。\n' +
        'Expo Go では使用できません。EAS Build の Dev Client が必要です。'
      )
    );
  }
  if (_initialized) return Promise.resolve();

  const perms = {
    permissions: {
      read: [
        AppleHealthKit.Constants.Permissions.StepCount,
        AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
        AppleHealthKit.Constants.Permissions.SleepAnalysis,
        AppleHealthKit.Constants.Permissions.HeartRate,
        AppleHealthKit.Constants.Permissions.BodyMass,
      ],
      write: [] as string[],
    },
  };

  return new Promise((resolve, reject) => {
    AppleHealthKit.initHealthKit(perms, (error: string) => {
      if (error) {
        reject(new Error(error));
      } else {
        _initialized = true;
        resolve();
      }
    });
  });
}

/** HealthKit が利用可能な状態かどうか */
export function isHealthKitReady(): boolean {
  return Platform.OS === 'ios' && _initialized;
}

// ── 日付ユーティリティ ───────────────────────────────────────────

function dayBounds(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end   = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { start, end };
}

// ── 各データ取得関数 ─────────────────────────────────────────────

export function getSteps(dateStr: string): Promise<number | null> {
  return new Promise((resolve) => {
    if (!_initialized) { resolve(null); return; }
    const { start } = dayBounds(dateStr);
    AppleHealthKit.getStepCount(
      { date: start.toISOString() },
      (err: string, result: { value: number }) => {
        if (err || result == null) { resolve(null); return; }
        resolve(Math.round(result.value ?? 0));
      }
    );
  });
}

export function getActiveEnergy(dateStr: string): Promise<number | null> {
  return new Promise((resolve) => {
    if (!_initialized) { resolve(null); return; }
    const { start, end } = dayBounds(dateStr);
    AppleHealthKit.getActiveEnergyBurned(
      { startDate: start.toISOString(), endDate: end.toISOString() },
      (err: string, results: Array<{ value: number }>) => {
        if (err || !results?.length) { resolve(null); return; }
        const total = results.reduce((s, r) => s + (r.value ?? 0), 0);
        resolve(Math.round(total));
      }
    );
  });
}

export function getSleepMinutes(dateStr: string): Promise<number | null> {
  // 前日 18:00 〜 当日 12:00 を「その夜の睡眠範囲」とする
  return new Promise((resolve) => {
    if (!_initialized) { resolve(null); return; }
    const [y, m, d] = dateStr.split('-').map(Number);
    const prevEvening = new Date(y, m - 1, d - 1, 18, 0, 0, 0);
    const noon        = new Date(y, m - 1, d, 12, 0, 0, 0);

    AppleHealthKit.getSleepSamples(
      { startDate: prevEvening.toISOString(), endDate: noon.toISOString() },
      (err: string, results: Array<{ value: string; startDate: string; endDate: string }>) => {
        if (err || !results?.length) { resolve(null); return; }

        // ASLEEP 系のサンプルのみ合計（INBED / AWAKE は含めない）
        const ASLEEP_VALUES = new Set(['ASLEEP', 'ASLEEP_CORE', 'ASLEEP_DEEP', 'ASLEEP_REM']);
        let totalMs = 0;
        for (const r of results) {
          if (ASLEEP_VALUES.has(r.value)) {
            totalMs += new Date(r.endDate).getTime() - new Date(r.startDate).getTime();
          }
        }
        resolve(totalMs > 0 ? Math.round(totalMs / 60000) : null);
      }
    );
  });
}

export function getHeartRateAvg(dateStr: string): Promise<number | null> {
  return new Promise((resolve) => {
    if (!_initialized) { resolve(null); return; }
    const { start, end } = dayBounds(dateStr);
    AppleHealthKit.getHeartRateSamples(
      { startDate: start.toISOString(), endDate: end.toISOString() },
      (err: string, results: Array<{ value: number }>) => {
        if (err || !results?.length) { resolve(null); return; }
        const avg = results.reduce((s, r) => s + (r.value ?? 0), 0) / results.length;
        resolve(Math.round(avg));
      }
    );
  });
}

export function getWeight(dateStr: string): Promise<number | null> {
  return new Promise((resolve) => {
    if (!_initialized) { resolve(null); return; }
    const { start, end } = dayBounds(dateStr);
    AppleHealthKit.getBodyMassSamples(
      { startDate: start.toISOString(), endDate: end.toISOString(), unit: 'kilogram' },
      (err: string, results: Array<{ value: number }>) => {
        if (err || !results?.length) { resolve(null); return; }
        const last = results[results.length - 1];
        const kg = last?.value;
        resolve(kg != null ? Math.round(kg * 10) / 10 : null);
      }
    );
  });
}

/**
 * 指定日の全ヘルスデータを並列取得してまとめて返す。
 */
export async function fetchDayHealth(dateStr: string): Promise<DayHealthData> {
  const [steps, activeEnergy, sleepMinutes, heartRateAvg, weight] = await Promise.all([
    getSteps(dateStr),
    getActiveEnergy(dateStr),
    getSleepMinutes(dateStr),
    getHeartRateAvg(dateStr),
    getWeight(dateStr),
  ]);
  return { steps, activeEnergy, sleepMinutes, heartRateAvg, weight };
}

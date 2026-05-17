/**
 * 設定データアクセス層 (Data Access Layer)
 * SQLiteの settings テーブルに対するCRUD操作を提供します。
 */
import { getDb } from './database';
import type { AppSettings, CardStyle, SettingKey, SettingRow } from '@/types/settings';

/**
 * 単一の設定値を取得する
 */
export async function getSetting(key: SettingKey): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SettingRow>(
    `SELECT key, value FROM settings WHERE key = ?`,
    key
  );
  return row?.value ?? null;
}

/**
 * 設定値を保存または更新する（Upsert処理）
 */
export async function setSetting(
  key: SettingKey,
  value: string | null
): Promise<void> {
  const db = await getDb();
  // すでにキーが存在する場合は値を更新し、なければ新規挿入する
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value
  );
}

/**
 * 全ての設定を取得し、アプリケーション用の型に変換して返却する
 */
export async function getAllSettings(): Promise<AppSettings> {
  const db = await getDb();
  // 全レコードを取得してMapに変換
  const rows = await db.getAllAsync<SettingRow>(
    `SELECT key, value FROM settings`
  );
  const map = new Map<string, string | null>();
  for (const r of rows) map.set(r.key, r.value);

  // JSON文字列として保存されている配列データをパース
  let bgUris: string[] = [];
  try {
    const rawUris = map.get('bg_uris');
    if (rawUris) bgUris = JSON.parse(rawUris);
  } catch (e) {
    console.error(e);
  }

  let selectedCalendarIds: string[] = [];
  try {
    const raw = map.get('selected_calendar_ids');
    if (raw) selectedCalendarIds = JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }

  // DBの文字列表現(SQLite)からアプリの型(TypeScript)へ変換して返却
  return {
    isBgEnabled: map.get('is_bg_enabled') === '1',
    bgUri: (map.get('bg_uri') ?? '') || null,
    bgUris,
    bgMode: (map.get('bg_mode') as 'fixed' | 'random') || 'fixed',
    appTheme: (map.get('app_theme') as any) || 'light-gray',
    isDarkMode: map.get('is_dark_mode') === '1',
    selectedCalendarIds,
    defaultCalendarId: (map.get('default_calendar_id') ?? '') || null,
    lastViewedDay: (map.get('last_viewed_day') ?? '') || null,
    lastViewedMonth: (map.get('last_viewed_month') ?? '') || null,
    cardStyle: (map.get('card_style') as CardStyle) || 'tear-off',
    isPremium: map.get('is_premium') === '1',
  };
}

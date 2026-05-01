import { getDb } from './database';
import type { AppSettings, SettingKey, SettingRow } from '@/types/settings';

export async function getSetting(key: SettingKey): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SettingRow>(
    `SELECT key, value FROM settings WHERE key = ?`,
    key
  );
  return row?.value ?? null;
}

export async function setSetting(
  key: SettingKey,
  value: string | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value
  );
}

export async function getAllSettings(): Promise<AppSettings> {
  const db = await getDb();
  const rows = await db.getAllAsync<SettingRow>(
    `SELECT key, value FROM settings`
  );
  const map = new Map<string, string | null>();
  for (const r of rows) map.set(r.key, r.value);

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

  return {
    isBgEnabled: map.get('is_bg_enabled') === '1',
    bgUri: (map.get('bg_uri') ?? '') || null,
    bgUris,
    bgMode: (map.get('bg_mode') as 'fixed' | 'random') || 'fixed',
    appTheme: (map.get('app_theme') as any) || 'light-gray',
    selectedCalendarIds,
    defaultCalendarId: (map.get('default_calendar_id') ?? '') || null,
  };
}

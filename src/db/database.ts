import * as SQLite from 'expo-sqlite';

const DB_NAME = 'tear_off_calendar.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
  return dbInstance;
}

export async function initDatabase(): Promise<void> {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const defaults: [string, string][] = [
    ['is_bg_enabled', '1'],
    ['bg_uri', ''],
    ['selected_calendar_ids', '[]'],
    ['default_calendar_id', ''],
  ];
  for (const [key, value] of defaults) {
    await db.runAsync(
      `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
      key,
      value
    );
  }
}

export async function resetDatabase(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DROP TABLE IF EXISTS events;
    DROP TABLE IF EXISTS settings;
  `);
  await initDatabase();
}

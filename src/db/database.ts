/**
 * データベース基盤モジュール
 * SQLiteの接続管理（シングルトン）および、スキーマ定義、初期化ロジックを担当します。
 * アプリ起動時の RootLayout で呼び出されます。
 */
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

/**
 * データベースの初期化処理
 * テーブルの作成と、初回起動時のデフォルト設定の投入を行います。
 */
export async function initDatabase(): Promise<void> {
  const db = await getDb();

  // PRAGMA設定とテーブル作成をバッチ実行
  await db.execAsync(`
    -- WALモードを有効にして読み書きの並列パフォーマンスを向上
    PRAGMA journal_mode = WAL;
    -- 外部キー制約を有効化
    PRAGMA foreign_keys = ON;

    -- 設定値を管理するシンプルなKey-Valueテーブル
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- 日記エントリ（写真添付・タグ付き）。1日複数件を許容する履歴型テーブル。
    CREATE TABLE IF NOT EXISTS diaries (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT    NOT NULL,
      title      TEXT    NOT NULL DEFAULT '',
      content    TEXT    NOT NULL DEFAULT '',
      tags       TEXT    NOT NULL DEFAULT '[]',
      image_uris TEXT    NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_diaries_date ON diaries(date);
    CREATE INDEX IF NOT EXISTS idx_diaries_date_created ON diaries(date DESC, created_at DESC);

    -- 日記タグのマスター。日記モーダルではここからのみ選択可能。
    -- name はユニーク制約（COLLATE NOCASE で大小同一視）。タイポ防止のための一元管理。
    CREATE TABLE IF NOT EXISTS tags (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      created_at INTEGER NOT NULL
    );
  `);

  // 初回起動時に必要なデフォルト設定値
  const defaults: [string, string][] = [
    ['is_bg_enabled', '1'],
    ['bg_uri', ''],
    ['selected_calendar_ids', '[]'],
    ['default_calendar_id', ''],
    // 課金未購入をデフォルトとする（広告表示）。'1' になったら広告非表示。
    ['is_premium', '0'],
  ];

  // 各デフォルト値を投入。INSERT OR IGNORE を使うことで、
  // すでに値が存在する（ユーザーが設定変更済み）場合は上書きしないようにする。
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
    DROP TABLE IF EXISTS diaries;
    DROP TABLE IF EXISTS tags;
    DROP TABLE IF EXISTS settings;
  `);
  await initDatabase();
}

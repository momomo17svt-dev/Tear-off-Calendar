/**
 * 日記タグマスター (tags テーブル) のデータアクセス層。
 * 日記モーダルではここからのみタグを選択できる方針のため、登録・削除はこのモジュールに集約する。
 *
 * - name は COLLATE NOCASE でユニーク制約付き（タイポ防止の一元管理）
 * - 削除はマスターからのみで、過去の日記の tags JSON には触らない（履歴保護）
 */
import { getDb } from './database';
import { getAllUniqueTags } from './diaries';

export interface Tag {
  id: number;
  name: string;
  createdAt: number;
}

interface TagRow {
  id: number;
  name: string;
  created_at: number;
}

function rowToTag(row: TagRow): Tag {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

/**
 * 全マスタータグを作成日時の昇順で返す（古いものが上＝定着したタグが上に来る運用を想定）。
 */
export async function getAllTags(): Promise<Tag[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TagRow>(
    `SELECT * FROM tags ORDER BY created_at ASC, id ASC`
  );
  return rows.map(rowToTag);
}

/**
 * タグを新規登録する。
 * COLLATE NOCASE ユニーク制約により同名（大小違い含む）は弾かれる。
 * その場合は既存タグを返してフォーム側のリストに違和感が出ないようにする。
 *
 * @returns 挿入されたタグ。重複時は既存タグを返す。
 */
export async function insertTag(name: string): Promise<Tag | null> {
  const trimmed = name.replace(/"/g, '').trim();
  if (!trimmed) return null;
  const db = await getDb();
  const now = Date.now();
  try {
    const result = await db.runAsync(
      `INSERT INTO tags (name, created_at) VALUES (?, ?)`,
      trimmed,
      now
    );
    return { id: result.lastInsertRowId, name: trimmed, createdAt: now };
  } catch {
    // ユニーク制約違反：既存を引き当てて返す
    const existing = await db.getFirstAsync<TagRow>(
      `SELECT * FROM tags WHERE name = ? COLLATE NOCASE`,
      trimmed
    );
    return existing ? rowToTag(existing) : null;
  }
}

/**
 * タグのリネーム。既存日記の tags JSON は更新しない（履歴保護）。
 */
export async function renameTag(id: number, newName: string): Promise<void> {
  const trimmed = newName.replace(/"/g, '').trim();
  if (!trimmed) return;
  const db = await getDb();
  await db.runAsync(`UPDATE tags SET name = ? WHERE id = ?`, trimmed, id);
}

/**
 * タグを物理削除する。既存日記の tags JSON は触らない（その日記には残り続けるが、新規候補に出なくなる）。
 */
export async function deleteTag(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM tags WHERE id = ?`, id);
}

/**
 * 初回起動時のマイグレーション：
 * tags テーブルが空かつ、過去日記にタグが存在する場合、それらをマスターに自動取り込みする。
 * `migrated_tags_from_diaries` フラグを settings に立てて再実行を防ぐ。
 *
 * - 既存日記の tags JSON は変更しない
 * - エラーが出ても致命的ではないので throw しない（次回起動で再試行可能なまま）
 */
export async function migrateTagsFromDiariesIfNeeded(): Promise<void> {
  const db = await getDb();
  try {
    const flag = await db.getFirstAsync<{ value: string | null }>(
      `SELECT value FROM settings WHERE key = ?`,
      'migrated_tags_from_diaries'
    );
    if (flag?.value === '1') return;

    const count = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n FROM tags`
    );
    if ((count?.n ?? 0) > 0) {
      // 既にタグが手動で登録されているなら、マイグレーションは見送りつつフラグだけ立てる
      await db.runAsync(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        'migrated_tags_from_diaries',
        '1'
      );
      return;
    }

    const existing = await getAllUniqueTags();
    const now = Date.now();
    for (const name of existing) {
      await db.runAsync(
        `INSERT OR IGNORE INTO tags (name, created_at) VALUES (?, ?)`,
        name,
        now
      );
    }
    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      'migrated_tags_from_diaries',
      '1'
    );
  } catch (e) {
    console.warn('migrateTagsFromDiariesIfNeeded failed', e);
  }
}

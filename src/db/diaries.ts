/**
 * 日記データアクセス層 (Data Access Layer)
 * SQLite の `diaries` テーブルに対する CRUD 操作と検索を提供します。
 * 添付画像ファイル（expo-file-system のローカルファイル）の物理削除もここで担う。
 */
import * as FileSystem from 'expo-file-system/legacy';

import { getDb } from './database';
import type { Diary, DiaryInput, DiaryPatch, DiaryRow } from '@/types/diary';

/**
 * DB の生レコード（JSON 文字列カラム含む）を、アプリで扱う Diary 型へ変換する。
 */
export function rowToDiary(row: DiaryRow): Diary {
  let tags: string[] = [];
  try {
    if (row.tags) tags = JSON.parse(row.tags);
  } catch (e) {
    console.error('Failed to parse diary.tags', e);
  }
  let imageUris: string[] = [];
  try {
    if (row.image_uris) imageUris = JSON.parse(row.image_uris);
  } catch (e) {
    console.error('Failed to parse diary.image_uris', e);
  }
  return {
    id: row.id,
    date: row.date,
    title: row.title ?? '',
    content: row.content ?? '',
    tags,
    imageUris,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 日記を新規挿入する。作成日時・更新日時は呼び出し側ではなくここで採番する。
 * @returns 挿入された行の ID
 */
export async function insertDiary(input: DiaryInput): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const result = await db.runAsync(
    `INSERT INTO diaries (date, title, content, tags, image_uris, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.date,
    input.title,
    input.content,
    JSON.stringify(input.tags ?? []),
    JSON.stringify(input.imageUris ?? []),
    now,
    now
  );
  return result.lastInsertRowId;
}

/**
 * 日記の部分更新。指定されたフィールドだけを書き換え、updated_at を必ず更新する。
 */
export async function updateDiary(id: number, patch: DiaryPatch): Promise<void> {
  const db = await getDb();
  // 動的に SET 句を組み立てる（バインドパラメータ方式で SQL インジェクションは回避）
  const sets: string[] = [];
  const params: (string | number)[] = [];
  if (patch.date !== undefined) {
    sets.push('date = ?');
    params.push(patch.date);
  }
  if (patch.title !== undefined) {
    sets.push('title = ?');
    params.push(patch.title);
  }
  if (patch.content !== undefined) {
    sets.push('content = ?');
    params.push(patch.content);
  }
  if (patch.tags !== undefined) {
    sets.push('tags = ?');
    params.push(JSON.stringify(patch.tags));
  }
  if (patch.imageUris !== undefined) {
    sets.push('image_uris = ?');
    params.push(JSON.stringify(patch.imageUris));
  }
  // 何も更新項目がない場合は updated_at すら触らない
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(Date.now());
  params.push(id);
  await db.runAsync(`UPDATE diaries SET ${sets.join(', ')} WHERE id = ?`, ...params);
}

/**
 * 日記を物理削除する。添付画像ファイルも合わせて FS から削除する。
 */
export async function deleteDiary(id: number): Promise<void> {
  const db = await getDb();
  // 添付画像ファイルを先に削除するため、対象行の image_uris を先に取得する
  const row = await db.getFirstAsync<{ image_uris: string }>(
    `SELECT image_uris FROM diaries WHERE id = ?`,
    id
  );
  if (row?.image_uris) {
    try {
      const uris: string[] = JSON.parse(row.image_uris);
      await Promise.all(
        uris.map((uri) =>
          FileSystem.deleteAsync(uri, { idempotent: true }).catch((err) =>
            console.warn('Failed to delete diary image', uri, err)
          )
        )
      );
    } catch (e) {
      console.error('Failed to parse image_uris on delete', e);
    }
  }
  await db.runAsync(`DELETE FROM diaries WHERE id = ?`, id);
}

/**
 * 特定日付の日記を新しい順で取得する。
 */
export async function getDiariesByDate(date: string): Promise<Diary[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DiaryRow>(
    `SELECT * FROM diaries WHERE date = ? ORDER BY created_at DESC`,
    date
  );
  return rows.map(rowToDiary);
}

/**
 * 全日記を新しい順で取得する。起動時のキャッシュ構築に使う。
 */
export async function getAllDiaries(): Promise<Diary[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DiaryRow>(
    `SELECT * FROM diaries ORDER BY date DESC, created_at DESC`
  );
  return rows.map(rowToDiary);
}

/**
 * タイトル / タグでの LIKE 検索。
 * - タイトルは部分一致
 * - タグは JSON 配列文字列内の `"<query>"` を含むかで「完全タグ一致」判定
 * - 検索クエリの `%` `_` `\` はエスケープしてクラッシュを防ぐ
 */
export async function searchDiaries(query: string): Promise<Diary[]> {
  const q = query.trim();
  if (!q) return [];
  const db = await getDb();
  // SQLite の LIKE で使うメタ文字をエスケープ
  const escaped = q.replace(/[\\%_]/g, '\\$&');
  const titleLike = `%${escaped}%`;
  // タグは JSON 配列内の "foo" を含むかで判定する。タグ文字列内の " ' \\ は JSON.stringify でエスケープされるが、
  // ここでは検索用にユーザー入力をそのまま使うため、ダブルクオートだけは入っていないと仮定する（UI 側でも除去）
  const tagLike = `%"${escaped}"%`;
  const rows = await db.getAllAsync<DiaryRow>(
    `SELECT * FROM diaries
       WHERE title LIKE ? ESCAPE '\\'
          OR tags  LIKE ? ESCAPE '\\'
     ORDER BY date DESC, created_at DESC
     LIMIT 200`,
    titleLike,
    tagLike
  );
  return rows.map(rowToDiary);
}

/**
 * 単一の日記を ID で取得する。編集モーダルでの再読み込みに使う。
 */
export async function getDiaryById(id: number): Promise<Diary | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DiaryRow>(
    `SELECT * FROM diaries WHERE id = ?`,
    id
  );
  return row ? rowToDiary(row) : null;
}

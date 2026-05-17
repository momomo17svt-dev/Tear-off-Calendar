/**
 * 日記エントリの型定義。
 * アプリ内 SQLite の `diaries` テーブルに格納するレコードを、アプリで扱いやすい形に整形した型と、
 * DBから取り出した直後の生レコード型を分けて定義します。
 */

/**
 * アプリ内で扱う日記エントリ。
 * `tags` / `imageUris` は JSON 文字列ではなく既にパース済みの配列で保持します。
 */
export interface Diary {
  /** 日記の一意なID（AUTOINCREMENT） */
  id: number;
  /** 対象日付（YYYY-MM-DD 形式、ホーム画面の日付キーと整合） */
  date: string;
  /** タイトル（空文字許容） */
  title: string;
  /** 本文（複数行可、空文字許容） */
  content: string;
  /** タグの配列 */
  tags: string[];
  /** 添付画像のローカルURI配列（expo-file-system の documentDirectory 配下） */
  imageUris: string[];
  /** 作成日時（Date.now() の ms） */
  createdAt: number;
  /** 最終更新日時（Date.now() の ms） */
  updatedAt: number;
}

/**
 * SQLite から取り出した生レコード型。
 * `tags` / `image_uris` は JSON 配列文字列のまま、列名もスネークケース。
 */
export interface DiaryRow {
  id: number;
  date: string;
  title: string;
  content: string;
  tags: string;
  image_uris: string;
  created_at: number;
  updated_at: number;
}

/**
 * 新規作成時の入力型（id / createdAt / updatedAt は DB 側で採番・付与）
 */
export type DiaryInput = Omit<Diary, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * 部分更新時のパッチ型
 */
export type DiaryPatch = Partial<Omit<Diary, 'id' | 'createdAt' | 'updatedAt'>>;

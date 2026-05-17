/**
 * 日記用の Zustand ストア
 * SQLite の `diaries` テーブルを単一データソースとし、メモリ上に日付別キャッシュを保持する。
 * nativeCalendarStore と同じ Record<date, T[]> 構造を採用してホーム連動を容易にしている。
 */
import { create } from 'zustand';

import {
  deleteDiary,
  getAllDiaries,
  getDiariesByDate,
  insertDiary,
  searchDiaries,
  updateDiary,
} from '@/db/diaries';
import type { Diary, DiaryInput, DiaryPatch } from '@/types/diary';

interface DiaryState {
  /** 日付（YYYY-MM-DD）→ 日記配列 のマップ。各日付配列は created_at DESC 順。 */
  diariesByDate: Record<string, Diary[]>;
  /** 初期化フェッチが進行中かどうか */
  isLoading: boolean;
  /** 検索バーの入力値（UI 側で書き換える） */
  searchQuery: string;
  /** 直近の検索結果 */
  searchResults: Diary[];
  /** 検索中フラグ（デバウンス完了〜結果取得までの間 true） */
  isSearching: boolean;

  /** 全日記をフェッチして diariesByDate を再構築する。アプリ起動時に呼ばれる。 */
  fetchAll: () => Promise<void>;
  /** 特定日付の日記だけ再取得して当該キーを置き換える。 */
  refetchDate: (date: string) => Promise<void>;
  /** 指定日付の日記配列を返す（無ければ空配列） */
  getDiariesForDate: (date: string) => Diary[];

  /** 新規日記を挿入してキャッシュも更新する。 */
  addDiary: (input: DiaryInput) => Promise<number>;
  /** 既存日記を更新してキャッシュも更新する。 */
  editDiary: (id: number, patch: DiaryPatch) => Promise<void>;
  /** 既存日記を削除してキャッシュも更新する。 */
  removeDiary: (id: number, date: string) => Promise<void>;

  /** 検索クエリを設定する（実検索は runSearch で実行）。 */
  setSearchQuery: (q: string) => void;
  /** 現在の searchQuery で SQLite を検索し、searchResults を更新する。 */
  runSearch: () => Promise<void>;
  /** 検索状態をクリアする。 */
  clearSearch: () => void;
}

/**
 * Diary 配列を created_at DESC で並べる比較関数。
 */
function compareDiariesDesc(a: Diary, b: Diary): number {
  return b.createdAt - a.createdAt;
}

export const useDiaryStore = create<DiaryState>((set, get) => ({
  diariesByDate: {},
  isLoading: false,
  searchQuery: '',
  searchResults: [],
  isSearching: false,

  fetchAll: async () => {
    set({ isLoading: true });
    try {
      const all = await getAllDiaries();
      const byDate: Record<string, Diary[]> = {};
      for (const d of all) {
        if (!byDate[d.date]) byDate[d.date] = [];
        byDate[d.date].push(d);
      }
      // 各日付配列を created_at DESC で安定ソート
      for (const date of Object.keys(byDate)) {
        byDate[date].sort(compareDiariesDesc);
      }
      set({ diariesByDate: byDate, isLoading: false });
    } catch (e) {
      console.error('diaryStore.fetchAll error:', e);
      set({ isLoading: false });
    }
  },

  refetchDate: async (date: string) => {
    try {
      const list = await getDiariesByDate(date);
      set((s) => ({
        diariesByDate: { ...s.diariesByDate, [date]: list },
      }));
    } catch (e) {
      console.error('diaryStore.refetchDate error:', e);
    }
  },

  getDiariesForDate: (date: string) => {
    return get().diariesByDate[date] ?? [];
  },

  addDiary: async (input) => {
    const id = await insertDiary(input);
    await get().refetchDate(input.date);
    return id;
  },

  editDiary: async (id, patch) => {
    await updateDiary(id, patch);
    // 日付が変更されたケースに対応するため、影響しうる日付を両方再取得する
    // patch.date が未定義のときは、既存キャッシュから該当日記の date を逆引きする
    let oldDate: string | undefined;
    for (const [date, list] of Object.entries(get().diariesByDate)) {
      if (list.some((d) => d.id === id)) {
        oldDate = date;
        break;
      }
    }
    const newDate = patch.date ?? oldDate;
    if (oldDate) await get().refetchDate(oldDate);
    if (newDate && newDate !== oldDate) await get().refetchDate(newDate);
  },

  removeDiary: async (id, date) => {
    await deleteDiary(id);
    await get().refetchDate(date);
  },

  setSearchQuery: (q) => set({ searchQuery: q }),

  runSearch: async () => {
    const q = get().searchQuery.trim();
    if (!q) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    set({ isSearching: true });
    try {
      const results = await searchDiaries(q);
      set({ searchResults: results, isSearching: false });
    } catch (e) {
      console.error('diaryStore.runSearch error:', e);
      set({ isSearching: false });
    }
  },

  clearSearch: () => set({ searchQuery: '', searchResults: [], isSearching: false }),
}));

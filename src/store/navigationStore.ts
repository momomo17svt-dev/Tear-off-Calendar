import { create } from 'zustand';

import { toDateString } from '@/utils/nativeCalendar';

/**
 * アプリケーション全体のナビゲーション状態を管理するストア。
 * 特にカレンダー画面での特定日付への移動（ジャンプ）操作、
 * およびホームと日記タブ間で「現在選択中の日付」を共有するために使用されます。
 */
interface NavigationState {
  /** 移動先のターゲット日付（YYYY-MM-DD形式）。null の場合は移動なし。 */
  jumpDate: string | null;
  /** 移動先のターゲット日付を設定するアクション */
  setJumpDate: (date: string | null) => void;
  /**
   * 現在ホーム画面で選択中の日付（YYYY-MM-DD）。
   * ホームでのスワイプで更新され、日記タブはこれを読んで対象日を決定する。
   * 永続化はしない（揮発）。永続化済みの lastViewedDay（settingsStore）と棲み分ける。
   */
  selectedDate: string;
  /** 選択中日付を設定するアクション */
  setSelectedDate: (date: string) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  jumpDate: null,
  setJumpDate: (date) => set({ jumpDate: date }),
  selectedDate: toDateString(new Date()),
  setSelectedDate: (date) => set({ selectedDate: date }),
}));

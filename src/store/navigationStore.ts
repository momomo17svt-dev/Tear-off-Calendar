import { create } from 'zustand';

/**
 * アプリケーション全体のナビゲーション状態を管理するストア。
 * 特にカレンダー画面での特定日付への移動（ジャンプ）操作に使用されます。
 */
interface NavigationState {
  /** 移動先のターゲット日付（YYYY-MM-DD形式）。null の場合は移動なし。 */
  jumpDate: string | null;
  /** 移動先のターゲット日付を設定するアクション */
  setJumpDate: (date: string | null) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  jumpDate: null,
  setJumpDate: (date) => set({ jumpDate: date }),
}));

import { create } from 'zustand';

interface NavigationState {
  jumpDate: string | null;
  setJumpDate: (date: string | null) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  jumpDate: null,
  setJumpDate: (date) => set({ jumpDate: date }),
}));

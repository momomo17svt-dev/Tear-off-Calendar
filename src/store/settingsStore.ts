import { create } from 'zustand';
import { getAllSettings, setSetting } from '@/db/settings';

interface SettingsState {
  isBgEnabled: boolean;
  bgUri: string | null;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  setBgEnabled: (enabled: boolean) => Promise<void>;
  setBgUri: (uri: string | null) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  isBgEnabled: true,
  bgUri: null,
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    const s = await getAllSettings();
    set({ isBgEnabled: s.isBgEnabled, bgUri: s.bgUri, isLoading: false });
  },

  setBgEnabled: async (enabled) => {
    await setSetting('is_bg_enabled', enabled ? '1' : '0');
    set({ isBgEnabled: enabled });
  },

  setBgUri: async (uri) => {
    await setSetting('bg_uri', uri ?? '');
    set({ bgUri: uri });
  },
}));

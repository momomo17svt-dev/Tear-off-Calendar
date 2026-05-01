import { create } from 'zustand';
import { getAllSettings, setSetting } from '@/db/settings';

import { AppTheme } from '@/types/settings';

interface SettingsState {
  isBgEnabled: boolean;
  bgUri: string | null;
  bgUris: string[];
  bgMode: 'fixed' | 'random';
  appTheme: AppTheme;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  setBgEnabled: (enabled: boolean) => Promise<void>;
  setBgUri: (uri: string | null) => Promise<void>;
  addBgUri: (uri: string) => Promise<void>;
  removeBgUri: (uri: string) => Promise<void>;
  setBgMode: (mode: 'fixed' | 'random') => Promise<void>;
  setAppTheme: (theme: AppTheme) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isBgEnabled: true,
  bgUri: null,
  bgUris: [],
  bgMode: 'fixed',
  appTheme: 'light-gray',
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    const s = await getAllSettings();
    set({ 
      isBgEnabled: s.isBgEnabled, 
      bgUri: s.bgUri, 
      bgUris: s.bgUris,
      bgMode: s.bgMode,
      appTheme: s.appTheme,
      isLoading: false 
    });
  },

  setBgEnabled: async (enabled) => {
    await setSetting('is_bg_enabled', enabled ? '1' : '0');
    set({ isBgEnabled: enabled });
  },

  setBgUri: async (uri) => {
    await setSetting('bg_uri', uri ?? '');
    set({ bgUri: uri });
  },

  addBgUri: async (uri) => {
    const { bgUris, bgUri } = get();
    if (bgUris.includes(uri)) return;
    const newUris = [...bgUris, uri];
    await setSetting('bg_uris', JSON.stringify(newUris));
    
    // Automatically set as fixed bgUri if it's the first one
    if (!bgUri) {
      await setSetting('bg_uri', uri);
      set({ bgUris: newUris, bgUri: uri });
    } else {
      set({ bgUris: newUris });
    }
  },

  removeBgUri: async (uri) => {
    const { bgUris, bgUri } = get();
    const newUris = bgUris.filter(u => u !== uri);
    await setSetting('bg_uris', JSON.stringify(newUris));
    
    if (bgUri === uri) {
      const nextUri = newUris.length > 0 ? newUris[0] : null;
      await setSetting('bg_uri', nextUri ?? '');
      set({ bgUris: newUris, bgUri: nextUri });
    } else {
      set({ bgUris: newUris });
    }
  },

  setBgMode: async (mode) => {
    await setSetting('bg_mode', mode);
    set({ bgMode: mode });
  },

  setAppTheme: async (theme) => {
    await setSetting('app_theme', theme);
    set({ appTheme: theme });
  },
}));

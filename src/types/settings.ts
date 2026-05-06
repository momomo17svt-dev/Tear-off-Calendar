export type SettingKey =
  | 'is_bg_enabled'
  | 'bg_uri'
  | 'bg_uris'
  | 'bg_mode'
  | 'app_theme'
  | 'selected_calendar_ids'
  | 'default_calendar_id'
  | 'is_dark_mode';

export interface SettingRow {
  key: SettingKey;
  value: string | null;
}

export type AppTheme = 'light-gray' | 'corkboard' | 'wood'
  | 'washi' | 'sakura' | 'matcha' | 'aizome' | 'momiji';

export interface AppSettings {
  isBgEnabled: boolean;
  bgUri: string | null;
  bgUris: string[];
  bgMode: 'fixed' | 'random';
  appTheme: AppTheme;
  isDarkMode: boolean;
  selectedCalendarIds: string[];
  defaultCalendarId: string | null;
}

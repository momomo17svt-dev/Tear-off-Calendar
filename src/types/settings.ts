export type SettingKey = 'is_bg_enabled' | 'bg_uri';

export interface SettingRow {
  key: SettingKey;
  value: string | null;
}

export interface AppSettings {
  isBgEnabled: boolean;
  bgUri: string | null;
}

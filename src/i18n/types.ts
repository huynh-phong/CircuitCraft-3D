export type Language = 'vi' | 'en';
export type ThemeMode = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

export interface UserPreferences {
  theme: ThemeMode;
  language: Language;
}

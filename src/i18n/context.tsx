import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Language, ThemeMode, EffectiveTheme, UserPreferences } from './types';
import { TRANSLATIONS } from './translations';
import { authService, UserProfile } from '../persistence/authService';

export interface I18nContextType {
  language: Language;
  theme: ThemeMode;
  effectiveTheme: EffectiveTheme;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
  formatCurrency: (amount: number) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

const GUEST_STORAGE_KEY = 'circuitcraft_guest_pref';

function getStorageKey(userId?: string | null): string {
  return userId ? `circuitcraft_pref_${userId}` : GUEST_STORAGE_KEY;
}

function getSystemTheme(): EffectiveTheme {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function loadSavedPreferences(userId?: string | null): UserPreferences {
  if (typeof window === 'undefined') {
    return { theme: 'system', language: 'vi' };
  }

  const key = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        theme: parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system' ? parsed.theme : 'system',
        language: parsed.language === 'en' ? 'en' : 'vi',
      };
    }
  } catch (err) {
    console.warn('Failed to parse saved preferences:', err);
  }

  // First time defaults: system preference for theme, 'vi' for language
  return {
    theme: 'system',
    language: 'vi',
  };
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<any>(() => authService.getCurrentUser());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => authService.getCurrentProfile());

  // Preferences state
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const initial = loadSavedPreferences(authService.getCurrentUser()?.id);
    return initial.theme;
  });

  const [language, setLanguageState] = useState<Language>(() => {
    const initial = loadSavedPreferences(authService.getCurrentUser()?.id);
    return initial.language;
  });

  const [systemEffectiveTheme, setSystemEffectiveTheme] = useState<EffectiveTheme>(getSystemTheme);

  // Listen to OS prefers-color-scheme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemEffectiveTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Listen to Auth State Changes and switch to account-scoped preferences
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((user, profile) => {
      setCurrentUser(user);
      setUserProfile(profile);

      // Load preferences for this specific account (or guest if logged out)
      const prefs = loadSavedPreferences(user?.id);
      // If profile has server preferences stored, prioritize them
      const serverTheme = profile?.preferences?.theme;
      const serverLang = profile?.preferences?.language;

      const chosenTheme = (serverTheme || prefs.theme) as ThemeMode;
      const chosenLang = (serverLang || prefs.language) as Language;

      setThemeModeState(chosenTheme);
      setLanguageState(chosenLang);
    });

    return () => unsubscribe();
  }, []);

  // Calculate effective theme
  const effectiveTheme: EffectiveTheme = useMemo(() => {
    if (themeMode === 'system') {
      return systemEffectiveTheme;
    }
    return themeMode;
  }, [themeMode, systemEffectiveTheme]);

  // Synchronize with DOM (HTML tag classes and attributes)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    root.setAttribute('data-theme', effectiveTheme);
    root.setAttribute('lang', language);
  }, [effectiveTheme, language]);

  // Setters with persistence
  const setTheme = useCallback(
    (newTheme: ThemeMode) => {
      setThemeModeState(newTheme);
      const storageKey = getStorageKey(currentUser?.id);
      try {
        const currentPrefs = loadSavedPreferences(currentUser?.id);
        const updated: UserPreferences = { ...currentPrefs, theme: newTheme };
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save theme to localStorage', e);
      }

      // Sync to profile if logged in
      if (currentUser && authService.updatePreferences) {
        authService.updatePreferences({ theme: newTheme });
      }
    },
    [currentUser]
  );

  const setLanguage = useCallback(
    (newLang: Language) => {
      setLanguageState(newLang);
      const storageKey = getStorageKey(currentUser?.id);
      try {
        const currentPrefs = loadSavedPreferences(currentUser?.id);
        const updated: UserPreferences = { ...currentPrefs, language: newLang };
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save language to localStorage', e);
      }

      // Sync to profile if logged in
      if (currentUser && authService.updatePreferences) {
        authService.updatePreferences({ language: newLang });
      }
    },
    [currentUser]
  );

  const toggleTheme = useCallback(() => {
    setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
  }, [effectiveTheme, setTheme]);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'vi' ? 'en' : 'vi');
  }, [language, setLanguage]);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const dict = TRANSLATIONS[language];
      if (dict && dict[key] !== undefined) {
        return dict[key];
      }
      // Fallback to Vietnamese dictionary
      if (TRANSLATIONS.vi && TRANSLATIONS.vi[key] !== undefined) {
        return TRANSLATIONS.vi[key];
      }
      return fallback || key;
    },
    [language]
  );

  const formatCurrency = useCallback(
    (amount: number): string => {
      if (language === 'en') {
        return `${amount.toLocaleString('en-US')} VND`;
      }
      return `${amount.toLocaleString('vi-VN')} ₫`;
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      theme: themeMode,
      effectiveTheme,
      setLanguage,
      setTheme,
      toggleTheme,
      toggleLanguage,
      t,
      formatCurrency,
    }),
    [language, themeMode, effectiveTheme, setLanguage, setTheme, toggleTheme, toggleLanguage, t, formatCurrency]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

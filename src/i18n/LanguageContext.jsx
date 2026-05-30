import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import translations, { DEFAULT_LANGUAGE, LANGUAGES } from './translations';

const STORAGE_KEY = 'soyou-lang';
const SUPPORTED = LANGUAGES.map((l) => l.code);

const LanguageContext = createContext(null);

const getInitialLanguage = () => {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    const browser = (navigator.language || '').slice(0, 2).toLowerCase();
    if (SUPPORTED.includes(browser)) return browser;
  } catch {
    // localStorage unavailable (private mode etc.) — fall through to default
  }
  return DEFAULT_LANGUAGE;
};

// Resolve a dot-path ("nav.home") against an object, returning undefined if any
// segment is missing.
const resolve = (obj, path) =>
  path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(getInitialLanguage);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      /* ignore persistence failures */
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = useCallback((code) => {
    if (SUPPORTED.includes(code)) setLanguageState(code);
  }, []);

  // t('nav.home') -> string. Missing keys fall back to French, then to the key
  // itself. Values may also be arrays/objects (e.g. legal sections) or
  // functions (interpolated strings); callers receive them as-is.
  const t = useCallback(
    (key) => {
      const value = resolve(translations[language], key);
      if (value !== undefined) return value;
      const fallback = resolve(translations[DEFAULT_LANGUAGE], key);
      return fallback !== undefined ? fallback : key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
};

export default LanguageContext;

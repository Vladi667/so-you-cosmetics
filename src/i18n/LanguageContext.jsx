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

// What she has rewritten from the admin, injected into the document by the
// server before the page is sent (see server/index.js). Read synchronously at
// module load, exactly like the coded translations, so there is no moment where
// the old wording is on screen waiting to be replaced.
//
// Shaped { fr: { 'hero.titleLine1': '…' } } — the same dot-paths the site
// already uses, so no mapping table has to be kept in step.
const overrides = (typeof window !== 'undefined' && window.__CONTENT__) || {};

const override = (lang, key) => {
  const bucket = overrides[lang];
  if (!bucket) return undefined;
  const value = bucket[key];
  // An empty string means "no override" rather than "blank this text": a field
  // she cleared must show the coded default again, not nothing.
  return value === '' || value == null ? undefined : value;
};

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
  // itself. Values may also be arrays or objects (e.g. legal sections); callers
  // receive those as-is.
  //
  // t('footer.rights', { year: 2026 }) fills {year} in the resolved string.
  // Four values used to be functions — `(year) => \`© ${year} …\`` — which read
  // naturally but cannot survive a round trip through JSON, and the content
  // editor stores its overrides as JSON. They are plain strings with {named}
  // placeholders now, so a text she edits can never be less capable than the
  // one it replaces. A placeholder with no matching variable is left visible
  // rather than blanked: a stray {year} on screen is a bug someone reports,
  // while a silent empty space is one nobody notices.
  const t = useCallback(
    (key, vars) => {
      // Her wording first, then the code, then French — and her French before
      // the coded French, because if she rewrote it, that is the current text.
      let value = override(language, key);
      if (value === undefined) value = resolve(translations[language], key);
      if (value === undefined) value = override(DEFAULT_LANGUAGE, key);
      if (value === undefined) value = resolve(translations[DEFAULT_LANGUAGE], key);
      if (value === undefined) return key;
      if (vars && typeof value === 'string') {
        return value.replace(/\{(\w+)\}/g, (whole, name) =>
          Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole
        );
      }
      return value;
    },
    [language]
  );

  // Translate a shop category label. Categories travel through the app as their
  // canonical FR names (URLs, product.collections, filter logic), so the lookup
  // accepts the FR name and returns the display label for the current language,
  // falling back to the FR name itself when no translation exists.
  const tCategory = useCallback(
    (name) => {
      if (!name) return name;
      const map = translations[language] && translations[language].categories;
      if (map && map[name]) return map[name];
      const fr = translations[DEFAULT_LANGUAGE] && translations[DEFAULT_LANGUAGE].categories;
      if (fr && fr[name]) return fr[name];
      return name;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tCategory, languages: LANGUAGES }}>
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

import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import translations, { DEFAULT_LANGUAGE, LANGUAGES } from './translations';
import { separerLangue, avecLangue } from './routes';

const STORAGE_KEY = 'soyou-lang';
const SUPPORTED = LANGUAGES.map((l) => l.code);

const LanguageContext = createContext(null);

// La langue vient de l'adresse, et de nulle part ailleurs.
//
// Elle venait de localStorage, puis de navigator.language. Trois conséquences,
// dont la dernière est la plus coûteuse :
//
//   · les trois langues partageaient une seule URL par page, donc un moteur ne
//     pouvait en indexer qu'une, et il n'existait aucune adresse anglaise ou
//     allemande à faire remonter ;
//   · aucune balise hreflang n'était possible — elle désigne des URL ;
//   · le navigateur d'exploration de Google part d'un profil vierge et annonce
//     l'anglais. Il rendait donc le site en anglais : d'une boutique genevoise
//     dont la clientèle écrit en français, ce sont les pages françaises qui
//     n'étaient pas indexées.
//
// Le lien envoyé à quelqu'un porte maintenant la langue dans laquelle on l'a
// lu, ce qui était déjà le comportement que tout le monde supposait.

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
// Lu à chaque appel, et sur globalThis plutôt que sur window.
//
// Deux raisons, toutes deux liées au rendu côté serveur :
//
//   · au moment où ce module est chargé, le serveur n'a encore rien posé. Une
//     constante figée à l'import vaudrait {} pour toujours — et comme le
//     processus sert toutes les requêtes, ses textes réécrits ne seraient
//     rendus sur aucune page ;
//   · « window » n'existe pas sur le serveur. Celui-ci produirait le texte
//     codé, le navigateur reproduirait le texte réécrit, et React signalerait
//     une divergence d'hydratation sur chaque texte qu'elle a modifié.
//
// Dans un navigateur, globalThis EST window : rien ne change côté client.
const lireOverrides = () => globalThis.__CONTENT__ || {};

const override = (lang, key) => {
  const bucket = lireOverrides()[lang];
  if (!bucket) return undefined;
  const value = bucket[key];
  // An empty string means "no override" rather than "blank this text": a field
  // she cleared must show the coded default again, not nothing.
  return value === '' || value == null ? undefined : value;
};

export const LanguageProvider = ({ children }) => {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const language = separerLangue(pathname).langue;

  useEffect(() => {
    try {
      // Conservée pour que le sélecteur retrouve son choix, jamais pour décider
      // à la place de l'adresse : rediriger un visiteur d'après ce qu'il a
      // choisi la dernière fois ferait à nouveau servir deux contenus sous la
      // même URL, ce qu'on vient précisément de défaire.
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      /* ignore persistence failures */
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  // Changer de langue, c'est changer d'adresse — la même page, ailleurs. Le
  // remplacement plutôt que l'empilement : revenir en arrière après avoir
  // changé de langue doit ramener à la page précédente, pas à sa traduction.
  const setLanguage = useCallback((code) => {
    if (!SUPPORTED.includes(code) || code === language) return;
    navigate(`${avecLangue(pathname, code)}${search}${hash}`, { replace: true });
  }, [language, navigate, pathname, search, hash]);

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

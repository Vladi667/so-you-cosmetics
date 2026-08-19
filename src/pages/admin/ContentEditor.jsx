import React, { useState, useEffect, useMemo } from 'react';
import translations, { DEFAULT_LANGUAGE, LANGUAGES } from '../../i18n/translations';

// The sections she can rewrite, in the order they appear on the site.
//
// Deliberately absent: `terms` and `privacy` (legal text does not belong behind
// a free-text form), and `nav`, `drawer`, `catalog`, `product`, `search`,
// `loader`, `category`, `categories` (interface labels — changing them breaks
// consistency without giving her anything). That exclusion is what keeps this
// panel to ~139 fields per language instead of 317.
const SECTIONS = [
  { key: 'hero', label: 'Accueil — bannière' },
  { key: 'brandEssence', label: 'Accueil — bandeau défilant' },
  { key: 'signature', label: 'Accueil — coups de cœur' },
  { key: 'handmade', label: 'Accueil — philosophie' },
  { key: 'ingredients', label: 'Accueil — ingrédients' },
  { key: 'workshopsSection', label: 'Accueil — ateliers' },
  { key: 'about', label: 'Page « Notre histoire »' },
  { key: 'workshopsPage', label: 'Page « Ateliers »' },
  { key: 'contact', label: 'Page « Contact »' },
  { key: 'footer', label: 'Pied de page' },
];

// Collect the string leaves of a section as dot-paths. Arrays are skipped on
// purpose: editing a list means adding, removing and reordering its items, which
// is a different interface and a later phase. Showing them as plain fields now
// would let her edit item 2 of a list she cannot reorder — worse than not
// offering them at all.
function flatten(node, prefix, out) {
  if (typeof node === 'string') {
    out.push(prefix);
    return out;
  }
  if (Array.isArray(node) || node === null || typeof node !== 'object') return out;
  for (const [key, value] of Object.entries(node)) {
    flatten(value, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

const resolve = (obj, path) =>
  path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);

// A dot-path makes a poor label. Turn "titleLine1" into "Title line 1" so the
// list reads as fields rather than as code.
const prettify = (path) => {
  const last = path.split('.').pop();
  const spaced = last.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const ContentEditor = ({ fetchHeaders }) => {
  const [overrides, setOverrides] = useState({});
  const [drafts, setDrafts] = useState({});     // { 'lang::path': value }
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [section, setSection] = useState(SECTIONS[0].key);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ success: '', error: '' });

  useEffect(() => {
    let active = true;
    fetch('/api/content', { headers: fetchHeaders })
      .then((res) => {
        if (!res.ok) throw new Error('Lecture impossible');
        return res.json();
      })
      .then((data) => { if (active) { setOverrides(data || {}); setLoading(false); } })
      .catch(() => {
        if (active) {
          setStatus({ success: '', error: 'Impossible de charger les textes enregistrés.' });
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const paths = useMemo(
    () => flatten(translations[DEFAULT_LANGUAGE][section], section, []),
    [section]
  );

  const draftKey = (path) => `${language}::${path}`;

  // What the site shows for this field today: her text if she wrote one,
  // otherwise the coded default — the same order the site itself resolves in.
  const savedValue = (path) => {
    const own = overrides[language] && overrides[language][path];
    if (own != null && own !== '') return own;
    const coded = resolve(translations[language], path);
    return coded !== undefined ? coded : (resolve(translations[DEFAULT_LANGUAGE], path) || '');
  };

  const currentValue = (path) => {
    const key = draftKey(path);
    return Object.prototype.hasOwnProperty.call(drafts, key) ? drafts[key] : savedValue(path);
  };

  const isOverridden = (path) => {
    const own = overrides[language] && overrides[language][path];
    return own != null && own !== '';
  };

  const isDirty = (path) => {
    const key = draftKey(path);
    return Object.prototype.hasOwnProperty.call(drafts, key) && drafts[key] !== savedValue(path);
  };

  const dirtyCount = Object.keys(drafts).filter((k) => {
    const [lang, ...rest] = k.split('::');
    const path = rest.join('::');
    const own = overrides[lang] && overrides[lang][path];
    const saved = own != null && own !== ''
      ? own
      : (resolve(translations[lang], path) ?? resolve(translations[DEFAULT_LANGUAGE], path) ?? '');
    return drafts[k] !== saved;
  }).length;

  const setDraft = (path, value) => {
    setStatus({ success: '', error: '' });
    setDrafts((prev) => ({ ...prev, [draftKey(path)]: value }));
  };

  // Returning a field to its coded default is a save of '' — the server reads
  // that as "drop this override" rather than "store an empty text", so the
  // neighbouring fields are untouched.
  const resetField = (path) => {
    setStatus({ success: '', error: '' });
    setDrafts((prev) => ({ ...prev, [draftKey(path)]: '__RESET__' }));
  };

  const handleSave = () => {
    const patch = {};
    for (const [key, value] of Object.entries(drafts)) {
      const [lang, ...rest] = key.split('::');
      const path = rest.join('::');
      const coded = resolve(translations[lang], path);
      let next;
      if (value === '__RESET__') next = '';
      // Typing the coded default back by hand should also clear the override
      // rather than store a duplicate of what the code already says.
      else if (value === coded) next = '';
      else next = value;
      patch[lang] = patch[lang] || {};
      patch[lang][path] = next;
    }
    if (Object.keys(patch).length === 0) return;

    setSaving(true);
    setStatus({ success: '', error: '' });
    fetch('/api/content', {
      method: 'PUT',
      headers: fetchHeaders,
      body: JSON.stringify(patch),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Enregistrement refusé');
        return res.json();
      })
      .then((next) => {
        setOverrides(next || {});
        setDrafts({});
        setStatus({
          success: 'Textes enregistrés. Rechargez le site pour les voir en ligne.',
          error: '',
        });
      })
      .catch(() => setStatus({ success: '', error: "L'enregistrement a échoué. Rien n'a été modifié." }))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return <p className="text-sm text-stone-gray">Chargement des textes…</p>;
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-serif text-3xl md:text-4xl text-slate-stone mb-2">Textes du site</h1>
      <p className="text-sm text-stone-gray mb-8">
        Modifiez les textes affichés sur le site, sans toucher au code. Un champ laissé tel quel
        garde le texte d'origine ; « Rétablir » y revient à tout moment.
      </p>

      {status.success && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 border border-green-100 rounded-xl text-sm font-medium">{status.success}</div>
      )}
      {status.error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm">{status.error}</div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1 p-1 bg-mist-white rounded-xl border border-slate-stone/10">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLanguage(l.code)}
              className={`px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-medium transition-colors ${
                language === l.code ? 'bg-slate-stone text-white' : 'text-stone-gray hover:text-slate-stone'
              }`}
            >
              {l.code}
            </button>
          ))}
        </div>

        <select
          value={section}
          onChange={(e) => setSection(e.target.value)}
          className="flex-1 min-w-[220px] px-4 py-2 bg-white border border-slate-stone/15 rounded-xl text-sm text-slate-stone"
        >
          {SECTIONS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-3xl border border-slate-stone/5 p-6 sm:p-8 shadow-sm space-y-6">
        {paths.length === 0 && (
          <p className="text-sm text-stone-gray">Cette section ne contient aucun texte simple.</p>
        )}

        {paths.map((path) => {
          const value = currentValue(path) === '__RESET__' ? '' : currentValue(path);
          const coded = resolve(translations[language], path);
          const long = String(coded || '').length > 70;
          return (
            <div key={path}>
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <label className="text-xs uppercase tracking-widest text-stone-gray font-medium">
                  {prettify(path)}
                  {isOverridden(path) && (
                    <span className="ml-2 normal-case tracking-normal text-[11px] text-mist-blue">modifié</span>
                  )}
                  {isDirty(path) && (
                    <span className="ml-2 normal-case tracking-normal text-[11px] text-amber-600">non enregistré</span>
                  )}
                </label>
                {(isOverridden(path) || isDirty(path)) && (
                  <button
                    type="button"
                    onClick={() => resetField(path)}
                    className="text-[11px] text-stone-gray hover:text-slate-stone underline underline-offset-2"
                  >
                    Rétablir
                  </button>
                )}
              </div>

              {long ? (
                <textarea
                  rows={3}
                  value={value}
                  onChange={(e) => setDraft(path, e.target.value)}
                  className="w-full px-4 py-3 bg-mist-white border border-slate-stone/15 rounded-xl text-sm text-slate-stone focus:outline-none focus:border-slate-stone/40"
                />
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setDraft(path, e.target.value)}
                  className="w-full px-4 py-3 bg-mist-white border border-slate-stone/15 rounded-xl text-sm text-slate-stone focus:outline-none focus:border-slate-stone/40"
                />
              )}

              {coded !== undefined && String(coded) !== String(value) && (
                <p className="mt-1.5 text-[11px] text-stone-gray/80">
                  Texte d'origine : {String(coded).slice(0, 120)}{String(coded).length > 120 ? '…' : ''}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || dirtyCount === 0}
          className="px-8 py-3 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest font-medium disabled:opacity-40 hover:bg-slate-stone/90 transition-colors"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <span className="text-xs text-stone-gray">
          {dirtyCount === 0 ? 'Aucune modification en attente' : `${dirtyCount} modification(s) en attente`}
        </span>
      </div>
    </div>
  );
};

export default ContentEditor;

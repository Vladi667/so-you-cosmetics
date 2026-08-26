import React, { useState, useEffect, useMemo } from 'react';
import translations, { DEFAULT_LANGUAGE, LANGUAGES } from '../../i18n/translations';

// The sections she can rewrite, in the order they appear on the site.
//
// Deliberately absent: `terms` and `privacy` (legal text does not belong behind
// a free-text form), and `nav`, `drawer`, `catalog`, `product`, `search`,
// `loader`, `category`, `categories` (interface labels — changing them breaks
// consistency without giving her anything). That exclusion is what keeps this
// panel to ~139 fields per language instead of 317.
// Every section of the site, so nothing on the page is beyond her reach.
//
// An earlier draft withheld the legal pages and the interface labels, reasoning
// that CGV do not belong behind a free-text form and that renaming a button
// breaks consistency. Both remain true as *advice* — they were the wrong thing
// to enforce by hiding the fields. Where a section carries a real risk it now
// says so and lets her decide, which is what an owner of her own site should
// get. The coded default stays one click away in every case.
const SECTIONS = [
  { key: 'hero', label: 'Accueil — bannière', page: '/' },
  { key: 'brandEssence', label: 'Accueil — bandeau défilant', page: '/' },
  { key: 'signature', label: 'Accueil — coups de cœur', page: '/' },
  { key: 'handmade', label: 'Accueil — philosophie', page: '/' },
  { key: 'ingredients', label: 'Accueil — ingrédients', page: '/' },
  { key: 'workshopsSection', label: 'Accueil — ateliers', page: '/' },
  { key: 'about', label: 'Page « Notre histoire »', page: '/about' },
  { key: 'workshopsPage', label: 'Page « Ateliers »', page: '/workshops' },
  { key: 'contact', label: 'Page « Contact »', page: '/contact' },
  { key: 'footer', label: 'Pied de page', page: '/' },
  { key: 'nav', label: 'Menu de navigation', page: '/' },
  { key: 'catalog', label: 'Boutique — liste et filtres', page: '/' },
  {
    key: 'categories',
    label: 'Boutique — noms des catégories',
    page: '/',
    warning:
      "Ces noms servent aussi de repères dans le catalogue. Traduisez-les, mais gardez le sens : un nom trop éloigné rend une catégorie difficile à retrouver.",
  },
  { key: 'category', label: 'Boutique — page catégorie', page: '/' },
  { key: 'product', label: 'Fiche produit', page: '/' },
  { key: 'search', label: 'Recherche', page: '/' },
  { key: 'drawer', label: 'Panier et favoris', page: '/' },
  { key: 'loader', label: 'Écran de chargement', page: '/' },
  { key: 'legal', label: 'Mentions légales — libellés', page: '/terms' },
  {
    key: 'terms',
    label: 'Conditions générales de vente',
    page: '/terms',
    warning:
      "Texte juridique. Il vous engage vis-à-vis de vos clients : modifiez-le en connaissance de cause, et faites-le relire si le changement porte sur les prix, la livraison, les retours ou la responsabilité.",
  },
  {
    key: 'privacy',
    label: 'Politique de confidentialité',
    page: '/privacy',
    warning:
      "Texte juridique, encadré par la LPD suisse. Il décrit ce que vous faites réellement des données de vos clients : ne lui faites pas dire autre chose que la réalité.",
  },
];

// Fields where the design has little slack: a heading set in display type, or a
// button whose pill is sized to its label. A warning is honest about what it
// knows — it flags a length the layout was not drawn for, it cannot promise the
// text will break. Length guidance helps; it does not remove the problem.
const TIGHT = /(title|Line\d|cta\d|brand|eyebrow|label|add|scroll)/i;

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

// The lists inside a section, as dot-paths. Excluding the legal pages dropped
// this from 31 lists across the file to 5 in the sections she can reach, and all
// five are shallow: three of {title, text}, one of {label, value}, one of plain
// strings. That is why list editing is an afternoon rather than a project.
function collectLists(node, prefix, out) {
  if (Array.isArray(node)) {
    out.push(prefix);
    return out;
  }
  if (node === null || typeof node !== 'object') return out;
  for (const [key, value] of Object.entries(node)) {
    collectLists(value, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

const resolve = (obj, path) =>
  path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);

// An item is either a plain string or a flat object; the shape comes from the
// coded default so a list she has never touched still knows what a new row
// looks like.
const blankLike = (sample) => {
  if (typeof sample === 'string') return '';
  if (Array.isArray(sample)) return [];
  if (sample && typeof sample === 'object') {
    // Follow the shape field by field: a new legal section needs body to be an
    // empty array, not an empty string, or the paragraph editor would refuse it
    // the moment she adds a row.
    return Object.entries(sample).reduce(
      (acc, [k, v]) => ({ ...acc, [k]: blankLike(v) }),
      {}
    );
  }
  return '';
};

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

  const listPaths = useMemo(
    () => collectLists(translations[DEFAULT_LANGUAGE][section], section, []),
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

  // Ce que le site montre pour ce champ dans une AUTRE langue que celle
  // affichée — on lit l'anglais pendant qu'elle est sur l'allemand. Un brouillon
  // non enregistré compte : elle vient peut-être d'écrire l'anglais à l'instant.
  const valeurDansLangue = (lang, path) => {
    const cle = `${lang}::${path}`;
    if (Object.prototype.hasOwnProperty.call(drafts, cle)) {
      return drafts[cle] === '__RESET__' ? '' : drafts[cle];
    }
    const sien = overrides[lang] && overrides[lang][path];
    if (sien != null && sien !== '') return sien;
    const code = resolve(translations[lang], path);
    return code !== undefined ? code : '';
  };

  // Traduire toute la section depuis l'anglais.
  //
  // Elle écrit le français et l'anglais ; l'allemand se déduit du second. Rien
  // n'est enregistré : les traductions viennent remplir le formulaire, elle les
  // relit, et c'est elle qui décide. Une machine ne publie pas seule dans une
  // langue que personne ne relit.
  const [traduction, setTraduction] = useState('');

  const traduireDepuisAnglais = async () => {
    // `paths` porte les chemins des textes simples de la section. Les listes
    // ont leur propre edition et ne passent pas par ici.
    const aRemplir = paths.filter((c) => {
      const v = valeurDansLangue('en', c);
      return typeof v === 'string' && v.trim();
    });
    if (aRemplir.length === 0) {
      setStatus({ success: '', error: "Rien à traduire : les textes anglais de cette section sont vides." });
      return;
    }
    // Ce qui porte déjà de l'allemand écrit par elle ne sera pas écrasé sans
    // qu'elle le dise : son texte vaut mieux qu'une machine.
    const dejaEcrits = aRemplir.filter((c) => hasOverrideIn('de', c));
    if (dejaEcrits.length > 0) {
      const ok = window.confirm(
        `${dejaEcrits.length} texte(s) allemand(s) ont déjà été écrits dans cette section.

`
        + `Les remplacer par la traduction de l'anglais ?`
      );
      if (!ok) return;
    }

    setTraduction('en cours');
    setStatus({ success: '', error: '' });
    try {
      const r = await fetch('/api/admin/traduire', {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify({ textes: aRemplir.map((c) => valeurDansLangue('en', c)), source: 'EN', cible: 'DE' }),
      });
      const d = await r.json();
      if (!r.ok) {
        setStatus({ success: '', error: [d.error, d['détail']].filter(Boolean).join(' ') });
        setTraduction('');
        return;
      }
      const suivants = {};
      aRemplir.forEach((c, i) => {
        const t = (d.traductions || [])[i];
        if (t) suivants[`de::${c}`] = t;
      });
      setDrafts((prev) => ({ ...prev, ...suivants }));
      setStatus({
        success: `${Object.keys(suivants).length} texte(s) traduit(s) depuis l'anglais. Relisez-les, puis enregistrez.`,
        error: '',
      });
    } catch {
      setStatus({ success: '', error: "La traduction n'a pas abouti. Réessayez." });
    } finally {
      setTraduction('');
    }
  };

  const currentValue = (path) => {
    const key = draftKey(path);
    return Object.prototype.hasOwnProperty.call(drafts, key) ? drafts[key] : savedValue(path);
  };

  const hasOverrideIn = (lang, path) => {
    const own = overrides[lang] && overrides[lang][path];
    return Array.isArray(own) ? own.length > 0 : own != null && own !== '';
  };

  const isOverridden = (path) => hasOverrideIn(language, path);

  // Which languages she has rewritten this field in, and which she has not.
  //
  // This is the failure the whole phase exists for: rewriting a text in French
  // leaves English and German showing the *old* coded wording, and nothing on
  // the site says so. The visitor sees stale copy, the shop looks neglected in
  // two of its three languages, and it is invisible from the admin unless the
  // editor says it out loud. Falling back silently is the correct behaviour for
  // the site and the wrong behaviour for the person maintaining it.
  const coverage = (path) => {
    const done = LANGUAGES.filter((l) => hasOverrideIn(l.code, path)).map((l) => l.code);
    const missing = LANGUAGES.filter((l) => !hasOverrideIn(l.code, path)).map((l) => l.code);
    return { done, missing, partial: done.length > 0 && missing.length > 0 };
  };

  const partialPaths = useMemo(
    () => [...paths, ...listPaths].filter((p) => coverage(p).partial),
    [paths, listPaths, overrides] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const isDirty = (path) => {
    const key = draftKey(path);
    return Object.prototype.hasOwnProperty.call(drafts, key) && drafts[key] !== savedValue(path);
  };

  // The list her edits start from: her saved version, else the coded one for
  // this language, else French.
  const savedList = (path) => {
    const own = overrides[language] && overrides[language][path];
    if (Array.isArray(own)) return own;
    const coded = resolve(translations[language], path);
    if (Array.isArray(coded)) return coded;
    const fr = resolve(translations[DEFAULT_LANGUAGE], path);
    return Array.isArray(fr) ? fr : [];
  };

  const currentList = (path) => {
    const key = draftKey(path);
    const draft = drafts[key];
    if (draft === '__RESET__') return savedListDefault(path);
    return Array.isArray(draft) ? draft : savedList(path);
  };

  // What Rétablir returns a list to: the code, never her previous save.
  const savedListDefault = (path) => {
    const coded = resolve(translations[language], path);
    if (Array.isArray(coded)) return coded;
    const fr = resolve(translations[DEFAULT_LANGUAGE], path);
    return Array.isArray(fr) ? fr : [];
  };

  const setList = (path, next) => {
    setStatus({ success: '', error: '' });
    setDrafts((prev) => ({ ...prev, [draftKey(path)]: next }));
  };

  // Arrays are compared by value: two arrays holding the same rows are never
  // the same reference, so a reference check would report every list as
  // unsaved for ever and leave the Enregistrer button permanently lit.
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const dirtyCount = Object.keys(drafts).filter((k) => {
    const [lang, ...rest] = k.split('::');
    const path = rest.join('::');
    const own = overrides[lang] && overrides[lang][path];
    const hasOwn = Array.isArray(own) ? true : own != null && own !== '';
    const saved = hasOwn
      ? own
      : (resolve(translations[lang], path) ?? resolve(translations[DEFAULT_LANGUAGE], path) ?? '');
    if (drafts[k] === '__RESET__') return hasOwn;
    return !same(drafts[k], saved);
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
      // Restoring the coded default by hand — retyping the text, or putting a
      // list back the way it was — should clear the override rather than store
      // a duplicate of what the code already says. Otherwise the day we improve
      // a default, her frozen copy of the old one would keep it off the site.
      else if (same(value, coded)) next = '';
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

      {(SECTIONS.find((s) => s.key === section) || {}).warning && (
        <div className="mb-6 p-4 bg-mist-white border border-slate-stone/15 rounded-xl text-sm text-slate-stone">
          <strong className="font-medium">À savoir avant de modifier.</strong>{' '}
          {(SECTIONS.find((s) => s.key === section) || {}).warning}
        </div>
      )}

      {partialPaths.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
          <strong className="font-medium">
            {partialPaths.length} texte(s) de cette section réécrit(s) dans une langue seulement.
          </strong>{' '}
          Dans les autres langues, le site affiche encore l'ancienne version. Basculez la langue
          ci-dessous pour les compléter.
        </div>
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

        {/* Elle écrit le français et l'anglais ; l'allemand se déduit du second.
            Le bouton ne paraît que sur l'allemand — c'est la seule langue qu'on
            propose de déduire, et la seule qu'elle ne relit pas elle-même.
            Rien n'est enregistré : les traductions remplissent le formulaire,
            elle les relit, elle décide. */}
        {language === 'de' && (
          <button
            type="button"
            onClick={traduireDepuisAnglais}
            disabled={traduction === 'en cours'}
            className="px-4 py-2 rounded-xl border border-slate-stone/15 bg-white text-xs uppercase tracking-widest text-slate-stone hover:bg-mist-white disabled:opacity-50 transition-colors"
            title="Remplit les textes allemands de cette section à partir de leur version anglaise. Rien n'est enregistré avant votre relecture."
          >
            {traduction === 'en cours' ? 'Traduction…' : "Traduire depuis l'anglais"}
          </button>
        )}

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
                  {coverage(path).partial && (
                    <span className="ml-2 normal-case tracking-normal text-[11px] text-amber-700">
                      ancien texte encore affiché en {coverage(path).missing.join(', ').toUpperCase()}
                    </span>
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

              {TIGHT.test(path) && String(coded || '').length > 0 &&
                String(value).length > String(coded).length * 1.6 && (
                <p className="mt-1 text-[11px] text-amber-700">
                  {String(value).length} caractères contre {String(coded).length} à l'origine —
                  la mise en page n'a pas été dessinée pour un texte aussi long. Vérifiez la page.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {listPaths.map((path) => {
        const items = currentList(path);
        const coded = savedListDefault(path);
        const modifie = Array.isArray(overrides[language] && overrides[language][path]);
        const sample = coded[0] !== undefined ? coded[0] : (items[0] !== undefined ? items[0] : '');
        const champs = typeof sample === 'string' ? null : Object.keys(sample || {});

        const remplace = (next) => setList(path, next);
        const deplace = (i, delta) => {
          const j = i + delta;
          if (j < 0 || j >= items.length) return;
          const next = items.slice();
          [next[i], next[j]] = [next[j], next[i]];
          remplace(next);
        };

        return (
          <div key={path} className="mt-6 bg-white rounded-3xl border border-slate-stone/5 p-6 sm:p-8 shadow-sm">
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <h2 className="font-serif text-xl text-slate-stone">{prettify(path)}</h2>
              {modifie && (
                <button
                  type="button"
                  onClick={() => resetField(path)}
                  className="text-[11px] text-stone-gray hover:text-slate-stone underline underline-offset-2"
                >
                  Rétablir la liste
                </button>
              )}
            </div>
            <p className="text-xs text-stone-gray mb-5">
              {items.length} élément(s){modifie ? ' · modifiée' : ''}
              {coverage(path).partial && (
                <span className="ml-2 text-amber-700">
                  · ancienne liste encore affichée en {coverage(path).missing.join(', ').toUpperCase()}
                </span>
              )}
            </p>

            <div className="space-y-4">
              {items.map((item, i) => (
                <div key={i} className="p-4 bg-mist-white rounded-2xl border border-slate-stone/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] uppercase tracking-widest text-stone-gray">#{i + 1}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => deplace(i, -1)} disabled={i === 0}
                        aria-label="Monter"
                        className="w-7 h-7 rounded-lg bg-white border border-slate-stone/10 text-slate-stone disabled:opacity-30 hover:bg-slate-stone hover:text-white transition-colors">↑</button>
                      <button type="button" onClick={() => deplace(i, 1)} disabled={i === items.length - 1}
                        aria-label="Descendre"
                        className="w-7 h-7 rounded-lg bg-white border border-slate-stone/10 text-slate-stone disabled:opacity-30 hover:bg-slate-stone hover:text-white transition-colors">↓</button>
                      <button type="button" onClick={() => remplace(items.filter((_, k) => k !== i))}
                        aria-label="Supprimer"
                        className="w-7 h-7 rounded-lg bg-white border border-red-200 text-red-500 hover:bg-red-500 hover:text-white transition-colors">×</button>
                    </div>
                  </div>

                  {champs === null ? (
                    <input
                      type="text"
                      value={item ?? ''}
                      onChange={(e) => remplace(items.map((v, k) => (k === i ? e.target.value : v)))}
                      className="w-full px-4 py-2.5 bg-white border border-slate-stone/15 rounded-xl text-sm text-slate-stone focus:outline-none focus:border-slate-stone/40"
                    />
                  ) : (
                    <div className="space-y-2">
                      {champs.map((champ) => {
                        const valeur = item && item[champ];

                        // The legal pages hold {heading, body: [paragraphs]} —
                        // the one shape a flat field cannot express. Rendering
                        // the array as text would turn her CGV into
                        // "[object Object]" on save, so paragraphs get their own
                        // small editor rather than being flattened.
                        if (Array.isArray(valeur)) {
                          const majParas = (next) =>
                            remplace(items.map((v, k) => (k === i ? { ...v, [champ]: next } : v)));
                          return (
                            <div key={champ}>
                              <label className="block text-[11px] uppercase tracking-widest text-stone-gray mb-1">
                                {prettify(champ)} — {valeur.length} paragraphe(s)
                              </label>
                              <div className="space-y-2">
                                {valeur.map((para, pi) => (
                                  <div key={pi} className="flex gap-2">
                                    <textarea
                                      rows={String(para || '').length > 90 ? 3 : 2}
                                      value={para || ''}
                                      onChange={(e) => majParas(valeur.map((p, k) => (k === pi ? e.target.value : p)))}
                                      className="flex-1 px-4 py-2.5 bg-white border border-slate-stone/15 rounded-xl text-sm text-slate-stone focus:outline-none focus:border-slate-stone/40"
                                    />
                                    <div className="flex flex-col gap-1">
                                      <button type="button" aria-label="Monter le paragraphe" disabled={pi === 0}
                                        onClick={() => { const n = valeur.slice(); [n[pi], n[pi - 1]] = [n[pi - 1], n[pi]]; majParas(n); }}
                                        className="w-7 h-7 rounded-lg bg-white border border-slate-stone/10 text-slate-stone disabled:opacity-30 hover:bg-slate-stone hover:text-white transition-colors">↑</button>
                                      <button type="button" aria-label="Supprimer le paragraphe"
                                        onClick={() => majParas(valeur.filter((_, k) => k !== pi))}
                                        className="w-7 h-7 rounded-lg bg-white border border-red-200 text-red-500 hover:bg-red-500 hover:text-white transition-colors">×</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => majParas([...valeur, ''])}
                                className="mt-2 px-4 py-1.5 border border-slate-stone/20 text-stone-gray rounded-full text-[11px] uppercase tracking-widest hover:bg-slate-stone hover:text-white transition-colors"
                              >
                                Ajouter un paragraphe
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div key={champ}>
                            <label className="block text-[11px] uppercase tracking-widest text-stone-gray mb-1">{prettify(champ)}</label>
                            <textarea
                              rows={String(valeur || '').length > 70 ? 3 : 1}
                              value={valeur || ''}
                              onChange={(e) =>
                                remplace(items.map((v, k) => (k === i ? { ...v, [champ]: e.target.value } : v)))
                              }
                              className="w-full px-4 py-2.5 bg-white border border-slate-stone/15 rounded-xl text-sm text-slate-stone focus:outline-none focus:border-slate-stone/40"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => remplace([...items, blankLike(sample)])}
              className="mt-4 px-5 py-2 border border-slate-stone/20 text-slate-stone rounded-full text-xs uppercase tracking-widest hover:bg-slate-stone hover:text-white transition-colors"
            >
              Ajouter un élément
            </button>
          </div>
        );
      })}

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

        <a
          href={(SECTIONS.find((s) => s.key === section) || {}).page || '/'}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-stone-gray hover:text-slate-stone underline underline-offset-2"
        >
          Voir la page ↗
        </a>
      </div>
    </div>
  );
};

export default ContentEditor;

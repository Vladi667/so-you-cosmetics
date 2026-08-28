import React, { useState, useEffect } from 'react';
import RichTextEditor from './RichTextEditor';

const VIDE = { id: null, title: '', excerpt: '', body: '', image_url: '', language: 'fr', published: false, date: '' };

// "Un accès administrateur me permettant de rédiger, modifier, annuler et
// publier moi-même mes articles" — her words. Draft is a real state, not an
// article that happens to be missing: she can write across several sittings and
// publish when it is ready.
const JournalEditor = ({ fetchHeaders }) => {
  const [articles, setArticles] = useState([]);
  const [form, setForm] = useState(VIDE);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ success: '', error: '' });

  const charger = () =>
    fetch('/api/admin/articles', { headers: fetchHeaders })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => setArticles(Array.isArray(d) ? d : []))
      .catch(() => setStatus({ success: '', error: 'Chargement impossible.' }));

  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enregistrer = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setStatus({ success: '', error: 'Un titre est nécessaire.' });
      return;
    }
    setSaving(true);
    setStatus({ success: '', error: '' });
    const nouveau = !form.id;
    fetch(nouveau ? '/api/admin/articles' : `/api/admin/articles/${form.id}`, {
      method: nouveau ? 'POST' : 'PUT',
      headers: fetchHeaders,
      body: JSON.stringify(form),
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(() => {
        setForm(VIDE);
        setStatus({ success: nouveau ? 'Article créé.' : 'Article enregistré.', error: '' });
        return charger();
      })
      .catch(() => setStatus({ success: '', error: "L'enregistrement a échoué." }))
      .finally(() => setSaving(false));
  };

  const supprimer = (a) => {
    // Une suppression d'article n'est pas rattrapable : elle emporte le texte et
    // l'adresse partagée. On demande confirmation, en nommant l'article.
    if (!window.confirm(`Supprimer définitivement « ${a.title} » ?`)) return;
    fetch(`/api/admin/articles/${a.id}`, { method: 'DELETE', headers: fetchHeaders })
      .then((r) => { if (!r.ok) throw new Error(); return charger(); })
      .then(() => setStatus({ success: 'Article supprimé.', error: '' }))
      .catch(() => setStatus({ success: '', error: 'Suppression impossible.' }));
  };

  const basculerPublication = (a) => {
    fetch(`/api/admin/articles/${a.id}`, {
      method: 'PUT',
      headers: fetchHeaders,
      body: JSON.stringify({ published: !a.published }),
    })
      .then((r) => { if (!r.ok) throw new Error(); return charger(); })
      .then(() => setStatus({ success: a.published ? 'Article dépublié.' : 'Article publié.', error: '' }))
      .catch(() => setStatus({ success: '', error: 'Opération impossible.' }));
  };

  const champ = "w-full px-4 py-2.5 bg-mist-white border border-slate-stone/15 rounded-xl text-sm text-slate-stone focus:outline-none focus:border-slate-stone/40";

  return (
    <div className="max-w-4xl">
      <h1 className="font-serif text-3xl md:text-4xl text-slate-stone mb-2">Journal</h1>
      <p className="text-sm text-stone-gray mb-8">
        Rédigez, modifiez et publiez vos articles. Un brouillon n'est visible que d'ici :
        tant qu'il n'est pas publié, personne ne peut y accéder, même avec son adresse.
      </p>

      {status.success && <div className="mb-6 p-4 bg-green-50 text-green-700 border border-green-100 rounded-xl text-sm font-medium">{status.success}</div>}
      {status.error && <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm">{status.error}</div>}

      <form onSubmit={enregistrer} className="bg-white rounded-3xl border border-slate-stone/5 p-6 sm:p-8 shadow-sm mb-8 space-y-4">
        <h2 className="font-serif text-xl text-slate-stone">{form.id ? "Modifier l'article" : 'Nouvel article'}</h2>

        <input type="text" placeholder="Titre" value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })} className={champ} />

        <input type="text" placeholder="Accroche (une phrase, affichée dans la liste)" value={form.excerpt}
          onChange={(e) => setForm({ ...form, excerpt: e.target.value })} className={champ} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input type="text" placeholder="URL de l'image" value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })} className={champ} />
          <input type="date" value={form.date || ''}
            onChange={(e) => setForm({ ...form, date: e.target.value })} className={champ} />
          <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className={champ}>
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
        </div>

        <RichTextEditor
          value={form.body}
          onChange={(html) => setForm({ ...form, body: html })}
          placeholder="Votre article…"
          minHeight={260}
        />

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-stone">
            <input type="checkbox" checked={Boolean(form.published)}
              onChange={(e) => setForm({ ...form, published: e.target.checked })} />
            Publier maintenant
          </label>
          <button type="submit" disabled={saving}
            className="px-8 py-3 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest font-medium disabled:opacity-40 hover:bg-slate-stone/90 transition-colors">
            {saving ? 'Enregistrement…' : form.id ? 'Enregistrer' : "Créer l'article"}
          </button>
          {form.id && (
            <button type="button" onClick={() => { setForm(VIDE); setStatus({ success: '', error: '' }); }}
              className="text-xs text-stone-gray hover:text-slate-stone underline underline-offset-2">
              Annuler la modification
            </button>
          )}
        </div>
      </form>

      <h2 className="font-serif text-xl text-slate-stone mb-4">{articles.length} article(s)</h2>
      <div className="space-y-3">
        {articles.length === 0 && <p className="text-sm text-stone-gray">Aucun article pour le moment.</p>}
        {articles.map((a) => (
          <div key={a.id} className="bg-white rounded-2xl border border-slate-stone/5 p-4 flex flex-wrap items-center gap-3 shadow-sm">
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${a.published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {a.published ? 'Publié' : 'Brouillon'}
            </span>
            <span className="flex-1 min-w-[12rem]">
              <span className="block text-sm text-slate-stone">{a.title}</span>
              <span className="block text-[11px] text-stone-gray">{a.date} · /journal/{a.slug} · {String(a.language || 'fr').toUpperCase()}</span>
            </span>
            <button type="button" onClick={() => { setForm({ ...VIDE, ...a }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="px-4 py-1.5 border border-slate-stone/20 text-slate-stone rounded-full text-[11px] uppercase tracking-widest hover:bg-slate-stone hover:text-white transition-colors">
              Modifier
            </button>
            <button type="button" onClick={() => basculerPublication(a)}
              className="px-4 py-1.5 border border-slate-stone/20 text-slate-stone rounded-full text-[11px] uppercase tracking-widest hover:bg-slate-stone hover:text-white transition-colors">
              {a.published ? 'Dépublier' : 'Publier'}
            </button>
            <button type="button" onClick={() => supprimer(a)}
              className="px-4 py-1.5 border border-red-200 text-red-500 rounded-full text-[11px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors">
              Supprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JournalEditor;

import { useState, useEffect, useMemo, Fragment } from 'react';

// Le fichier clients, en fiches : historique des commandes et des ateliers,
// notes internes et tags, recherche, filtres, export.
//
// Le total ne compte que ce qui a été PAYÉ. L'ancien total additionnait aussi
// les paniers abandonnés et les commandes annulées : une cliente qui avait
// hésité trois fois paraissait trois fois plus fidèle qu'elle ne l'était.

const chf = (n) => `CHF ${Number(n || 0).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const jour = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' });
};
const champ = 'px-3 py-2 border rounded text-sm bg-white';

function Fiche({ f, fetchHeaders, onMaj, onOuvrirCommande }) {
  const [notes, setNotes] = useState(f.notes);
  const [tags, setTags] = useState(f.tags.join(', '));
  const [etat, setEtat] = useState('');
  const modifiee = notes !== f.notes || tags !== f.tags.join(', ');

  const enregistrer = () => {
    setEtat('…');
    fetch(`/api/admin/crm/${encodeURIComponent(f.email)}`, {
      method: 'PUT',
      headers: { ...fetchHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, tags }),
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((fiche) => { onMaj(f.email, fiche); setTags(fiche.tags.join(', ')); setEtat('Enregistré'); setTimeout(() => setEtat(''), 1500); })
      .catch(() => setEtat('Échec de l’enregistrement'));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 flex flex-col gap-3">
        <h3 className="text-[11px] uppercase tracking-widest text-stone-gray">Commandes</h3>
        {f.commandes.length === 0 && <p className="text-xs text-stone-gray">Aucune commande en ligne.</p>}
        {f.commandes.map((o) => (
          <div key={o.id} className="rounded-xl border border-slate-stone/10 bg-white p-3">
            <div className="flex items-baseline justify-between flex-wrap gap-2 text-sm">
              <span className="text-slate-stone">{jour(o.date)} <span className="ml-1 font-mono text-[11px] text-stone-gray">{o.id}</span></span>
              <span className="tabular-nums">
                {chf(o.total)}
                <span className={`ml-2 text-[10px] uppercase tracking-widest ${o.payee ? 'text-[#4A5B39]' : 'text-stone-gray'}`}>{o.statut}</span>
              </span>
            </div>
            <p className="text-xs text-stone-gray mt-1">{o.articles.map((a) => `${a.qte > 1 ? a.qte + ' × ' : ''}${a.nom}`).join(' · ')}</p>
            <button type="button" onClick={() => onOuvrirCommande(o.id)} className="mt-2 text-[11px] uppercase tracking-widest text-slate-stone underline underline-offset-4">
              Ouvrir le détail
            </button>
          </div>
        ))}
        <h3 className="text-[11px] uppercase tracking-widest text-stone-gray mt-2">Ateliers</h3>
        {f.ateliers.length === 0 && <p className="text-xs text-stone-gray">Aucune réservation d’atelier.</p>}
        {f.ateliers.map((a) => (
          <p key={a.id} className="text-sm text-slate-stone">
            {a.atelier} <span className="text-xs text-stone-gray">· {a.date || jour(a.reserve)} · {a.places} place(s)</span>
          </p>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <label>
          <span className="block text-[11px] uppercase tracking-widest text-stone-gray mb-1">Tags</span>
          <input className={`${champ} w-full`} value={tags} placeholder="fidèle, peau sensible, entreprise" onChange={(e) => setTags(e.target.value)} />
          <span className="block text-[11px] text-stone-gray mt-1">Séparés par des virgules.</span>
        </label>
        <label>
          <span className="block text-[11px] uppercase tracking-widest text-stone-gray mb-1">Notes internes</span>
          <textarea className={`${champ} w-full`} rows={5} value={notes} placeholder="Préférences, allergies, cadeau prévu…" onChange={(e) => setNotes(e.target.value)} />
          <span className="block text-[11px] text-stone-gray mt-1">Visibles ici seulement, jamais par la cliente.</span>
        </label>
        <div className="flex items-center gap-3">
          <button type="button" disabled={!modifiee} onClick={enregistrer}
            className="press px-5 py-2 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest disabled:opacity-40">
            Enregistrer
          </button>
          <span className="text-xs text-stone-gray">{etat}</span>
        </div>
      </div>
    </div>
  );
}

const FichierClients = ({ fetchHeaders, onEcrire, onOuvrirCommande }) => {
  const [liste, setListe] = useState(null);
  const [erreur, setErreur] = useState('');
  const [q, setQ] = useState('');
  const [filtre, setFiltre] = useState('tous');
  const [tag, setTag] = useState('');
  const [provenance, setProvenance] = useState('');
  const [tri, setTri] = useState('recent');
  const [ouverte, setOuverte] = useState(null);

  useEffect(() => {
    fetch('/api/admin/crm', { headers: fetchHeaders })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setListe)
      .catch(() => setErreur('Le fichier clients n’a pas pu être chargé.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tousTags = useMemo(() => [...new Set((liste || []).flatMap((f) => f.tags))].sort((a, b) => a.localeCompare(b, 'fr')), [liste]);
  const toutesProvenances = useMemo(() => [...new Set((liste || []).map((f) => f.provenance).filter(Boolean))].sort(), [liste]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    const l = (liste || []).filter((f) => {
      if (t && ![f.nom, f.email, f.telephone, f.notes, ...f.tags].some((v) => String(v || '').toLowerCase().includes(t))) return false;
      if (filtre === 'acheteuses' && f.nbPayees === 0) return false;
      if (filtre === 'ateliers' && f.ateliers.length === 0) return false;
      if (filtre === 'nonPayees' && f.nbNonPayees === 0) return false;
      if (filtre === 'infolettre' && !f.abonnee) return false;
      if (filtre === 'compte' && !f.compte) return false;
      if (filtre === 'fideles' && f.nbPayees < 2) return false;
      if (tag && !f.tags.includes(tag)) return false;
      if (provenance && f.provenance !== provenance) return false;
      return true;
    });
    const parNom = (a, b) => String(a.nom || a.email).localeCompare(String(b.nom || b.email), 'fr', { sensitivity: 'base' });
    if (tri === 'nom') return l.sort(parNom);
    if (tri === 'total') return l.sort((a, b) => b.totalPaye - a.totalPaye || parNom(a, b));
    return l.sort((a, b) => String(b.derniere).localeCompare(String(a.derniere)));
  }, [liste, q, filtre, tag, provenance, tri]);

  const majFiche = (email, fiche) => setListe((l) => l.map((f) => (f.email === email ? { ...f, notes: fiche.notes, tags: fiche.tags } : f)));

  const exporter = () => {
    fetch('/api/admin/crm/export.csv', { headers: fetchHeaders })
      .then((r) => { if (!r.ok) throw new Error(); return r.blob(); })
      .then((b) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'clients-so-you.csv';
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => alert('L’export n’a pas pu être généré.'));
  };

  if (erreur) return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>;
  if (!liste) return <div className="py-24 text-center text-stone-gray/60">Chargement…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <input className={`${champ} w-full pr-9`} placeholder="Nom, e-mail, téléphone, tag, note…" value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setQ(''); }} />
          {q && (
            <button type="button" aria-label="Effacer la recherche" onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-stone-gray hover:bg-mist-white">×</button>
          )}
        </div>
        <select className={champ} value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Filtre">
          <option value="tous">Toutes et tous</option>
          <option value="acheteuses">A commandé et payé</option>
          <option value="fideles">Deux commandes ou plus</option>
          <option value="ateliers">A réservé un atelier</option>
          <option value="nonPayees">Panier non payé</option>
          <option value="infolettre">Inscrite à l’infolettre</option>
          <option value="compte">A un compte</option>
        </select>
        {tousTags.length > 0 && (
          <select className={champ} value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag">
            <option value="">Tous les tags</option>
            {tousTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {toutesProvenances.length > 0 && (
          <select className={champ} value={provenance} onChange={(e) => setProvenance(e.target.value)} aria-label="Provenance">
            <option value="">Toutes provenances</option>
            {toutesProvenances.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <select className={champ} value={tri} onChange={(e) => setTri(e.target.value)} aria-label="Tri">
          <option value="recent">Plus récentes d’abord</option>
          <option value="total">Total payé</option>
          <option value="nom">Nom, A → Z</option>
        </select>
        <button type="button" onClick={exporter} className="ml-auto px-4 py-2 bg-slate-stone text-white rounded-full text-[11px] uppercase tracking-widest">
          Exporter en CSV
        </button>
      </div>
      <p className="text-xs text-stone-gray">{visibles.length} sur {liste.length} personne(s).</p>

      {visibles.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-stone/5 text-stone-gray">Personne ne correspond.</div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-stone/5 overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-stone/5 text-xs text-stone-gray tracking-wider uppercase font-bold bg-mist-white/30">
                <th className="p-4">Nom</th>
                <th className="p-4 text-center">Commandes</th>
                <th className="p-4 text-center">Ateliers</th>
                <th className="p-4 text-right">Total payé</th>
                <th className="p-4">Dernière fois</th>
                <th className="p-4">Tags</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => {
                const estOuverte = ouverte === f.email;
                return (
                  <Fragment key={f.email}>
                    <tr className="border-b border-slate-stone/5 hover:bg-mist-white/20 text-sm text-slate-stone font-light">
                      <td className="p-4">
                        <button type="button" onClick={() => setOuverte(estOuverte ? null : f.email)} aria-expanded={estOuverte} className="text-left">
                          <span className="font-medium underline underline-offset-4 decoration-slate-stone/20 hover:decoration-slate-stone">{f.nom || 'Sans nom'}</span>
                          <span className="block font-mono text-[11px] text-stone-gray">{f.email}</span>
                        </button>
                        <span className="flex gap-1 mt-1">
                          {f.abonnee && <span className="text-[9px] uppercase tracking-widest bg-mist-white px-1.5 py-0.5 rounded">infolettre</span>}
                          {f.compte && <span className="text-[9px] uppercase tracking-widest bg-mist-white px-1.5 py-0.5 rounded">compte</span>}
                          {f.provenance && <span className="text-[9px] uppercase tracking-widest bg-mist-white px-1.5 py-0.5 rounded">{f.provenance}</span>}
                          {f.notes && <span className="text-[9px] uppercase tracking-widest bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded" title={f.notes}>note</span>}
                        </span>
                      </td>
                      <td className="p-4 text-center tabular-nums">
                        {f.nbPayees}
                        {f.nbNonPayees > 0 && <span className="block text-[10px] text-stone-gray">+{f.nbNonPayees} non payée(s)</span>}
                      </td>
                      <td className="p-4 text-center tabular-nums">{f.ateliers.length}</td>
                      <td className="p-4 text-right tabular-nums whitespace-nowrap">{chf(f.totalPaye)}</td>
                      <td className="p-4 text-xs text-stone-gray whitespace-nowrap">{jour(f.derniere)}</td>
                      <td className="p-4">
                        <span className="flex flex-wrap gap-1">
                          {f.tags.map((t) => <span key={t} className="text-[10px] bg-ivory border border-slate-stone/10 px-2 py-0.5 rounded-full">{t}</span>)}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button type="button" onClick={() => onEcrire(f.email, f.nom)}
                          className="px-3 py-1.5 bg-mist-white hover:bg-slate-stone hover:text-white rounded-lg text-xs tracking-wider uppercase transition-all">
                          ✉️ Écrire
                        </button>
                      </td>
                    </tr>
                    {estOuverte && (
                      <tr className="border-b border-slate-stone/5 bg-mist-white/40">
                        <td colSpan={7} className="px-4 py-5">
                          <Fiche f={f} fetchHeaders={fetchHeaders} onMaj={majFiche} onOuvrirCommande={onOuvrirCommande} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FichierClients;

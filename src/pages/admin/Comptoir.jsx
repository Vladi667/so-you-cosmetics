import { useState, useEffect, useMemo } from 'react';
import Retraits from './Retraits';

// Le mode comptoir : ce dont on a besoin debout derrière la caisse, sur un
// téléphone ou une tablette.
//
//   · Ouvrir, fermer pour la journée, partir en vacances — d'un geste, et le
//     site suit (statut « Ouvert / Fermé » et message d'absence).
//   · Retrouver un produit pour conseiller : prix, formats, stock, peau,
//     composition.
//   · Remettre les commandes à retirer.
//   · Clôturer la journée : la caisse par moyen de paiement, le site, et ce
//     qui attend demain.

const chf = (n) => `CHF ${Number(n || 0).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sansAccents = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const texteBrut = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function Carte({ titre, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-stone/10 bg-white p-5 ${className}`}>
      <h2 className="font-serif text-xl text-slate-stone mb-3">{titre}</h2>
      {children}
    </section>
  );
}

// Ouvert, fermé aujourd'hui, en vacances.
function Ouverture({ fetchHeaders, aujourdhui, allerA }) {
  const [reglages, setReglages] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings/shop', { headers: fetchHeaders })
      .then((r) => r.json())
      .then(setReglages)
      .catch(() => setMessage('Réglages illisibles.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!reglages) return <p className="text-sm text-stone-gray">{message || 'Chargement…'}</p>;

  const vacances = Boolean(reglages.absence && reglages.absence.active);
  const fermee = reglages.fermeLe === aujourdhui;
  const etat = vacances ? 'vacances' : fermee ? 'fermee' : 'ouverte';
  const texteAbsence = reglages.absence && reglages.absence.fr;

  const enregistrer = (patch, confirmation) => {
    setMessage('');
    fetch('/api/admin/settings/shop', { method: 'PUT', headers: fetchHeaders, body: JSON.stringify(patch) })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((n) => { setReglages(n); setMessage(confirmation); })
      .catch(() => setMessage('Le changement n’a pas pu être enregistré.'));
  };

  const choix = [
    { cle: 'ouverte', nom: 'Ouverte', detail: 'selon les horaires', patch: { fermeLe: '', absence: { active: false } }, ok: 'Le site affiche à nouveau les horaires habituels.' },
    { cle: 'fermee', nom: 'Fermée aujourd’hui', detail: 'réouverture au prochain horaire', patch: { fermeLe: aujourdhui, absence: { active: false } }, ok: 'Le site annonce « Fermé exceptionnellement aujourd’hui ». Demain, il reprend les horaires tout seul.' },
    { cle: 'vacances', nom: 'En vacances', detail: 'message d’absence affiché', patch: { absence: { active: true } }, ok: 'Le message d’absence est affiché sur le site et dans le panier.' },
  ];

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {choix.map((c) => (
          <button key={c.cle} type="button" aria-pressed={etat === c.cle}
            disabled={c.cle === 'vacances' && !texteAbsence}
            onClick={() => etat !== c.cle && enregistrer(c.patch, c.ok)}
            className={`rounded-xl border px-3 py-4 text-left transition-colors disabled:opacity-40 ${etat === c.cle ? 'bg-slate-stone text-white border-slate-stone' : 'bg-white text-slate-stone border-slate-stone/15 hover:border-slate-stone/40'}`}>
            <span className="block text-sm font-medium">{c.nom}</span>
            <span className={`block text-[11px] mt-0.5 ${etat === c.cle ? 'text-white/70' : 'text-stone-gray'}`}>{c.detail}</span>
          </button>
        ))}
      </div>
      {!texteAbsence && (
        <p className="text-xs text-stone-gray mt-2">
          Pour « En vacances », écrivez d’abord le message dans{' '}
          <button type="button" className="underline underline-offset-4" onClick={() => allerA('shop')}>Horaires & absences</button>.
        </p>
      )}
      {message && <p role="status" className="text-xs text-[#4A5B39] mt-2">{message}</p>}
    </>
  );
}

// Retrouver un produit pour conseiller une cliente.
function Recherche({ fetchHeaders }) {
  const [produits, setProduits] = useState([]);
  const [q, setQ] = useState('');
  const [ouvert, setOuvert] = useState(null);

  useEffect(() => {
    fetch('/api/admin/products', { headers: fetchHeaders })
      .then((r) => r.json())
      .then((l) => setProduits(Array.isArray(l) ? l : []))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resultats = useMemo(() => {
    const mots = sansAccents(q).split(/\s+/).filter(Boolean);
    if (!mots.length) return [];
    return produits
      .filter((p) => {
        const texte = sansAccents([p.name, p.sumupNom, ...(p.collections || []), ...(p.typePeau || []), ...(p.besoins || []), p.ingredients].join(' '));
        return mots.every((m) => texte.includes(m));
      })
      .sort((a, b) => (a.enLigne === false) - (b.enLigne === false) || String(a.name).localeCompare(String(b.name), 'fr'))
      .slice(0, 20);
  }, [produits, q]);

  return (
    <>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off"
        placeholder="Nom, rubrique, type de peau, ingrédient…"
        className="w-full px-4 py-3 border border-slate-stone/20 rounded-xl text-base bg-white" />
      {q && resultats.length === 0 && <p className="text-sm text-stone-gray mt-3">Aucun produit ne correspond.</p>}
      <ul className="mt-3 flex flex-col divide-y divide-slate-stone/10">
        {resultats.map((p) => {
          const formats = p.variantes || [];
          const estOuvert = ouvert === p.id;
          const seuil = p.seuilAlerte ?? 3;
          return (
            <li key={p.id} className="py-3">
              <button type="button" onClick={() => setOuvert(estOuvert ? null : p.id)} aria-expanded={estOuvert} className="w-full text-left">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-slate-stone">{p.name}</span>
                  <span className="text-sm tabular-nums shrink-0">
                    {formats.length ? formats.map((v) => `${v.libelle} ${chf(v.prix)}`).join(' · ') : chf(p.price)}
                  </span>
                </span>
                <span className="text-xs text-stone-gray">
                  {p.stock == null ? 'stock non suivi' : (
                    <span className={p.stock === 0 ? 'text-red-700 font-semibold' : p.stock <= seuil ? 'text-amber-700' : ''}>
                      {p.stock === 0 ? 'épuisé' : `${p.stock} en stock`}
                    </span>
                  )}
                  {p.contenance && ` · ${p.contenance}`}
                  {p.enLigne === false && ' · pas en ligne'}
                </span>
              </button>
              {estOuvert && (
                <div className="mt-2 rounded-xl bg-mist-white px-4 py-3 text-xs text-stone-gray space-y-1.5">
                  {(p.typePeau || []).length > 0 && <p><strong className="text-slate-stone">Pour :</strong> {p.typePeau.join(', ')}</p>}
                  {(p.besoins || []).length > 0 && <p><strong className="text-slate-stone">Agit sur :</strong> {p.besoins.join(', ')}</p>}
                  {p.ingredients && <p><strong className="text-slate-stone">Ingrédients :</strong> {p.ingredients}</p>}
                  {p.inci && <p><strong className="text-slate-stone">INCI :</strong> {p.inci}</p>}
                  {!p.ingredients && !p.inci && p.description && <p>{texteBrut(p.description).slice(0, 400)}…</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

// La clôture du jour.
function Cloture({ d, b }) {
  const boutique = b && b.configure && !b.erreur ? b.jour : null;
  const moyens = boutique ? Object.entries(boutique.moyens) : [];
  const ligne = 'flex justify-between gap-3 py-1 tabular-nums';
  return (
    <div className="text-sm">
      <div className="divide-y divide-slate-stone/10">
        <div className={ligne}><span className="text-stone-gray">Boutique (caisse SumUp)</span><span className="text-slate-stone">{boutique ? chf(boutique.montant) : '—'}</span></div>
        {moyens.map(([nom, m]) => (
          <div key={nom} className={`${ligne} pl-4 text-xs`}><span className="text-stone-gray">{nom} · {m.ventes} vente(s)</span><span>{chf(m.montant)}</span></div>
        ))}
        {boutique && boutique.rembourse > 0 && <div className={`${ligne} pl-4 text-xs`}><span className="text-stone-gray">Remboursé</span><span>− {chf(boutique.rembourse)}</span></div>}
        <div className={ligne}><span className="text-stone-gray">En ligne · {d.jour.ventes} commande(s)</span><span className="text-slate-stone">{chf(d.jour.montant)}</span></div>
        <div className={`${ligne} font-medium`}><span className="text-slate-stone">Total du jour</span><span className="text-slate-stone">{chf((boutique ? boutique.montant : 0) + d.jour.montant)}</span></div>
      </div>
      {b && b.erreur && <p className="text-xs text-amber-800 mt-2">Caisse injoignable : le chiffre de la boutique manque.</p>}
      <p className="text-[11px] uppercase tracking-widest text-stone-gray mt-4 mb-1">Pour demain</p>
      <ul className="text-sm text-slate-stone space-y-0.5">
        <li>{d.aExpedier} commande(s) à préparer pour un envoi</li>
        <li>{(d.retraits || []).length} commande(s) à remettre au comptoir</li>
        <li>{d.production.filter((p) => p.stock === 0 || (p.joursRestants !== null && p.joursRestants <= 7)).length} produit(s) à fabriquer en urgence</li>
      </ul>
    </div>
  );
}

const Comptoir = ({ fetchHeaders, allerA }) => {
  const [d, setD] = useState(null);
  const [b, setB] = useState(null);

  useEffect(() => {
    fetch('/api/admin/tableau-de-bord', { headers: fetchHeaders }).then((r) => r.json()).then(setD).catch(() => {});
    fetch('/api/admin/tableau-de-bord/boutique', { headers: fetchHeaders })
      .then((r) => (r.ok ? r.json() : { erreur: 'lecture impossible' }))
      .then(setB)
      .catch(() => setB({ erreur: 'lecture impossible' }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return <p className="text-sm text-stone-gray">Chargement…</p>;

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="font-serif text-3xl text-slate-stone">Comptoir</h1>
      <Carte titre="La boutique aujourd’hui">
        <Ouverture fetchHeaders={fetchHeaders} aujourdhui={d.aujourdhui} allerA={allerA} />
      </Carte>
      <Carte titre="Trouver un produit">
        <Recherche fetchHeaders={fetchHeaders} />
      </Carte>
      <Carte titre={`À remettre (${(d.retraits || []).length})`}>
        <Retraits retraits={d.retraits} fetchHeaders={fetchHeaders} grand />
      </Carte>
      <Carte titre="Clôture du jour">
        <Cloture d={d} b={b} />
      </Carte>
    </div>
  );
};

export default Comptoir;

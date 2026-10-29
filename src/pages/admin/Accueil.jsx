import { useState, useEffect } from 'react';

// L'accueil de l'administration : ce qu'il faut savoir en l'ouvrant.
//
// Ventes du jour et du mois, ce qui part le mieux, les commandes payées qui
// attendent d'être préparées, le stock qui baisse, les prochains ateliers. Elle
// ouvrait l'onglet Commandes et devait tout reconstituer de tête.

const chf = (n) => `CHF ${Number(n || 0).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (iso, avecHeure = false) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  return d.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short', ...(avecHeure ? { hour: '2-digit', minute: '2-digit' } : {}) });
};

function Bloc({ titre, action, children }) {
  return (
    <div className="rounded-2xl border border-slate-stone/10 bg-white p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="font-serif text-lg text-slate-stone">{titre}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Tuile({ titre, valeur, note }) {
  return (
    <div className="rounded-2xl border border-slate-stone/10 bg-white p-5">
      <p className="text-[11px] uppercase tracking-widest text-stone-gray">{titre}</p>
      <p className="font-serif text-2xl xl:text-3xl text-slate-stone mt-1 tabular-nums whitespace-nowrap">{valeur}</p>
      {note && <p className="text-xs text-stone-gray mt-1">{note}</p>}
    </div>
  );
}

const lienOnglet = 'text-[11px] uppercase tracking-widest text-stone-gray underline underline-offset-4 hover:text-slate-stone';

const Accueil = ({ fetchHeaders, allerA }) => {
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    fetch('/api/admin/tableau-de-bord', { headers: fetchHeaders })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setD)
      .catch(() => setErreur('Le tableau de bord n’a pas pu être chargé.'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (erreur) return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>;
  if (!d) return <p className="text-sm text-stone-gray">Chargement…</p>;

  const jourLong = new Date(`${d.aujourdhui}T12:00:00`).toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl md:text-4xl text-slate-stone mb-1">Bonjour</h1>
        <p className="text-sm text-stone-gray first-letter:uppercase">{jourLong}</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Tuile titre="Ventes du jour" valeur={chf(d.jour.montant)} note={`${d.jour.ventes} commande(s) en ligne payée(s)`} />
        <Tuile titre="Ventes du mois" valeur={chf(d.mois.montant)} note={`${d.mois.ventes} commande(s) en ligne payée(s)`} />
        <Tuile titre="À préparer" valeur={d.aTraiter.length} note="payées, pas encore prêtes ni expédiées" />
        <Tuile titre="Visites du jour" valeur={d.visitesDuJour} note={`${d.versBoutiqueDuJour} itinéraire(s) ou appel(s)`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloc titre="Commandes à préparer" action={<button type="button" className={lienOnglet} onClick={() => allerA('orders')}>Toutes les commandes</button>}>
          {d.aTraiter.length === 0 ? (
            <p className="text-sm text-stone-gray">Rien en attente. Tout ce qui est payé est prêt ou parti.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-stone/10">
              {d.aTraiter.slice(0, 8).map((o) => (
                <li key={o.id} className="py-2 flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="text-slate-stone">{o.nom || 'Sans nom'}</span>
                    <span className="block text-xs text-stone-gray">{date(o.date, true)} · {o.retrait ? 'Retrait en boutique' : o.livraison}</span>
                  </span>
                  <span className="tabular-nums text-slate-stone shrink-0">{chf(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloc>

        <Bloc titre="Stock bas" action={<button type="button" className={lienOnglet} onClick={() => allerA('products')}>Gestion des produits</button>}>
          {d.stockBas.length === 0 ? (
            <p className="text-sm text-stone-gray">Aucun produit sous son seuil d’alerte (seuil général : {d.seuilGeneral}).</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-stone/10">
              {d.stockBas.slice(0, 10).map((p) => (
                <li key={p.id} className="py-2 flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-slate-stone min-w-0 truncate">
                    {p.nom}
                    {!p.enLigne && <span className="ml-2 text-[10px] uppercase tracking-widest text-stone-gray">en attente</span>}
                  </span>
                  <span className={`tabular-nums shrink-0 ${p.stock === 0 ? 'text-red-700 font-semibold' : 'text-amber-700'}`}>
                    {p.stock === 0 ? 'épuisé' : `${p.stock} / seuil ${p.seuil}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {d.stockBas.length > 10 && <p className="text-xs text-stone-gray mt-2">Et {d.stockBas.length - 10} autre(s).</p>}
        </Bloc>

        <Bloc titre="Les plus vendus ce mois-ci">
          {d.meilleurs.length === 0 ? (
            <p className="text-sm text-stone-gray">Aucune vente en ligne ce mois-ci pour l’instant.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-slate-stone/10">
              {d.meilleurs.map((p, i) => (
                <li key={p.nom + i} className="py-2 flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-slate-stone min-w-0 truncate"><span className="text-stone-gray mr-2">{i + 1}.</span>{p.nom}</span>
                  <span className="tabular-nums text-stone-gray shrink-0">{p.qte} vendu(s)</span>
                </li>
              ))}
            </ol>
          )}
          <p className="text-[11px] text-stone-gray mt-3">Ventes en ligne. Les ventes au comptoir sont dans « Ventes en boutique ».</p>
        </Bloc>

        <Bloc titre="Ateliers" action={<button type="button" className={lienOnglet} onClick={() => allerA('workshops')}>Gestion des ateliers</button>}>
          {d.prochains.length === 0 && d.reservationsRecentes.length === 0 ? (
            <p className="text-sm text-stone-gray">Aucun atelier daté à venir, et aucune réservation récente.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-stone/10">
              {d.prochains.map((w) => (
                <li key={w.id} className="py-2 flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0"><span className="text-slate-stone">{w.titre}</span><span className="block text-xs text-stone-gray">{date(w.date, true)}</span></span>
                  <span className="tabular-nums text-stone-gray shrink-0">{w.places} place(s) réservée(s)</span>
                </li>
              ))}
              {d.reservationsRecentes.map((b, i) => (
                <li key={`r${i}`} className="py-2 flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0"><span className="text-slate-stone">{b.nom}</span><span className="block text-xs text-stone-gray">{b.atelier} · {b.creneau}</span></span>
                  <span className="text-xs text-stone-gray shrink-0">réservé {date(b.le)}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloc>
      </div>

      <p className="text-xs text-stone-gray">
        Ventes en boutique : {d.caisse ? `dernier relevé SumUp le ${date(d.caisse, true)}` : 'aucun relevé SumUp encore fait'}.{' '}
        <button type="button" className={lienOnglet} onClick={() => allerA('caisse')}>Relever</button>
      </p>
    </div>
  );
};

export default Accueil;

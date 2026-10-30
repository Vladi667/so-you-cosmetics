import React, { useState, useEffect } from 'react';

// Les paniers abandonnés.
//
// « Même simplement pouvoir les voir serait déjà utile. » C'est exactement ce
// que fait cet écran, et rien de plus : il montre une donnée déjà là.
//
// Une commande naît « en attente » et ne devient « payée » qu'au paiement
// confirmé. Celles qui restent en attente sont donc des paniers abandonnés au
// moment de payer — avec le nom, l'adresse et le contenu que la personne a
// elle-même saisis. Suivre en plus les visiteuses anonymes aurait demandé
// d'enregistrer leur panier avant tout consentement ; ce n'était pas
// nécessaire pour répondre à la question posée.

const PaniersAbandonnes = ({ fetchHeaders, onRelancer }) => {
  const [paniers, setPaniers] = useState([]);
  const [delai, setDelai] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    fetch('/api/admin/paniers-abandonnes', { headers: fetchHeaders })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setPaniers(d.paniers || []); setDelai(d.delaiHeures || 1); })
      .catch(() => setErreur('Chargement impossible.'))
      .finally(() => setChargement(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const depuis = (iso) => {
    const h = (Date.now() - new Date(iso).getTime()) / 3600000;
    if (h < 24) return `il y a ${Math.round(h)} h`;
    const j = Math.round(h / 24);
    return `il y a ${j} jour${j > 1 ? 's' : ''}`;
  };

  const relancer = (p) => {
    const lignes = p.articles
      .map((a) => `· ${a.qty > 1 ? a.qty + ' × ' : ''}${a.nom}`)
      .join('\n');
    onRelancer({
      isOpen: true,
      to: p.email,
      subject: 'Votre panier vous attend — So You Cosmetics',
      message:
        `Bonjour ${p.nom || ''},\n\n`
        + 'Vous avez commencé une commande chez nous, sans aller jusqu’au paiement.\n'
        + 'Votre panier contenait :\n\n'
        + lignes + '\n\n'
        + `Soit CHF ${Number(p.total).toFixed(2)}.\n\n`
        + 'Si vous souhaitez la finaliser ou si quelque chose vous a arrêtée, écrivez-nous : nous sommes là.\n\n',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl md:text-4xl text-slate-stone mb-2">Paniers abandonnés</h1>
        <p className="text-sm text-stone-gray max-w-[70ch] leading-relaxed">
          Les commandes arrivées jusqu’à la page de paiement, puis laissées là. Le nom, l’adresse
          et le panier sont ceux que la personne a saisis elle-même — le site ne suit pas les
          visiteuses qui n’ont rien validé.
          {' '}Celles de moins de {delai} h ne figurent pas ici : elles sont peut-être en train de payer.
        </p>
      </div>

      {erreur && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

      {chargement ? (
        <p className="text-sm text-stone-gray">Chargement…</p>
      ) : paniers.length === 0 ? (
        <p className="rounded-2xl border border-slate-stone/10 bg-white p-6 text-sm text-stone-gray">
          Aucun panier abandonné. Toutes les commandes arrivées au paiement ont été réglées.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {paniers.map((p) => (
            <div key={p.id} className="rounded-2xl border border-slate-stone/10 bg-white p-5">
              <div className="flex items-baseline justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-serif text-lg text-slate-stone">{p.nom || 'Sans nom'}</h2>
                  <p className="font-mono text-xs text-stone-gray mt-0.5">{p.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-stone tabular-nums">CHF {Number(p.total).toFixed(2)}</p>
                  <p className="text-xs text-stone-gray">{depuis(p.date)}</p>
                </div>
              </div>

              <ul className="mt-3 flex flex-col gap-0.5">
                {p.articles.map((a, k) => (
                  <li key={k} className="text-sm text-stone-gray">
                    {a.qty > 1 && <span className="text-stone-gray/60">{a.qty} × </span>}
                    {a.nom}
                    <span className="text-stone-gray/60 tabular-nums"> — CHF {Number(a.prix).toFixed(2)}</span>
                  </li>
                ))}
              </ul>

              {p.expedition && p.expedition.label && (
                <p className="text-xs text-stone-gray mt-2">Expédition choisie : {p.expedition.label}</p>
              )}

              <div className="mt-4 pt-3 border-t border-slate-stone/10 flex flex-wrap items-center gap-4">
                <button type="button" onClick={() => relancer(p)}
                  className="press px-5 py-2 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest">
                  ✉️ Relancer
                </button>
                <span className="font-mono text-[11px] text-stone-gray">{p.id}</span>
                <span className="text-[11px] text-stone-gray">
                  Pour l’écarter : ouvrez-la dans Commandes et passez-la en « Annulée ».
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PaniersAbandonnes;

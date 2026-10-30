import { useState } from 'react';

// Les commandes à remettre au comptoir, avec leurs deux gestes.
//
// « Prête » prévient la cliente par e-mail que sa commande l'attend (même
// chemin que la fiche de commande) ; « Remise » clôt la commande quand elle
// l'emporte. Partagé par l'accueil et par le mode comptoir : le même geste ne
// doit pas faire deux choses selon l'écran d'où on le fait.

const chf = (n) => `CHF ${Number(n || 0).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (iso) => new Date(iso).toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' });

const Retraits = ({ retraits, fetchHeaders, grand = false }) => {
  const [etat, setEtat] = useState({});

  const marquer = (o, quoi) => {
    const requete = quoi === 'prete'
      ? fetch(`/api/admin/orders/${o.id}/fulfill`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ type: 'pickup' }) })
      : fetch(`/api/admin/orders/${o.id}`, { method: 'PUT', headers: fetchHeaders, body: JSON.stringify({ status: 'PickedUp' }) });
    requete
      .then((r) => { if (!r.ok) throw new Error(); })
      .then(() => setEtat((x) => ({ ...x, [o.id]: quoi })))
      .catch(() => alert('La commande n’a pas pu être mise à jour.'));
  };

  const liste = (retraits || []).filter((o) => etat[o.id] !== 'remise');
  if (liste.length === 0) return <p className="text-sm text-stone-gray">Aucune commande en attente de retrait.</p>;

  const bouton = grand ? 'px-5 py-3 text-xs' : 'px-3 py-1.5 text-[11px]';
  return (
    <ul className="flex flex-col divide-y divide-slate-stone/10">
      {liste.map((o) => {
        const prete = o.pret || etat[o.id] === 'prete';
        return (
          <li key={o.id} className="py-3 flex flex-wrap items-start justify-between gap-3 text-sm">
            <span className="min-w-0 flex-1">
              <span className={`text-slate-stone ${grand ? 'text-base' : ''}`}>{o.nom || 'Sans nom'}</span>
              {o.telephone && <a href={`tel:${o.telephone}`} className="text-xs text-stone-gray underline underline-offset-2"> · {o.telephone}</a>}
              <span className="block text-xs text-stone-gray">{date(o.date)} · {chf(o.total)} · {o.articles.join(', ')}</span>
              {prete && <span className="block text-[11px] text-[#4A5B39]">Prête — la cliente a été prévenue</span>}
            </span>
            <span className="flex gap-2 shrink-0">
              {!prete && (
                <button type="button" onClick={() => marquer(o, 'prete')} title="La cliente reçoit un e-mail : sa commande l’attend"
                  className={`press ${bouton} border border-slate-stone/20 rounded-full uppercase tracking-widest text-slate-stone`}>
                  Prête
                </button>
              )}
              <button type="button" onClick={() => marquer(o, 'remise')}
                className={`press ${bouton} bg-slate-stone text-white rounded-full uppercase tracking-widest`}>
                Remise
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export default Retraits;

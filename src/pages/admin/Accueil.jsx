import { useState, useEffect, useMemo } from 'react';
import StatutBoutique from '../../components/StatutBoutique';

// L'accueil de l'administration : les deux boutiques, la physique et la
// boutique en ligne, sur un seul écran.
//
// La boutique des Eaux-Vives est lue dans la caisse SumUp (chiffre, heures,
// moyens de paiement) ; la boutique en ligne dans les commandes du site. Le
// stock leur est commun : la liste « À fabriquer » compte ce qui part des
// deux côtés.
//
// La caisse est chargée à part : SumUp peut être lent ou injoignable, et
// l'écran ne doit pas l'attendre pour s'afficher.

const chf = (n, dec = 2) => `CHF ${Number(n || 0).toLocaleString('fr-CH', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
const date = (iso, avecHeure = false) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  return d.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short', ...(avecHeure ? { hour: '2-digit', minute: '2-digit' } : {}) });
};
const heure = (iso) => new Date(iso).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function Bloc({ titre, action, children, className = '' }) {
  return (
    // min-w-0 : dans une grille, un bloc ne rétrécit pas sous la largeur de son
    // contenu ; un long nom de produit le faisait déborder sur téléphone.
    <div className={`min-w-0 rounded-2xl border border-slate-stone/10 bg-white p-5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="font-serif text-lg text-slate-stone">{titre}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

const lienOnglet = 'text-[11px] uppercase tracking-widest text-stone-gray underline underline-offset-4 hover:text-slate-stone';

// Le jour J, en deux colonnes : la boutique (caisse SumUp) et le site.
function Aujourdhui({ d, b }) {
  const boutique = b && b.configure && !b.erreur ? b.jour : null;
  const total = (boutique ? boutique.montant : 0) + d.jour.montant;
  const moyens = boutique ? Object.entries(boutique.moyens).sort((x, y) => y[1].montant - x[1].montant) : [];
  return (
    <div className="rounded-2xl bg-slate-stone text-white p-6">
      <p className="text-[11px] uppercase tracking-widest text-white/60">Chiffre du jour · boutique et en ligne</p>
      <p className="font-serif text-4xl md:text-5xl mt-1 tabular-nums">{b === null ? '…' : chf(total)}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-white/60">Boutique</p>
          {b === null && <p className="text-sm text-white/70 mt-1">Lecture de la caisse…</p>}
          {b && !b.configure && <p className="text-sm text-white/70 mt-1">SumUp n’est pas réglé.</p>}
          {b && b.erreur && <p className="text-sm text-white/70 mt-1">Caisse injoignable : {b.erreur}</p>}
          {boutique && (
            <>
              <p className="font-serif text-2xl tabular-nums mt-1">{chf(boutique.montant)}</p>
              <p className="text-xs text-white/70">{boutique.ventes} vente(s) · panier moyen {chf(boutique.panierMoyen)}</p>
              {boutique.rembourse > 0 && <p className="text-xs text-white/70">dont {chf(boutique.rembourse)} remboursés</p>}
            </>
          )}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-widest text-white/60">En ligne</p>
          <p className="font-serif text-2xl tabular-nums mt-1">{chf(d.jour.montant)}</p>
          <p className="text-xs text-white/70">{d.jour.ventes} commande(s) payée(s)</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-widest text-white/60">Paiements au comptoir</p>
          {moyens.length === 0 ? (
            <p className="text-xs text-white/70 mt-2">{boutique ? 'Aucune vente encore aujourd’hui.' : '—'}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {moyens.map(([nom, m]) => (
                <li key={nom} className="flex justify-between gap-3 tabular-nums">
                  <span className="text-white/80">{nom} <span className="text-white/50">· {m.ventes}</span></span>
                  <span>{chf(m.montant)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="text-xs text-white/60 mt-4">
        Site : {d.visitesDuJour} visite(s) aujourd’hui, {d.versBoutiqueDuJour} itinéraire(s) ou appel(s) vers la boutique.
      </p>
    </div>
  );
}

// La courbe des 30 derniers jours, boutique et en ligne empilées, comparée
// aux 30 jours d'avant.
function Courbe({ d, b }) {
  const jours = useMemo(() => {
    // Les 60 jours se comptent depuis le jour que donne le serveur, à Genève :
    // midi UTC tombe toujours dans le même jour civil, sans souci d'heure d'été.
    const out = [];
    const midi = new Date(`${d.aujourdhui}T12:00:00Z`).getTime();
    for (let i = 59; i >= 0; i--) {
      const k = new Date(midi - i * 86400000).toISOString().slice(0, 10);
      const bo = b && b.parJour && b.parJour[k] ? b.parJour[k].montant : 0;
      const el = d.enLigneParJour && d.enLigneParJour[k] ? d.enLigneParJour[k].montant : 0;
      out.push({ k, bo, el, t: bo + el });
    }
    return out;
  }, [d, b]);
  const recents = jours.slice(30);
  const avant = jours.slice(0, 30);
  const somme = (l) => l.reduce((t, j) => t + j.t, 0);
  const total = somme(recents);
  const precedent = somme(avant);
  const evolution = precedent > 0 ? Math.round(((total - precedent) / precedent) * 100) : null;
  const max = Math.max(1, ...recents.map((j) => j.t));
  const boutiqueSure = b && b.configure && !b.erreur;

  return (
    <Bloc
      titre="Chiffre d’affaires, 30 derniers jours"
      action={evolution !== null && (
        <span className={`text-sm tabular-nums ${evolution >= 0 ? 'text-[#4A5B39]' : 'text-red-700'}`}>
          {evolution >= 0 ? '+' : ''}{evolution} % vs les 30 jours d’avant
        </span>
      )}
    >
      <p className="font-serif text-3xl text-slate-stone tabular-nums">{chf(total, 0)}</p>
      <p className="text-xs text-stone-gray mb-4">
        boutique {chf(somme(recents.map((j) => ({ t: j.bo }))), 0)} · en ligne {chf(somme(recents.map((j) => ({ t: j.el }))), 0)}
        {!boutiqueSure && ' · caisse non lue : boutique non comptée'}
      </p>
      <div className="flex items-end gap-[3px] h-36" role="img" aria-label="Chiffre d’affaires par jour">
        {recents.map((j) => (
          <div key={j.k} className="flex-1 min-w-0 flex flex-col justify-end h-full group relative"
            title={`${new Date(`${j.k}T12:00:00`).toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' })} — boutique ${chf(j.bo)}, en ligne ${chf(j.el)}`}>
            <div className="bg-mist-blue/60 rounded-t-sm" style={{ height: `${(j.el / max) * 100}%` }} />
            <div className={`bg-slate-stone ${j.el ? '' : 'rounded-t-sm'}`} style={{ height: `${(j.bo / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-stone-gray mt-1">
        <span>{new Date(`${recents[0].k}T12:00:00`).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })}</span>
        <span className="flex gap-4">
          <span><span className="inline-block w-2.5 h-2.5 bg-slate-stone rounded-sm mr-1 align-middle" />Boutique</span>
          <span><span className="inline-block w-2.5 h-2.5 bg-mist-blue/60 rounded-sm mr-1 align-middle" />En ligne</span>
        </span>
        <span>aujourd’hui</span>
      </div>
    </Bloc>
  );
}

// Les meilleures heures de la boutique, sur 90 jours : où se fait le chiffre,
// et où il ne se fait pas — la pause de midi, les lundis, le créneau calme
// pour un atelier.
function Heures({ b }) {
  if (!b || !b.configure || b.erreur || !b.heures) return null;
  const grille = b.heures;
  let hMin = 23;
  let hMax = 0;
  grille.forEach((ligne) => ligne.forEach((c, h) => { if (c.ventes) { hMin = Math.min(hMin, h); hMax = Math.max(hMax, h); } }));
  if (hMin > hMax) { hMin = 9; hMax = 18; }
  hMin = Math.min(hMin, 10);
  hMax = Math.max(hMax, 18);
  const heures = [];
  for (let h = hMin; h <= hMax; h++) heures.push(h);
  const max = Math.max(1, ...grille.flat().map((c) => c.montant));
  let meilleur = null;
  grille.forEach((ligne, j) => ligne.forEach((c, h) => { if (!meilleur || c.montant > meilleur.montant) meilleur = { j, h, ...c }; }));
  const parJour = grille.map((ligne) => ligne.reduce((t, c) => t + c.montant, 0));
  const meilleurJour = parJour.indexOf(Math.max(...parJour));

  return (
    <Bloc titre="Les meilleures heures de la boutique" action={<span className="text-[11px] text-stone-gray">90 derniers jours · {b.ventes90} vente(s)</span>}>
      {b.ventes90 === 0 ? (
        <p className="text-sm text-stone-gray">Aucune vente au comptoir enregistrée dans SumUp sur cette période.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="border-separate" style={{ borderSpacing: 3 }}>
              <thead>
                <tr>
                  <th />
                  {heures.map((h) => <th key={h} className="text-[10px] font-normal text-stone-gray w-9">{h}h</th>)}
                </tr>
              </thead>
              <tbody>
                {grille.map((ligne, j) => (
                  <tr key={j}>
                    <th className="text-[11px] font-normal text-stone-gray pr-2 text-left">{JOURS[j]}</th>
                    {heures.map((h) => {
                      const c = ligne[h];
                      const intensite = c.montant > 0 ? 0.12 + 0.88 * (c.montant / max) : 0;
                      return (
                        <td key={h} className="w-9 h-7 rounded"
                          style={{ background: intensite ? `rgba(58, 51, 43, ${intensite.toFixed(2)})` : 'rgba(58, 51, 43, 0.04)' }}
                          title={`${JOURS[j]} ${h}h–${h + 1}h : ${c.ventes} vente(s), ${chf(c.montant)}`} />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meilleur && meilleur.montant > 0 && (
            <p className="text-sm text-stone-gray mt-3">
              Le créneau le plus fort : <strong className="text-slate-stone">{JOURS[meilleur.j].toLowerCase()} {meilleur.h}h–{meilleur.h + 1}h</strong>
              {' '}({chf(meilleur.montant, 0)} en 90 jours). Le meilleur jour : <strong className="text-slate-stone">{['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][meilleurJour]}</strong>.
            </p>
          )}
        </>
      )}
    </Bloc>
  );
}

const Accueil = ({ fetchHeaders, allerA }) => {
  const [d, setD] = useState(null);
  const [b, setB] = useState(null);
  const [erreur, setErreur] = useState('');
  const [retirees, setRetirees] = useState({});

  useEffect(() => {
    fetch('/api/admin/tableau-de-bord', { headers: fetchHeaders })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setD)
      .catch(() => setErreur('Le tableau de bord n’a pas pu être chargé.'));
    fetch('/api/admin/tableau-de-bord/boutique', { headers: fetchHeaders })
      .then((r) => (r.ok ? r.json() : { configure: true, erreur: 'lecture impossible' }))
      .then(setB)
      .catch(() => setB({ configure: true, erreur: 'lecture impossible' }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // « Prête » prévient la cliente par e-mail (même chemin que la fiche de
  // commande) ; « Remise » clôt la commande, sans message.
  const marquer = (o, quoi) => {
    const requete = quoi === 'prete'
      ? fetch(`/api/admin/orders/${o.id}/fulfill`, { method: 'POST', headers: fetchHeaders, body: JSON.stringify({ type: 'pickup' }) })
      : fetch(`/api/admin/orders/${o.id}`, { method: 'PUT', headers: fetchHeaders, body: JSON.stringify({ status: 'PickedUp' }) });
    requete
      .then((r) => { if (!r.ok) throw new Error(); })
      .then(() => {
        if (quoi === 'remise') setRetirees((x) => ({ ...x, [o.id]: true }));
        else setD((x) => ({ ...x, retraits: x.retraits.map((y) => (y.id === o.id ? { ...y, pret: true } : y)) }));
      })
      .catch(() => alert('La commande n’a pas pu être mise à jour.'));
  };

  if (erreur) return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>;
  if (!d) return <p className="text-sm text-stone-gray">Chargement…</p>;

  const jourLong = new Date(`${d.aujourdhui}T12:00:00`).toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' });
  const retraits = (d.retraits || []).filter((o) => !retirees[o.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl text-slate-stone mb-1">Bonjour</h1>
          <p className="text-sm text-stone-gray first-letter:uppercase">{jourLong}</p>
        </div>
        <StatutBoutique boutons={false} />
      </div>

      <Aujourdhui d={d} b={b} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloc titre={`À remettre au comptoir (${retraits.length})`} action={<button type="button" className={lienOnglet} onClick={() => allerA('orders')}>Commandes</button>}>
          {retraits.length === 0 ? (
            <p className="text-sm text-stone-gray">Aucune commande en attente de retrait.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-stone/10">
              {retraits.map((o) => (
                <li key={o.id} className="py-3 flex flex-wrap items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="text-slate-stone">{o.nom || 'Sans nom'}</span>
                    {o.telephone && <span className="text-xs text-stone-gray"> · {o.telephone}</span>}
                    <span className="block text-xs text-stone-gray">{date(o.date)} · {chf(o.total)} · {o.articles.join(', ')}</span>
                  </span>
                  <span className="flex gap-2 shrink-0">
                    {!o.pret && (
                      <button type="button" onClick={() => marquer(o, 'prete')} title="La cliente reçoit un e-mail : sa commande l’attend"
                        className="press px-3 py-1.5 border border-slate-stone/20 rounded-full text-[11px] uppercase tracking-widest text-slate-stone">
                        Prête
                      </button>
                    )}
                    <button type="button" onClick={() => marquer(o, 'remise')}
                      className="press px-3 py-1.5 bg-slate-stone text-white rounded-full text-[11px] uppercase tracking-widest">
                      Remise
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-stone-gray mt-3">
            {d.aExpedier} commande(s) à préparer pour un envoi postal.
            {d.ateliersDuJour.length > 0 && ` Atelier aujourd’hui : ${d.ateliersDuJour.map((w) => `${w.titre} à ${heure(w.date)}`).join(', ')}.`}
          </p>
        </Bloc>

        <Bloc titre="À fabriquer" action={<button type="button" className={lienOnglet} onClick={() => allerA('products')}>Gestion des produits</button>}>
          {d.production.length === 0 ? (
            <p className="text-sm text-stone-gray">Rien d’urgent : aucun produit ne devrait manquer dans les trois semaines.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-stone/10">
              {d.production.slice(0, 10).map((p) => (
                <li key={p.id} className="py-2 flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="text-slate-stone block truncate">{p.nom}</span>
                    <span className="text-xs text-stone-gray">
                      reste {p.stock} · vendus en 30 j : {p.enLigne} en ligne, {p.boutique} en boutique
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs tabular-nums ${p.stock === 0 || (p.joursRestants !== null && p.joursRestants <= 7) ? 'text-red-700 font-semibold' : 'text-amber-700'}`}>
                    {p.stock === 0 ? 'épuisé' : p.joursRestants !== null ? `rupture ~${p.joursRestants} j` : `sous le seuil (${p.seuil})`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-stone-gray mt-3">
            D’après le rythme des 30 derniers jours. Les ventes au comptoir comptent dès qu’elles sont faites en touchant l’article dans la caisse.
          </p>
        </Bloc>
      </div>

      <Courbe d={d} b={b} />
      <Heures b={b} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloc titre="Les plus vendus en ligne ce mois-ci">
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
              {d.reservationsRecentes.map((r, i) => (
                <li key={`r${i}`} className="py-2 flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0"><span className="text-slate-stone">{r.nom}</span><span className="block text-xs text-stone-gray">{r.atelier} · {r.creneau}</span></span>
                  <span className="text-xs text-stone-gray shrink-0">réservé {date(r.le)}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloc>
      </div>

      <p className="text-xs text-stone-gray">
        Stock et caisse : {d.caisse ? `dernier relevé SumUp le ${date(d.caisse, true)}` : 'aucun relevé SumUp encore appliqué'}.{' '}
        <button type="button" className={lienOnglet} onClick={() => allerA('caisse')}>Ventes en boutique</button>
      </p>
    </div>
  );
};

export default Accueil;

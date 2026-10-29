import { useState, useEffect } from 'react';

// Les ventes de la boutique, relevées dans la caisse SumUp — voir
// server/caisse.js. Aperçu d'abord : rien ne touche au stock avant qu'elle ait
// vu ce qui va changer et cliqué « Appliquer ».

const chf = (n) => `CHF ${Number(n || 0).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const quand = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const ACTIONS = {
  deduire: { nom: 'Vente — stock à diminuer', ton: 'text-slate-stone' },
  restocker: { nom: 'Remboursée — stock à remettre', ton: 'text-amber-800' },
  deja: { nom: 'Déjà appliquée', ton: 'text-stone-gray' },
  rien: { nom: 'Vendue puis remboursée — rien à faire', ton: 'text-stone-gray' },
};
const champ = 'px-3 py-2 border rounded text-sm bg-white';

const Caisse = ({ fetchHeaders }) => {
  const [depuis, setDepuis] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [vue, setVue] = useState(null);
  const [coches, setCoches] = useState(new Set());
  const [correspondances, setCorrespondances] = useState({});
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState('');
  const [journal, setJournal] = useState([]);
  // Les fiches en attente restent hors de l'export, sauf demande : la plupart
  // sont d'anciennes fiches absorbées par une fiche à formats.
  const [avecEnAttente, setAvecEnAttente] = useState(false);

  const chargerJournal = () => {
    fetch('/api/admin/caisse/journal', { headers: fetchHeaders })
      .then((r) => (r.ok ? r.json() : { journal: [] }))
      .then((d) => setJournal(d.journal || []))
      .catch(() => {});
  };
  useEffect(chargerJournal, []); // eslint-disable-line react-hooks/exhaustive-deps

  const poster = (url, corps) => fetch(url, {
    method: 'POST', headers: { ...fetchHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
  }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Erreur'); return d; });

  const relever = () => {
    setEnCours(true); setMessage(''); setVue(null);
    poster('/api/admin/caisse/apercu', { depuis })
      .then((d) => {
        setVue(d);
        setCoches(new Set(d.ventes.filter((v) => v.action === 'deduire' || v.action === 'restocker').map((v) => v.code)));
        setCorrespondances({});
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setEnCours(false));
  };

  const appliquer = () => {
    setEnCours(true); setMessage('');
    poster('/api/admin/caisse/appliquer', { depuis, codes: [...coches], correspondances })
      .then((r) => {
        setMessage(`${r.appliquees} vente(s) appliquée(s) au stock.${r.evenements.length ? ` ${r.evenements.length} produit(s) sous le seuil : une alerte est partie.` : ''}`);
        chargerJournal();
        return poster('/api/admin/caisse/apercu', { depuis }).then((d) => { setVue(d); setCoches(new Set()); setCorrespondances({}); });
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setEnCours(false));
  };

  const exporter = () => {
    fetch(`/api/admin/caisse/export-stock.csv${avecEnAttente ? '?avecEnAttente=1' : ''}`, { headers: fetchHeaders })
      .then((r) => { if (!r.ok) throw new Error(); return r.blob(); })
      .then((b) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'articles-pour-sumup.csv';
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => alert('L’export n’a pas pu être généré.'));
  };

  const basculer = (code) => setCoches((s) => { const n = new Set(s); if (n.has(code)) n.delete(code); else n.add(code); return n; });
  const aAppliquer = vue ? vue.ventes.filter((v) => coches.has(v.code)) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl md:text-4xl text-slate-stone mb-2">Ventes en boutique</h1>
        <p className="text-sm text-stone-gray max-w-[70ch] leading-relaxed">
          Les ventes faites au comptoir avec la caisse SumUp diminuent le stock du site, comme les
          commandes en ligne. Relevez-les quand vous voulez — chaque soir, ou une fois par semaine :
          une vente déjà appliquée ne l’est jamais deux fois. Les paiements en ligne sont écartés,
          le site les a déjà comptés.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-stone/10 bg-white p-5 flex flex-wrap items-end gap-3">
        <label>
          <span className="block text-[11px] uppercase tracking-widest text-stone-gray mb-1">Ventes depuis le</span>
          <input type="date" className={champ} value={depuis} onChange={(e) => setDepuis(e.target.value)} />
        </label>
        <button type="button" disabled={enCours} onClick={relever}
          className="press px-5 py-2 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest disabled:opacity-40">
          {enCours && !vue ? 'Relevé en cours…' : 'Relever les ventes SumUp'}
        </button>
        <label className="ml-auto flex items-center gap-2 text-xs text-stone-gray">
          <input type="checkbox" checked={avecEnAttente} onChange={(e) => setAvecEnAttente(e.target.checked)} />
          Inclure les fiches en attente
        </label>
        <button type="button" onClick={exporter}
          className="press px-5 py-2 border border-slate-stone/20 text-slate-stone rounded-full text-xs uppercase tracking-widest">
          Exporter les articles pour SumUp
        </button>
      </div>

      {/* Le chemin pour que la caisse connaisse les produits du site. Sans lui,
          une vente tapée en « montant libre » ne dit pas ce qui a été vendu,
          et le stock ne peut pas suivre. */}
      <div className="rounded-2xl border border-slate-stone/10 bg-ivory p-5 text-sm text-stone-gray leading-relaxed">
        <h2 className="font-serif text-lg text-slate-stone mb-2">Mettre les produits du site dans la caisse</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>« Exporter les articles pour SumUp » : un fichier au format d’import de SumUp, avec la référence (SKU) de chaque produit et de chaque format.</li>
          <li>Dans le tableau de bord SumUp : Articles → Importer, puis choisissez ce fichier.</li>
          <li>À la caisse, touchez l’article au lieu de taper un montant libre : la vente dira ce qui est parti, et « Relever » diminuera le stock du site.</li>
        </ol>
        <p className="mt-2 text-xs">
          Le stock reste tenu par le site (« Track inventory » à « No » dans SumUp) : un second stock dans la caisse, que les
          ventes en ligne ne toucheraient pas, divergerait dès la première commande.
        </p>
      </div>

      {message && <p className="rounded-xl border border-slate-stone/10 bg-ivory px-4 py-3 text-sm text-slate-stone">{message}</p>}

      {vue && (
        <>
          {vue.nonReconnus.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-serif text-lg text-slate-stone mb-1">Articles de la caisse non reconnus</h2>
              <p className="text-sm text-stone-gray mb-4">
                Leur nom dans SumUp ne correspond à aucune fiche. Rattachez-les une fois : le lien est
                retenu sur la fiche (« Nom dans la caisse SumUp »), et les prochains relevés les reconnaîtront seuls.
                Un article laissé sans fiche est ignoré.
              </p>
              <div className="flex flex-col gap-2">
                {vue.nonReconnus.map((nom) => (
                  <label key={nom} className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="w-56 shrink-0 text-slate-stone">{nom}</span>
                    <select className={`${champ} min-w-0 flex-1`} value={correspondances[nom] || ''}
                      onChange={(e) => setCorrespondances((c) => ({ ...c, [nom]: e.target.value }))}>
                      <option value="">— ignorer —</option>
                      {vue.produits.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-stone/10 bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
              <h2 className="font-serif text-lg text-slate-stone">{vue.ventes.length} vente(s) en boutique depuis le {new Date(vue.depuis).toLocaleDateString('fr-CH')}</h2>
              <button type="button" disabled={enCours || aAppliquer.length === 0} onClick={appliquer}
                className="press px-5 py-2 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest disabled:opacity-40">
                Appliquer {aAppliquer.length} vente(s) au stock
              </button>
            </div>
            {vue.ventes.length === 0 ? (
              <p className="text-sm text-stone-gray">Aucune vente au comptoir sur cette période.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-slate-stone/10">
                {vue.ventes.map((v) => {
                  const cochable = v.action === 'deduire' || v.action === 'restocker';
                  return (
                    <li key={v.code} className="py-3 flex gap-3">
                      <input type="checkbox" className="mt-1" disabled={!cochable} checked={coches.has(v.code)} onChange={() => basculer(v.code)} aria-label={`Appliquer ${v.code}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                          <span className="text-slate-stone">{quand(v.date)} <span className="ml-1 font-mono text-[11px] text-stone-gray">{v.code}</span></span>
                          <span className="tabular-nums">{chf(v.montant)} <span className="text-[10px] uppercase tracking-widest text-stone-gray">{v.moyen}</span></span>
                        </div>
                        <p className={`text-xs mt-0.5 ${ACTIONS[v.action].ton}`}>{ACTIONS[v.action].nom}</p>
                        {v.remboursePartiel && <p className="text-xs text-amber-800">Remboursement partiel chez SumUp : à corriger à la main dans la fiche.</p>}
                        {v.lignes.length > 0 && (
                          <ul className="mt-1 text-xs text-stone-gray">
                            {v.lignes.map((l, i) => (
                              <li key={i}>
                                {l.qte} × {l.nom}
                                {l.produitId
                                  ? (l.produitNom !== l.nom && <span className="text-stone-gray/70"> → {l.produitNom}</span>)
                                  : <span className="text-amber-800"> → {correspondances[l.nom] ? (vue.produits.find((p) => p.id === correspondances[l.nom]) || {}).nom : 'non reconnu'}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="rounded-2xl border border-slate-stone/10 bg-white p-5">
        <h2 className="font-serif text-lg text-slate-stone mb-3">Journal</h2>
        {journal.length === 0 ? (
          <p className="text-sm text-stone-gray">Aucun relevé appliqué pour l’instant.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-stone/10">
            {journal.map((j, i) => (
              <li key={i} className="py-2 text-sm">
                <span className="text-slate-stone">{j.action}</span>
                <span className="text-xs text-stone-gray"> · vente du {quand(j.date)} · {chf(j.montant)} · appliqué le {quand(j.quand)}</span>
                <span className="block text-xs text-stone-gray">{j.lignes.join(' · ')}{j.ignorees.length ? ` · ignoré : ${j.ignorees.join(', ')}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Caisse;

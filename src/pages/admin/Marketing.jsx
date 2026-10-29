import { useState, useEffect } from 'react';

// Le tableau de bord marketing.
//
// La question que pose le contrat signé avec l'agence : « ce qui entre, et
// d'où ». Les visites sont comptées par le site lui-même, sans cookie (voir
// server/audience.js) ; les ventes sont les commandes PAYÉES, rangées par la
// provenance de la visite qui les a passées. C'est la seule façon de répondre
// à la seule question qui compte pour une annonce : a-t-elle fait vendre ?

const PERIODES = [
  { jours: 7, nom: '7 jours' },
  { jours: 30, nom: '30 jours' },
  { jours: 90, nom: '3 mois' },
  { jours: 365, nom: '1 an' },
];

// Ce que chaque canal veut dire, en une ligne, pour qu'aucun ne se lise de
// travers.
const SENS = {
  'Google Ads': 'Annonces Google payantes',
  'Meta Ads': 'Annonces Instagram / Facebook payantes',
  Recherche: 'Résultats gratuits de Google, Bing…',
  'Fiche Google': 'Lien de la fiche Google (Maps)',
  Annuaires: 'local.ch, search.ch…',
  'Réseaux sociaux': 'Publications Instagram, Facebook… non payantes',
  Infolettre: 'Liens de vos infolettres',
  'Autre site': 'Un lien depuis un autre site',
  'Autre publicité': 'Autre annonce payante',
  'Autre lien': 'Lien marqué, sans canal reconnu',
  Direct: 'Adresse tapée, favori, ou lien sans provenance',
  Inconnue: 'Commandes passées avant le suivi',
};

const chf = (n) => `CHF ${Number(n || 0).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (a, b) => (b ? `${((a / b) * 100).toLocaleString('fr-CH', { maximumFractionDigits: 1 })} %` : '—');
const trier = (obj) => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);

function Tuile({ titre, valeur, note }) {
  return (
    <div className="rounded-2xl border border-slate-stone/10 bg-white p-5">
      <p className="text-[11px] uppercase tracking-widest text-stone-gray">{titre}</p>
      <p className="font-serif text-2xl xl:text-3xl text-slate-stone mt-1 tabular-nums whitespace-nowrap">{valeur}</p>
      {note && <p className="text-xs text-stone-gray mt-1">{note}</p>}
    </div>
  );
}

function Liste({ titre, lignes, vide }) {
  return (
    <div className="rounded-2xl border border-slate-stone/10 bg-white p-5">
      <h2 className="font-serif text-lg text-slate-stone mb-3">{titre}</h2>
      {lignes.length === 0 ? (
        <p className="text-sm text-stone-gray">{vide}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {lignes.slice(0, 12).map(([k, n]) => (
            <li key={k} className="flex justify-between gap-4 text-sm">
              <span className="text-stone-gray truncate" title={k}>{k}</span>
              <span className="text-slate-stone tabular-nums shrink-0">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Fabrique un lien marqué, à donner à l'agence ou à coller dans une
// infolettre. Sans marquage, une annonce Meta arrive souvent comme simple
// « Réseaux sociaux », et ne se distingue plus d'une publication gratuite.
function LienCampagne() {
  const [f, setF] = useState({ page: 'https://soyoucosmetics.com/', source: 'instagram', support: 'paid', campagne: '' });
  const [copie, setCopie] = useState(false);
  let lien = '';
  try {
    const u = new URL(f.page);
    if (f.source) u.searchParams.set('utm_source', f.source.trim().toLowerCase());
    if (f.support) u.searchParams.set('utm_medium', f.support);
    if (f.campagne) u.searchParams.set('utm_campaign', f.campagne.trim().toLowerCase().replace(/\s+/g, '-'));
    lien = u.toString();
  } catch { lien = ''; }

  const copier = () => {
    navigator.clipboard?.writeText(lien).then(() => { setCopie(true); setTimeout(() => setCopie(false), 1500); });
  };
  const champ = 'w-full px-3 py-2 border rounded text-sm';
  const etiquette = 'block text-[11px] uppercase tracking-widest text-stone-gray mb-1';

  return (
    <div className="rounded-2xl border border-slate-stone/10 bg-white p-5">
      <h2 className="font-serif text-lg text-slate-stone">Lien de campagne</h2>
      <p className="text-sm text-stone-gray mt-1 mb-4 max-w-[70ch]">
        Pour qu’une annonce ou une infolettre apparaisse ici sous son nom, son lien doit être
        marqué. Remplissez, copiez, et donnez ce lien à l’agence ou collez-le dans l’infolettre.
        Les annonces Google n’en ont pas besoin : elles sont reconnues seules.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className={etiquette}>Page de destination</span>
          <input className={champ} value={f.page} onChange={(e) => setF({ ...f, page: e.target.value })} />
        </label>
        <label><span className={etiquette}>Où le lien sera publié</span>
          <select className={champ} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="google">Google</option>
            <option value="infolettre">Infolettre</option>
            <option value="google-business">Fiche Google</option>
          </select>
        </label>
        <label><span className={etiquette}>Type</span>
          <select className={champ} value={f.support} onChange={(e) => setF({ ...f, support: e.target.value })}>
            <option value="paid">Annonce payante</option>
            <option value="social">Publication gratuite</option>
            <option value="email">E-mail</option>
            <option value="referral">Lien ordinaire</option>
          </select>
        </label>
        <label className="sm:col-span-2"><span className={etiquette}>Nom de la campagne</span>
          <input className={champ} placeholder="noel-2026" value={f.campagne} onChange={(e) => setF({ ...f, campagne: e.target.value })} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <code className="flex-1 min-w-0 break-all rounded bg-mist-white px-3 py-2 text-xs text-slate-stone">{lien || 'Adresse de destination invalide.'}</code>
        <button type="button" disabled={!lien} onClick={copier}
          className="press px-5 py-2 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest disabled:opacity-40">
          {copie ? 'Copié' : 'Copier'}
        </button>
      </div>
    </div>
  );
}

// Les ventes renvoyées à Google Ads.
//
// Sans elles, Google Ads dépense le budget à l'aveugle : il sait qui a cliqué,
// pas qui a acheté. Son traceur habituel dépose des cookies ; ici, c'est la
// boutique qui lui dit quelles commandes payées viennent de quel clic. Google
// Ads relève le fichier seul, chaque jour, avec l'identifiant et la clé
// ci-dessous.
function GoogleAds({ fetchHeaders }) {
  const [r, setR] = useState(null);
  const [voir, setVoir] = useState(false);

  useEffect(() => {
    fetch('/api/admin/google-ads', { headers: fetchHeaders })
      .then((x) => (x.ok ? x.json() : null))
      .then(setR)
      .catch(() => setR(null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nouvelleCle = () => {
    if (r && r.cle && !window.confirm('Une nouvelle clé remplace l’ancienne : il faudra la recopier dans Google Ads. Continuer ?')) return;
    fetch('/api/admin/google-ads/cle', { method: 'POST', headers: fetchHeaders })
      .then((x) => x.json())
      .then((d) => { setR((p) => ({ ...p, cle: d.cle })); setVoir(true); });
  };

  const telecharger = () => {
    fetch('/api/admin/google-ads/conversions.csv', { headers: fetchHeaders })
      .then((x) => { if (!x.ok) throw new Error(); return x.blob(); })
      .then((b) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'conversions-google-ads.csv';
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => alert('Le fichier n’a pas pu être généré.'));
  };

  if (!r) return null;
  const ligne = 'flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm';
  const nom = 'text-[11px] uppercase tracking-widest text-stone-gray w-40 shrink-0';

  return (
    <div className="rounded-2xl border border-slate-stone/10 bg-white p-5">
      <h2 className="font-serif text-lg text-slate-stone">Ventes renvoyées à Google Ads</h2>
      <p className="text-sm text-stone-gray mt-1 mb-4 max-w-[70ch]">
        Pour que Google Ads sache quelles annonces font vendre — sans cookie. Seules partent les
        commandes payées venues d’une annonce Google, avec leur montant ; ni nom ni adresse.
        {' '}<strong className="text-slate-stone">{r.ventes}</strong> vente(s) sur les 90 derniers jours.
      </p>
      <div className="flex flex-col gap-2">
        <div className={ligne}><span className={nom}>Action de conversion</span><code className="text-slate-stone">{r.nomConversion}</code></div>
        <div className={ligne}><span className={nom}>Adresse (HTTPS)</span><code className="text-slate-stone break-all">{r.adresse}</code></div>
        <div className={ligne}><span className={nom}>Nom d’utilisateur</span><code className="text-slate-stone">{r.utilisateur}</code></div>
        <div className={ligne}>
          <span className={nom}>Mot de passe</span>
          {r.cle
            ? <code className="text-slate-stone break-all">{voir ? r.cle : '••••••••••••'}</code>
            : <span className="text-stone-gray">aucun — l’import programmé est fermé</span>}
          {r.cle && (
            <button type="button" className="text-xs underline text-stone-gray" onClick={() => setVoir(!voir)}>
              {voir ? 'Masquer' : 'Afficher'}
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={nouvelleCle}
          className="press px-5 py-2 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest">
          {r.cle ? 'Nouvelle clé' : 'Créer la clé'}
        </button>
        <button type="button" onClick={telecharger}
          className="press px-5 py-2 border border-slate-stone/20 text-slate-stone rounded-full text-xs uppercase tracking-widest">
          Télécharger le fichier
        </button>
      </div>
    </div>
  );
}

const Marketing = ({ fetchHeaders }) => {
  const [jours, setJours] = useState(30);
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState('');

  const choisir = (n) => { setErreur(''); setJours(n); };

  useEffect(() => {
    fetch(`/api/admin/audience?jours=${jours}`, { headers: fetchHeaders })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setD)
      .catch(() => setErreur('Chargement impossible.'));
  }, [jours]); // eslint-disable-line react-hooks/exhaustive-deps

  const ventes = d ? Object.values(d.ventes || {}) : [];
  const nbVentes = ventes.reduce((s, v) => s + v.commandes, 0);
  const montant = ventes.reduce((s, v) => s + v.montant, 0);
  // La conversion ne compte que les ventes dont la visite a été suivie : les
  // commandes d'avant le suivi n'ont pas de visite en face, et gonfleraient
  // le taux au-delà de 100 %.
  const ventesSuivies = d
    ? Object.entries(d.ventes || {}).filter(([c]) => c !== 'Inconnue').reduce((s, [, v]) => s + v.commandes, 0)
    : 0;
  const max = d ? Math.max(1, ...d.parJour.map((j) => j.visites)) : 1;

  // Un canal figure s'il a amené des visites OU des ventes : les commandes
  // d'avant le suivi n'ont pas de visite, et doivent pourtant se voir.
  // Les gestes vers la boutique — itinéraire, appel, carte — par canal. Aucun
  // site ne voit une vente au comptoir : c'est ce qui en approche le plus.
  const versBoutique = {};
  for (const [cle, n] of Object.entries((d && d.actionsCanaux) || {})) {
    const canal = cle.split('|')[0];
    versBoutique[canal] = (versBoutique[canal] || 0) + n;
  }
  const actions = (d && d.actions) || {};
  const totalBoutique = (actions.itineraire || 0) + (actions.appel || 0) + (actions.carte || 0);

  const canaux = d
    ? [...new Set([...Object.keys(d.canaux || {}), ...Object.keys(d.ventes || {}), ...Object.keys(versBoutique)])]
        .map((c) => ({ c, visites: d.canaux[c] || 0, boutique: versBoutique[c] || 0, ...(d.ventes[c] || { commandes: 0, montant: 0 }) }))
        .sort((a, b) => b.montant - a.montant || b.visites - a.visites)
    : [];
  const campagnes = d
    ? [...new Set([...Object.keys(d.campagnes || {}), ...Object.keys(d.ventesCampagnes || {})])]
        .map((c) => ({ c, visites: d.campagnes[c] || 0, ...(d.ventesCampagnes[c] || { commandes: 0, montant: 0 }) }))
        .sort((a, b) => b.montant - a.montant || b.visites - a.visites)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl md:text-4xl text-slate-stone mb-2">Marketing</h1>
        <p className="text-sm text-stone-gray max-w-[70ch] leading-relaxed">
          Combien de visites, venues d’où, et ce qu’elles ont rapporté — en ligne, et vers la
          boutique (itinéraires demandés, appels, cartes ouvertes). Le site compte lui-même,
          sans cookie et sans garder d’adresse IP : aucune bannière n’est nécessaire. Les ventes
          sont les commandes payées ; vos propres passages dans l’administration ne comptent pas.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODES.map((p) => (
          <button key={p.jours} type="button" onClick={() => choisir(p.jours)}
            className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest border ${jours === p.jours ? 'bg-slate-stone text-white border-slate-stone' : 'bg-white text-stone-gray border-slate-stone/15'}`}>
            {p.nom}
          </button>
        ))}
      </div>

      {erreur && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}
      {!d && !erreur && <p className="text-sm text-stone-gray">Chargement…</p>}

      {d && (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <Tuile titre="Visites" valeur={d.visites.toLocaleString('fr-CH')} note={`${d.vues.toLocaleString('fr-CH')} pages vues`} />
            <Tuile titre="Ventes" valeur={nbVentes} note="commandes payées" />
            <Tuile titre="Chiffre d’affaires" valeur={chf(montant)} note="en ligne, livraison comprise" />
            <Tuile titre="Conversion" valeur={pct(ventesSuivies, d.visites)} note="ventes pour 100 visites" />
            <Tuile titre="Vers la boutique" valeur={totalBoutique}
              note={`${actions.itineraire || 0} itinéraire(s), ${actions.appel || 0} appel(s), ${actions.carte || 0} carte(s)`} />
          </div>

          <div className="rounded-2xl border border-slate-stone/10 bg-white p-5">
            <h2 className="font-serif text-lg text-slate-stone mb-3">Visites par jour</h2>
            <div className="flex items-end gap-px h-32" role="img" aria-label="Visites par jour">
              {d.parJour.map((j) => (
                <div key={j.date} className="flex-1 min-w-0 bg-mist-blue/70 hover:bg-slate-stone rounded-t-sm"
                  style={{ height: `${Math.max(j.visites ? 3 : 0, (j.visites / max) * 100)}%` }}
                  title={`${new Date(`${j.date}T12:00:00`).toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' })} : ${j.visites} visite(s)`} />
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-stone-gray mt-1">
              <span>{new Date(`${d.debut}T12:00:00`).toLocaleDateString('fr-CH')}</span>
              <span>{new Date(`${d.fin}T12:00:00`).toLocaleDateString('fr-CH')}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-stone/10 bg-white p-5 overflow-x-auto">
            <h2 className="font-serif text-lg text-slate-stone mb-3">D’où viennent les visites, et ce qu’elles rapportent</h2>
            {canaux.length === 0 ? (
              <p className="text-sm text-stone-gray">Aucune visite comptée sur cette période.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-widest text-stone-gray">
                    <th className="py-2 pr-4 font-normal">Provenance</th>
                    <th className="py-2 px-3 font-normal text-right">Visites</th>
                    <th className="py-2 px-3 font-normal text-right" title="Itinéraires, appels et cartes ouvertes depuis le site">Vers la boutique</th>
                    <th className="py-2 px-3 font-normal text-right">Ventes</th>
                    <th className="py-2 px-3 font-normal text-right">Montant</th>
                    <th className="py-2 pl-3 font-normal text-right">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {canaux.map((l) => (
                    <tr key={l.c} className="border-t border-slate-stone/10">
                      <td className="py-2 pr-4">
                        <span className="text-slate-stone">{l.c}</span>
                        {SENS[l.c] && <span className="block text-xs text-stone-gray">{SENS[l.c]}</span>}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{l.visites}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{l.boutique}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{l.commandes}</td>
                      <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">{chf(l.montant)}</td>
                      <td className="py-2 pl-3 text-right tabular-nums">{l.c === 'Inconnue' ? '—' : pct(l.commandes, l.visites)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {campagnes.length > 0 && (
            <div className="rounded-2xl border border-slate-stone/10 bg-white p-5 overflow-x-auto">
              <h2 className="font-serif text-lg text-slate-stone mb-3">Campagnes</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-widest text-stone-gray">
                    <th className="py-2 pr-4 font-normal">Campagne</th>
                    <th className="py-2 px-3 font-normal text-right">Visites</th>
                    <th className="py-2 px-3 font-normal text-right">Ventes</th>
                    <th className="py-2 pl-3 font-normal text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {campagnes.map((l) => (
                    <tr key={l.c} className="border-t border-slate-stone/10">
                      <td className="py-2 pr-4 text-slate-stone">{l.c}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{l.visites}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{l.commandes}</td>
                      <td className="py-2 pl-3 text-right tabular-nums whitespace-nowrap">{chf(l.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <Liste titre="Sites et sources" lignes={trier(d.detail)} vide="Rien encore." />
            <Liste titre="Pages d’arrivée" lignes={trier(d.entrees)} vide="Rien encore." />
            <Liste titre="Pages les plus vues" lignes={trier(d.pages)} vide="Rien encore." />
          </div>
        </>
      )}

      <GoogleAds fetchHeaders={fetchHeaders} />
      <LienCampagne />
    </div>
  );
};

export default Marketing;

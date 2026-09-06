import React, { useState, useEffect, useRef } from 'react';
import RichTextEditor from './RichTextEditor';

// Rédiger et envoyer l'infolettre.
//
// L'onglet ne faisait que collecter des adresses : il n'y avait ni rédaction
// ni envoi, et elle accumulait des inscrites qu'elle ne pouvait pas atteindre.
//
// Trois garde-fous se voient à l'écran, et ils ne sont pas décoratifs :
// l'essai avant l'envoi, parce qu'une faute de frappe part à trois cents
// personnes et ne se rattrape pas ; une lettre déjà partie qui ne se réécrit
// plus, pour que le texte enregistré reste celui qu'on a reçu ; et une
// progression qu'on peut arrêter, puis reprendre là où elle s'est arrêtée.

const VIDE = { id: null, sujet: '', html: '' };

const champ = 'w-full px-4 py-2 border rounded';
const etiquette = 'block text-xs uppercase tracking-widest text-stone-gray mb-1';

function Etat({ lettre }) {
  const tons = {
    brouillon: 'bg-mist-white text-stone-gray',
    envoi: 'bg-amber-100 text-amber-800',
    envoyee: 'bg-[#F2F5EC] text-[#4A5B39]',
    interrompue: 'bg-red-100 text-red-700',
  };
  const noms = {
    brouillon: 'Brouillon', envoi: 'Envoi en cours',
    envoyee: 'Envoyée', interrompue: 'Interrompue',
  };
  return (
    <span className={`inline-block text-[10px] tracking-widest uppercase px-2 py-0.5 rounded font-medium ${tons[lettre.etat]}`}>
      {noms[lettre.etat]}
    </span>
  );
}

const InfolettreEditor = ({ fetchHeaders }) => {
  const [lettres, setLettres] = useState([]);
  const [inscrites, setInscrites] = useState(0);
  const [rebonds, setRebonds] = useState({ ecartees: [], suivies: [], seuil: 3, boiteConfiguree: false });
  const [form, setForm] = useState(VIDE);
  const [adresseEssai, setAdresseEssai] = useState('contact@soyoucosmetics.com');
  const [occupe, setOccupe] = useState(false);
  const [etat, setEtat] = useState({ ok: '', erreur: '' });
  const minuteur = useRef(null);

  const charger = () =>
    Promise.all([
      fetch('/api/admin/infolettres', { headers: fetchHeaders }).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch('/api/admin/rebonds', { headers: fetchHeaders }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([d, reb]) => {
        setLettres(d.lettres || []);
        setInscrites(d.inscrites || 0);
        if (reb) setRebonds(reb);
      })
      .catch(() => setEtat({ ok: '', erreur: 'Chargement impossible.' }));

  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tant qu'un envoi tourne, on relit toutes les deux secondes : c'est le seul
  // moyen de voir la progression, l'envoi se faisant côté serveur.
  const enVol = lettres.some((l) => l.etat === 'envoi');
  useEffect(() => {
    clearInterval(minuteur.current);
    if (enVol) minuteur.current = setInterval(charger, 2000);
    return () => clearInterval(minuteur.current);
  }, [enVol]); // eslint-disable-line react-hooks/exhaustive-deps

  const appeler = async (chemin, options, apres) => {
    setOccupe(true); setEtat({ ok: '', erreur: '' });
    try {
      const r = await fetch(chemin, { headers: fetchHeaders, ...options });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setEtat({ ok: '', erreur: d.error || 'Une erreur est survenue.' }); return null; }
      if (apres) apres(d);
      await charger();
      return d;
    } catch {
      setEtat({ ok: '', erreur: 'La connexion a échoué.' });
      return null;
    } finally {
      setOccupe(false);
    }
  };

  const enregistrer = (e) => {
    e.preventDefault();
    if (!form.sujet.trim()) { setEtat({ ok: '', erreur: 'Donnez un objet à cette infolettre.' }); return; }
    const nouvelle = !form.id;
    appeler(
      nouvelle ? '/api/admin/infolettres' : `/api/admin/infolettres/${form.id}`,
      { method: nouvelle ? 'POST' : 'PUT', body: JSON.stringify({ sujet: form.sujet, html: form.html }) },
      (d) => { setForm({ id: d.id, sujet: d.sujet, html: d.html }); setEtat({ ok: 'Enregistrée.', erreur: '' }); }
    );
  };

  const essayer = () => {
    if (!form.id) { setEtat({ ok: '', erreur: 'Enregistrez d’abord le brouillon.' }); return; }
    appeler(`/api/admin/infolettres/${form.id}/essai`,
      { method: 'POST', body: JSON.stringify({ adresse: adresseEssai }) },
      (d) => setEtat({ ok: d.message, erreur: '' }));
  };

  const envoyer = () => {
    if (!form.id) return;
    // Le nombre de destinataires est dans la question elle-même : « Envoyer ? »
    // ne dit pas à combien de personnes, et c'est justement ce qu'on veut
    // savoir avant de cliquer.
    if (!window.confirm(
      `Envoyer « ${form.sujet} » à ${inscrites} inscrite(s) ?\n\n`
      + 'Un message part par personne, environ un par seconde. '
      + 'Une infolettre envoyée ne peut plus être modifiée ni reprise.'
    )) return;
    appeler(`/api/admin/infolettres/${form.id}/envoyer`, { method: 'POST' },
      (d) => setEtat({ ok: d.message, erreur: '' }));
  };

  const ouvrir = (l) => { setForm({ id: l.id, sujet: l.sujet, html: l.html }); setEtat({ ok: '', erreur: '' }); };

  const lettreOuverte = lettres.find((l) => l.id === form.id) || null;
  const verrouillee = lettreOuverte && lettreOuverte.etat !== 'brouillon';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl md:text-4xl text-slate-stone mb-2">Infolettres</h1>
        <p className="text-sm text-stone-gray max-w-[70ch]">
          Rédigez, essayez sur votre propre adresse, puis envoyez.
          <strong className="text-slate-stone"> {inscrites} inscrite(s)</strong> recevront le message —
          un envoi par personne, environ un par seconde, pour que le serveur de messagerie
          ne prenne pas la boutique pour un expéditeur de courrier indésirable.
          Le lien de désinscription est ajouté automatiquement en bas de chaque envoi.
        </p>
      </div>

      {etat.erreur && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{etat.erreur}</p>
      )}
      {etat.ok && (
        <p className="rounded-xl border border-sage bg-[#F2F5EC] px-4 py-3 text-sm text-[#4A5B39]">{etat.ok}</p>
      )}

      <form onSubmit={enregistrer} className="bg-white rounded-2xl border border-slate-stone/10 p-5 sm:p-6 space-y-4">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <h2 className="font-serif text-2xl text-slate-stone">
            {form.id ? (verrouillee ? 'Infolettre envoyée' : 'Modifier le brouillon') : 'Nouvelle infolettre'}
          </h2>
          {form.id && (
            <button type="button" onClick={() => setForm(VIDE)}
              className="press text-xs uppercase tracking-widest text-stone-gray hover:text-slate-stone underline underline-offset-4">
              Nouvelle
            </button>
          )}
        </div>

        {verrouillee && (
          <p className="rounded-xl border border-slate-stone/15 bg-mist-white px-4 py-3 text-xs text-stone-gray leading-relaxed">
            Cette infolettre est partie : son texte ne peut plus être modifié, pour qu’il reste
            celui que les gens ont reçu. Pour en écrire une nouvelle, cliquez sur « Nouvelle ».
          </p>
        )}

        <div>
          <label className={etiquette}>Objet du message</label>
          <input type="text" value={form.sujet} disabled={verrouillee}
            onChange={(e) => setForm({ ...form, sujet: e.target.value })}
            placeholder="ex : Les savons de la rentrée"
            className={champ + (verrouillee ? ' bg-mist-white text-stone-gray' : '')} />
          <p className="text-[11px] text-stone-gray mt-1">
            C’est la seule ligne que la plupart des gens liront avant de décider d’ouvrir.
          </p>
        </div>

        <div>
          <label className={etiquette}>Le message</label>
          {verrouillee ? (
            <div className="border rounded p-4 bg-mist-white text-sm text-stone-gray"
              dangerouslySetInnerHTML={{ __html: form.html }} />
          ) : (
            <RichTextEditor
              value={form.html}
              onChange={(html) => setForm({ ...form, html })}
              placeholder="Écrivez comme vous le diriez à une cliente devant le comptoir."
            />
          )}
        </div>

        {!verrouillee && (
          <div className="flex flex-wrap items-end gap-3 pt-2">
            <button type="submit" disabled={occupe}
              className="press px-6 py-2.5 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest disabled:opacity-50">
              Enregistrer
            </button>

            <div className="flex items-end gap-2">
              <div>
                <label className={etiquette}>Essayer d’abord sur</label>
                <input type="email" value={adresseEssai} onChange={(e) => setAdresseEssai(e.target.value)}
                  className={champ + ' w-64'} />
              </div>
              <button type="button" onClick={essayer} disabled={occupe || !form.id}
                className="press px-5 py-2.5 border border-slate-stone/20 rounded-full text-xs uppercase tracking-widest disabled:opacity-40">
                Envoyer un essai
              </button>
            </div>

            <button type="button" onClick={envoyer} disabled={occupe || !form.id || inscrites === 0}
              className="press ml-auto px-6 py-2.5 bg-[#7A5C2E] text-white rounded-full text-xs uppercase tracking-widest disabled:opacity-40">
              Envoyer aux {inscrites} inscrite(s)
            </button>
          </div>
        )}
      </form>

      {/* Les rebonds.

          Une liste de diffusion pourrit toute seule : les gens changent
          d'employeur, ferment une boîte. Écrire à une boîte morte n'est pas
          seulement inutile — les fournisseurs de messagerie comptent les
          échecs, et un expéditeur qui insiste finit dans les indésirables de
          celles qui, elles, existent encore. */}
      <div>
        <h2 className="font-sans text-[10px] uppercase tracking-[0.26em] text-stone-gray mb-4">
          Adresses qui ne répondent plus
        </h2>

        <div className="rounded-2xl border border-slate-stone/10 bg-white p-5 space-y-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <p className="text-xs text-stone-gray max-w-[58ch] leading-relaxed">
              Une adresse qui n’existe pas est écartée dès le premier refus. Une adresse
              momentanément injoignable — boîte pleine, serveur occupé — l’est après
              {' '}{rebonds.seuil} échecs, pour qu’une panne de notre côté ne vide pas la liste.
              Les écartées restent inscrites mais ne reçoivent plus rien.
            </p>
            <button type="button" disabled={occupe || !rebonds.boiteConfiguree}
              onClick={() => appeler('/api/admin/rebonds/relever', { method: 'POST' },
                (d) => setEtat({ ok: d.message, erreur: '' }))}
              title={rebonds.boiteConfiguree ? '' : 'La boîte de réception n’est pas configurée.'}
              className="press px-5 py-2.5 border border-slate-stone/20 rounded-full text-xs uppercase tracking-widest disabled:opacity-40">
              Relever les avis de non-remise
            </button>
          </div>

          {!rebonds.boiteConfiguree && (
            <p className="text-[11px] text-amber-800 leading-relaxed">
              La boîte de réception n’étant pas configurée, seuls les refus immédiats sont
              détectés. Les avis de non-remise qui arrivent quelques minutes après l’envoi
              demandent l’accès à la boîte — voir l’onglet « Configuration ».
            </p>
          )}

          {rebonds.ecartees.length === 0 ? (
            <p className="text-sm text-stone-gray">Aucune adresse écartée.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {rebonds.ecartees.map((a) => (
                <div key={a.email} className="flex items-start justify-between flex-wrap gap-3 py-2 border-t border-slate-stone/10">
                  <div>
                    <p className="font-mono text-xs text-slate-stone">{a.email}</p>
                    <p className="text-[11px] text-stone-gray mt-0.5">
                      {a.definitif ? 'Adresse inexistante' : `${a.echecs} échecs`}
                      {a.motif ? ' — ' + a.motif : ''}
                      {a.origine ? ' (' + a.origine + ')' : ''}
                    </p>
                  </div>
                  <div className="flex gap-3 text-[11px] uppercase tracking-widest">
                    <button type="button" disabled={occupe}
                      onClick={() => appeler('/api/admin/rebonds/reintegrer',
                        { method: 'POST', body: JSON.stringify({ adresse: a.email }) },
                        (d) => setEtat({ ok: d.message, erreur: '' }))}
                      className="press text-slate-stone underline underline-offset-4">
                      Réintégrer
                    </button>
                    <button type="button" disabled={occupe}
                      onClick={() => {
                        if (!window.confirm(`Retirer ${a.email} de la liste de diffusion ?`)) return;
                        appeler('/api/admin/rebonds/oublier',
                          { method: 'POST', body: JSON.stringify({ adresse: a.email }) },
                          (d) => setEtat({ ok: d.message, erreur: '' }));
                      }}
                      className="press text-red-700 underline underline-offset-4">
                      Retirer de la liste
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {rebonds.suivies.length > 0 && (
            <div className="pt-3 border-t border-slate-stone/10">
              <p className="text-[11px] uppercase tracking-widest text-stone-gray mb-2">
                Sous surveillance — pas encore écartées
              </p>
              {rebonds.suivies.map((a) => (
                <p key={a.email} className="text-[11px] text-stone-gray">
                  <span className="font-mono">{a.email}</span> — {a.echecs}/{rebonds.seuil} échecs
                  {a.motif ? ' · ' + a.motif : ''}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-sans text-[10px] uppercase tracking-[0.26em] text-stone-gray mb-4">
          Les infolettres ({lettres.length})
        </h2>
        {lettres.length === 0 ? (
          <p className="text-sm text-stone-gray">Aucune infolettre pour l’instant.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {lettres.map((l) => {
              const e = l.envoi;
              const faits = e ? e.faits.length : 0;
              return (
                <div key={l.id} className="rounded-2xl border border-slate-stone/10 bg-white p-5">
                  <div className="flex items-baseline justify-between flex-wrap gap-3">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <h3 className="font-serif text-lg text-slate-stone">{l.sujet || 'Sans objet'}</h3>
                      <Etat lettre={l} />
                    </div>
                    <span className="text-xs text-stone-gray">
                      {new Date(l.modifie_le || l.cree_le).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>

                  {e && (
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-mist-white overflow-hidden">
                        <div className="h-full bg-slate-stone transition-all duration-500"
                          style={{ width: `${e.total ? Math.round((faits / e.total) * 100) : 0}%` }} />
                      </div>
                      <p className="text-xs text-stone-gray mt-1.5 tabular-nums">
                        {faits} / {e.total} envoyé(s)
                        {e.echecs.length > 0 && (
                          <span className="text-red-700"> · {e.echecs.length} échec(s)</span>
                        )}
                      </p>
                      {e.echecs.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-[11px] text-stone-gray cursor-pointer">Voir les échecs</summary>
                          <ul className="mt-1 text-[11px] text-stone-gray">
                            {e.echecs.slice(0, 20).map((x, k) => (
                              <li key={k}><span className="font-mono">{x.adresse}</span> — {x.motif}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-widest">
                    <button type="button" onClick={() => ouvrir(l)}
                      className="press text-slate-stone underline underline-offset-4">
                      {l.etat === 'brouillon' ? 'Modifier' : 'Relire'}
                    </button>

                    {l.etat === 'envoi' && (
                      <button type="button" disabled={occupe}
                        onClick={() => appeler(`/api/admin/infolettres/${l.id}/arreter`, { method: 'POST' },
                          (d) => setEtat({ ok: d.message, erreur: '' }))}
                        className="press text-amber-800 underline underline-offset-4">
                        Arrêter l’envoi
                      </button>
                    )}

                    {l.etat === 'interrompue' && (
                      <button type="button" disabled={occupe}
                        onClick={() => appeler(`/api/admin/infolettres/${l.id}/envoyer`, { method: 'POST' },
                          (d) => setEtat({ ok: d.message, erreur: '' }))}
                        className="press text-slate-stone underline underline-offset-4">
                        Reprendre où ça s’est arrêté
                      </button>
                    )}

                    {l.etat !== 'envoi' && (
                      <button type="button" disabled={occupe}
                        onClick={() => {
                          if (!window.confirm('Supprimer cette infolettre de la liste ?')) return;
                          appeler(`/api/admin/infolettres/${l.id}`, { method: 'DELETE' }, () => {
                            if (form.id === l.id) setForm(VIDE);
                          });
                        }}
                        className="press text-red-700 underline underline-offset-4">
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default InfolettreEditor;

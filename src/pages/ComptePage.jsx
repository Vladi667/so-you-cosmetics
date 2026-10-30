import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

// Le compte d'une cliente.
//
// Elle peut commander sans compte, et cela reste vrai : ce n'est pas une porte
// à franchir avant d'acheter, c'est un endroit où relire ce qu'on a acheté.
// La page le dit d'ailleurs sous le formulaire, pour que personne ne croie
// devoir s'inscrire pour passer commande.
//
// Le jeton de session vit dans localStorage, comme celui de l'administration.
// Un cookie httpOnly résisterait mieux à une injection de script, mais le site
// est une application d'une seule page qui appelle son API en Bearer : mêler
// les deux mécanismes ferait deux chemins d'authentification à tenir corrects
// au lieu d'un. Ce jeton ne donne accès qu'à la lecture de ses propres
// commandes — ni paiement, ni changement d'adresse de livraison a posteriori.

const CLE_JETON = 'soyou.compte.v1';

export const lireJetonCompte = () => {
  try { return localStorage.getItem(CLE_JETON); } catch { return null; }
};
const ecrireJeton = (j) => {
  try { if (j) localStorage.setItem(CLE_JETON, j); else localStorage.removeItem(CLE_JETON); } catch { /* stockage indisponible */ }
};

const champ = 'w-full px-4 py-3 rounded-xl border border-slate-stone/15 bg-ivory font-sans text-sm text-slate-stone placeholder:text-stone-gray/50 focus:outline-none focus:border-slate-stone/40';
const etiquette = 'block font-sans text-[10px] uppercase tracking-[0.2em] text-stone-gray mb-1.5';
const boutonPlein = 'press w-full rounded-full bg-slate-stone px-6 py-3 font-sans text-xs uppercase tracking-[0.2em] text-white disabled:opacity-50';

function Encadre({ ton = 'neutre', children }) {
  if (!children) return null;
  const tons = {
    neutre: 'border-slate-stone/15 bg-ivory text-stone-gray',
    erreur: 'border-[#C08A82] bg-[#FBF0EE] text-[#8A3E33]',
    bien: 'border-sage bg-[#F2F5EC] text-[#4A5B39]',
  };
  return (
    <p role="status" className={`rounded-xl border px-4 py-3 font-sans text-xs leading-relaxed ${tons[ton]}`}>
      {children}
    </p>
  );
}

function ComptePage() {
  const { t, language } = useLanguage();
  const [params, setParams] = useSearchParams();

  const [jeton, setJeton] = useState(() => lireJetonCompte());
  const [donnees, setDonnees] = useState(null);
  const [vue, setVue] = useState('connexion');      // connexion · inscription · oubli
  const [form, setForm] = useState({ email: '', motDePasse: '', nom: '' });
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [occupe, setOccupe] = useState(false);

  // Le retour du lien de confirmation, lu une fois puis retiré de l'adresse :
  // rechargée, la page ne doit pas répéter un message qui n'a plus cours.
  useEffect(() => {
    const v = params.get('verification');
    if (!v) return;
    setMessage(v === 'ok' ? t('compte.verifOk') : v === 'expire' ? t('compte.verifExpire') : t('compte.verifInconnu'));
    const suite = new URLSearchParams(params);
    suite.delete('verification');
    setParams(suite, { replace: true });
  }, [params, setParams, t]);

  const charger = useCallback(async (j) => {
    const r = await fetch('/api/compte', { headers: { Authorization: 'Bearer ' + j } });
    if (r.status === 401) { ecrireJeton(null); setJeton(null); setDonnees(null); return; }
    if (!r.ok) return;
    setDonnees(await r.json());
  }, []);

  useEffect(() => { if (jeton) charger(jeton); }, [jeton, charger]);

  const envoyer = async (chemin, corps, apres) => {
    setErreur(''); setMessage(''); setOccupe(true);
    try {
      const r = await fetch(chemin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || 'Une erreur est survenue.'); return; }
      apres(d);
    } catch {
      setErreur('La connexion au site a échoué. Réessayez dans un instant.');
    } finally {
      setOccupe(false);
    }
  };

  const seConnecter = (e) => {
    e.preventDefault();
    envoyer('/api/compte/connexion', { email: form.email, motDePasse: form.motDePasse }, (d) => {
      ecrireJeton(d.jeton); setJeton(d.jeton); setForm({ email: '', motDePasse: '', nom: '' });
    });
  };

  const sInscrire = (e) => {
    e.preventDefault();
    envoyer('/api/compte/inscription', form, (d) => {
      setMessage(d.message); setVue('connexion'); setForm({ email: form.email, motDePasse: '', nom: '' });
    });
  };

  const demanderLien = (e) => {
    e.preventDefault();
    envoyer('/api/compte/mot-de-passe-oublie', { email: form.email }, (d) => {
      setMessage(d.message); setVue('connexion');
    });
  };

  const seDeconnecter = async () => {
    try {
      await fetch('/api/compte/deconnexion', { method: 'POST', headers: { Authorization: 'Bearer ' + jeton } });
    } finally {
      ecrireJeton(null); setJeton(null); setDonnees(null);
    }
  };

  // La facture, demandée avec le jeton en en-tête puis ouverte depuis la
  // mémoire du navigateur. L'onglet est ouvert AVANT l'attente : ouvert après,
  // le navigateur le prendrait pour une fenêtre surgissante et le bloquerait.
  const ouvrirFacture = async (idCommande) => {
    const onglet = window.open('', '_blank');
    try {
      const r = await fetch(`/api/compte/facture/${idCommande}`, {
        headers: { Authorization: 'Bearer ' + jeton },
      });
      if (!r.ok) throw new Error('facture indisponible');
      const html = await r.text();
      if (onglet) { onglet.document.write(html); onglet.document.close(); }
    } catch {
      if (onglet) onglet.close();
      setErreur('La facture n’a pas pu être ouverte. Réessayez dans un instant.');
    }
  };

  // Le mot de passe est redemandé : un onglet resté ouvert sur un ordinateur
  // partagé ne doit pas suffire à effacer un compte.
  const supprimerLeCompte = async () => {
    const motDePasse = window.prompt(t('compte.supprimerConfirme'));
    if (motDePasse === null) return;
    try {
      const r = await fetch('/api/compte', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jeton },
        body: JSON.stringify({ motDePasse }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || 'La suppression a échoué.'); return; }
      ecrireJeton(null); setJeton(null); setDonnees(null);
      setMessage(d.message || t('compte.supprimerFait'));
    } catch {
      setErreur('La connexion au site a échoué. Réessayez dans un instant.');
    }
  };

  const dateLisible = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(
        language === 'de' ? 'de-CH' : language === 'en' ? 'en-GB' : 'fr-CH',
        { day: 'numeric', month: 'long', year: 'numeric' }
      );
    } catch { return String(iso).slice(0, 10); }
  };

  // ── Connectée ───────────────────────────────────────────────────────────
  if (jeton && donnees) {
    return (
      <div className="pt-24 min-h-screen bg-mist-white">
        <div className="container mx-auto px-6 py-12 max-w-4xl">
          <div className="flex items-baseline justify-between flex-wrap gap-4 mb-10">
            <div>
              <h1 className="font-serif text-3xl md:text-4xl text-slate-stone">
                {t('compte.bonjour', { nom: donnees.cliente.nom || donnees.cliente.email })}
              </h1>
              <p className="font-sans text-sm text-stone-gray mt-1">{donnees.cliente.email}</p>
            </div>
            <button onClick={seDeconnecter} className="press font-sans text-xs uppercase tracking-[0.2em] text-stone-gray hover:text-slate-stone underline underline-offset-4">
              {t('compte.deconnexion')}
            </button>
          </div>

          <Section titre={t('compte.mesCommandes')}>
            {donnees.commandes.length === 0 ? (
              <Encadre>{t('compte.aucuneCommande')}</Encadre>
            ) : donnees.commandes.map((c) => (
              <article key={c.id} className="rounded-2xl border border-slate-stone/10 bg-white p-5 mb-3">
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                  <h3 className="font-serif text-lg text-slate-stone">{t('compte.commandeDu', { date: dateLisible(c.date) })}</h3>
                  <span className="font-sans text-sm text-slate-stone tabular-nums">CHF {Number(c.total).toFixed(2)}</span>
                </div>
                <p className="font-sans text-xs text-stone-gray mt-1">
                  {t('compte.articles', { n: c.articles.length })}
                  {c.expedition && c.expedition.label ? ' · ' + c.expedition.label : ''}
                </p>
                <ul className="mt-3 flex flex-col gap-1">
                  {c.articles.map((a, k) => (
                    <li key={k} className="font-sans text-sm text-stone-gray">
                      {a.qty > 1 && <span className="text-stone-gray/60">{a.qty} × </span>}
                      {a.nom}
                      <span className="text-stone-gray/60 tabular-nums"> — CHF {Number(a.prix).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                {c.facture && (
                  <p className="mt-4 pt-3 border-t border-slate-stone/10">
                    {/* La facture s'ouvre par une requête portant le jeton en
                        en-tête, jamais par un lien qui le porterait dans son
                        adresse : une adresse se retrouve dans l'historique du
                        navigateur, dans les journaux du serveur et dans le
                        référent envoyé au site suivant. */}
                    <button
                      type="button"
                      onClick={() => ouvrirFacture(c.id)}
                      className="press font-sans text-xs uppercase tracking-[0.18em] text-slate-stone underline underline-offset-4"
                    >
                      {t('compte.voirLaFacture')} — {t('compte.facture', { numero: c.facture })}
                    </button>
                  </p>
                )}
              </article>
            ))}
          </Section>

          <Section titre={t('compte.mesAteliers')}>
            {donnees.ateliers.length === 0 ? (
              <Encadre>{t('compte.aucunAtelier')}</Encadre>
            ) : donnees.ateliers.map((a) => (
              <div key={a.id} className="rounded-2xl border border-slate-stone/10 bg-white p-5 mb-3 flex items-baseline justify-between flex-wrap gap-2">
                <span className="font-serif text-lg text-slate-stone">{dateLisible(a.date)}</span>
                <span className="font-sans text-xs text-stone-gray">{t('compte.places', { n: a.places })}</span>
              </div>
            ))}
          </Section>

          <Section titre={t('compte.mesCoordonnees')}>
            <Coordonnees cliente={donnees.cliente} jeton={jeton} t={t} onEnregistre={() => charger(jeton)} />
          </Section>

          {/* La suppression, en bas et sans emphase : c'est un droit, pas une
              action qu'on met en avant. Le texte dit exactement ce qui part et
              ce qui reste — promettre « tout est effacé » tout en gardant les
              commandes serait un mensonge. */}
          <div className="pt-8 mt-4 border-t border-slate-stone/10">
            <p className="font-sans text-xs text-stone-gray leading-relaxed max-w-[62ch] mb-3">
              {t('compte.supprimerExplique')}
            </p>
            <button type="button" onClick={supprimerLeCompte}
              className="press font-sans text-xs text-[#8A3E33] hover:underline underline-offset-4">
              {t('compte.supprimerCompte')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Non connectée ───────────────────────────────────────────────────────
  const soumettre = vue === 'inscription' ? sInscrire : vue === 'oubli' ? demanderLien : seConnecter;

  return (
    <div className="pt-24 min-h-screen bg-mist-white">
      <div className="container mx-auto px-6 py-12 max-w-md">
        <h1 className="font-serif text-3xl md:text-4xl text-slate-stone text-center">{t('compte.titre')}</h1>
        <p className="font-sans text-sm text-stone-gray text-center mt-2 mb-8">{t('compte.sousTitre')}</p>

        {vue !== 'oubli' && (
          <div className="flex rounded-full border border-slate-stone/15 bg-ivory p-1 mb-6">
            {[['connexion', t('compte.ongletConnexion')], ['inscription', t('compte.ongletInscription')]].map(([cle, nom]) => (
              <button
                key={cle}
                type="button"
                onClick={() => { setVue(cle); setErreur(''); }}
                aria-pressed={vue === cle}
                className={`press flex-1 rounded-full px-4 py-2.5 font-sans text-xs uppercase tracking-[0.16em] transition-colors ${
                  vue === cle ? 'bg-slate-stone text-white' : 'text-slate-stone'
                }`}
              >
                {nom}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={soumettre} className="flex flex-col gap-4">
          {message && <Encadre ton="bien">{message}</Encadre>}
          {erreur && <Encadre ton="erreur">{erreur}</Encadre>}

          {vue === 'inscription' && (
            <div>
              <label className={etiquette} htmlFor="compte-nom">{t('compte.nom')}</label>
              <input id="compte-nom" type="text" autoComplete="name" className={champ}
                value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
          )}

          <div>
            <label className={etiquette} htmlFor="compte-email">{t('compte.email')}</label>
            <input id="compte-email" type="email" required autoComplete="email" className={champ}
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          {vue !== 'oubli' && (
            <div>
              <label className={etiquette} htmlFor="compte-mdp">{t('compte.motDePasse')}</label>
              <input id="compte-mdp" type="password" required minLength={vue === 'inscription' ? 12 : undefined}
                autoComplete={vue === 'inscription' ? 'new-password' : 'current-password'} className={champ}
                value={form.motDePasse} onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} />
              {vue === 'inscription' && (
                <p className="font-sans text-[11px] text-stone-gray mt-1.5 leading-relaxed">{t('compte.indiceMotDePasse')}</p>
              )}
            </div>
          )}

          <button type="submit" disabled={occupe} className={boutonPlein}>
            {vue === 'inscription' ? t('compte.creerLeCompte') : vue === 'oubli' ? t('compte.envoyerLeLien') : t('compte.seConnecter')}
          </button>

          <button type="button" onClick={() => { setVue(vue === 'oubli' ? 'connexion' : 'oubli'); setErreur(''); }}
            className="press font-sans text-xs text-stone-gray hover:text-slate-stone underline underline-offset-4">
            {vue === 'oubli' ? t('compte.retourConnexion') : t('compte.motDePasseOublie')}
          </button>
        </form>

        <p className="font-sans text-xs text-stone-gray/80 text-center mt-8 leading-relaxed">{t('compte.sansCompte')}</p>
      </div>
    </div>
  );
}

function Section({ titre, children }) {
  return (
    <section className="mb-12">
      <h2 className="font-sans text-[10px] uppercase tracking-[0.26em] text-stone-gray mb-4">{titre}</h2>
      {children}
    </section>
  );
}

function Coordonnees({ cliente, jeton, t, onEnregistre }) {
  const [f, setF] = useState({
    nom: cliente.nom || '',
    telephone: cliente.telephone || '',
    line1: (cliente.adresse && cliente.adresse.line1) || '',
    line2: (cliente.adresse && cliente.adresse.line2) || '',
    zip: (cliente.adresse && cliente.adresse.zip) || '',
    city: (cliente.adresse && cliente.adresse.city) || '',
  });
  const [fait, setFait] = useState(false);
  const [occupe, setOccupe] = useState(false);

  const enregistrer = async (e) => {
    e.preventDefault();
    setOccupe(true); setFait(false);
    try {
      const r = await fetch('/api/compte', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jeton },
        body: JSON.stringify({
          nom: f.nom,
          telephone: f.telephone,
          adresse: { line1: f.line1, line2: f.line2, zip: f.zip, city: f.city },
        }),
      });
      if (r.ok) { setFait(true); onEnregistre(); }
    } finally {
      setOccupe(false);
    }
  };

  return (
    <form onSubmit={enregistrer} className="rounded-2xl border border-slate-stone/10 bg-white p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className={etiquette}>{t('compte.nom')}</label>
        <input type="text" className={champ} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
      </div>
      <div>
        <label className={etiquette}>{t('compte.telephone')}</label>
        <input type="tel" className={champ} value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <label className={etiquette}>{t('compte.rue')}</label>
        <input type="text" className={champ} value={f.line1} onChange={(e) => setF({ ...f, line1: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <label className={etiquette}>{t('compte.complement')}</label>
        <input type="text" className={champ} value={f.line2} onChange={(e) => setF({ ...f, line2: e.target.value })} />
      </div>
      <div>
        <label className={etiquette}>{t('compte.codePostal')}</label>
        <input type="text" className={champ} value={f.zip} onChange={(e) => setF({ ...f, zip: e.target.value })} />
      </div>
      <div>
        <label className={etiquette}>{t('compte.ville')}</label>
        <input type="text" className={champ} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
      </div>
      <div className="sm:col-span-2 flex items-center gap-4">
        <button type="submit" disabled={occupe} className="press rounded-full bg-slate-stone px-6 py-2.5 font-sans text-xs uppercase tracking-[0.2em] text-white disabled:opacity-50">
          {t('compte.enregistrer')}
        </button>
        {fait && <span className="font-sans text-xs text-[#4A5B39]">{t('compte.enregistre')}</span>}
      </div>
    </form>
  );
}

export default ComptePage;

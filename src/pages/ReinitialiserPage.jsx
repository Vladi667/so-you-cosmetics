import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import Lien from '../components/Lien';

// Choisir un nouveau mot de passe, depuis le lien reçu par courrier.
//
// Le jeton vient de l'adresse : c'est le seul endroit où il peut être, puisque
// la cliente arrive de sa boîte mail sans session ouverte. Il ne vaut qu'une
// heure et ne sert qu'une fois — le serveur l'efface dès qu'il a servi, et
// referme au passage toutes les sessions du compte : si le mot de passe a été
// changé parce qu'il était compromis, laisser vivre les sessions ouvertes
// n'aurait aucun sens.

const champ = 'w-full px-4 py-3 rounded-xl border border-slate-stone/15 bg-ivory font-sans text-sm text-slate-stone focus:outline-none focus:border-slate-stone/40';

function ReinitialiserPage() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const jeton = params.get('jeton') || '';

  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [fait, setFait] = useState(false);
  const [occupe, setOccupe] = useState(false);

  const envoyer = async (e) => {
    e.preventDefault();
    setErreur(''); setOccupe(true);
    try {
      const r = await fetch('/api/compte/reinitialiser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jeton, motDePasse }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErreur(d.error || 'Une erreur est survenue.');
      else setFait(true);
    } catch {
      setErreur('La connexion au site a échoué. Réessayez dans un instant.');
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="pt-24 min-h-screen bg-mist-white">
      <div className="container mx-auto px-6 py-12 max-w-md">
        <h1 className="font-serif text-3xl md:text-4xl text-slate-stone text-center mb-8">
          {t('compte.titreReinit')}
        </h1>

        {fait ? (
          <div className="flex flex-col gap-5 items-center">
            <p className="rounded-xl border border-sage bg-[#F2F5EC] px-4 py-3 font-sans text-xs leading-relaxed text-[#4A5B39] text-center">
              {t('compte.enregistre')}
            </p>
            <Lien to="/compte" className="press rounded-full bg-slate-stone px-6 py-3 font-sans text-xs uppercase tracking-[0.2em] text-white">
              {t('compte.seConnecter')}
            </Lien>
          </div>
        ) : (
          <form onSubmit={envoyer} className="flex flex-col gap-4">
            {erreur && (
              <p role="status" className="rounded-xl border border-[#C08A82] bg-[#FBF0EE] px-4 py-3 font-sans text-xs leading-relaxed text-[#8A3E33]">
                {erreur}
              </p>
            )}
            <div>
              <label className="block font-sans text-[10px] uppercase tracking-[0.2em] text-stone-gray mb-1.5" htmlFor="nouveau-mdp">
                {t('compte.nouveauMotDePasse')}
              </label>
              <input id="nouveau-mdp" type="password" required minLength={12} autoComplete="new-password"
                className={champ} value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
              <p className="font-sans text-[11px] text-stone-gray mt-1.5 leading-relaxed">
                {t('compte.indiceMotDePasse')}
              </p>
            </div>
            <button type="submit" disabled={occupe || !jeton}
              className="press w-full rounded-full bg-slate-stone px-6 py-3 font-sans text-xs uppercase tracking-[0.2em] text-white disabled:opacity-50">
              {t('compte.choisirMotDePasse')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ReinitialiserPage;

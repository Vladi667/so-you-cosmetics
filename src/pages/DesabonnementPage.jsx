import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

// Se désabonner de la newsletter.
//
// La politique de confidentialité le promet depuis le premier jour : « chaque
// newsletter contient un lien de désabonnement ». Voici ce que ce lien ouvre.
//
// Le désabonnement demande un clic sur cette page plutôt que de se faire à
// l'ouverture du lien : certains logiciels de messagerie visitent les liens
// d'un message pour les prévisualiser, et un désabonnement automatique
// partirait alors sans que personne l'ait voulu.
//
// Celle qui a supprimé le message arrive ici sans signature : elle donne son
// adresse et reçoit le lien. On ne peut donc pas désabonner une inconnue en
// devinant son adresse.

const champ = 'w-full px-4 py-3 rounded-xl border border-slate-stone/15 bg-ivory font-sans text-sm text-slate-stone focus:outline-none focus:border-slate-stone/40';

function DesabonnementPage() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const email = params.get('e') || '';
  const signature = params.get('s') || '';

  const [adresse, setAdresse] = useState('');
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  const appeler = async (chemin, corps) => {
    setErreur(''); setOccupe(true);
    try {
      const r = await fetch(chemin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErreur(d.error || 'Une erreur est survenue.');
      else setMessage(d.message);
    } catch {
      setErreur('La connexion au site a échoué. Réessayez dans un instant.');
    } finally {
      setOccupe(false);
    }
  };

  const signe = Boolean(email && signature);

  return (
    <div className="pt-24 min-h-screen bg-mist-white">
      <div className="container mx-auto px-6 py-12 max-w-md">
        <h1 className="font-serif text-3xl md:text-4xl text-slate-stone text-center mb-3">
          {t('desabo.titre')}
        </h1>

        {message ? (
          <p role="status" className="rounded-xl border border-sage bg-[#F2F5EC] px-4 py-3 font-sans text-sm leading-relaxed text-[#4A5B39] text-center mt-8">
            {message}
          </p>
        ) : (
          <>
            <p className="font-sans text-sm text-stone-gray text-center mb-8">
              {signe ? t('desabo.confirmer', { email }) : t('desabo.sansLien')}
            </p>

            {erreur && (
              <p role="status" className="rounded-xl border border-[#C08A82] bg-[#FBF0EE] px-4 py-3 font-sans text-xs leading-relaxed text-[#8A3E33] mb-4">
                {erreur}
              </p>
            )}

            {signe ? (
              <button
                type="button"
                disabled={occupe}
                onClick={() => appeler('/api/newsletter/desabonnement', { email, signature })}
                className="press w-full rounded-full bg-slate-stone px-6 py-3 font-sans text-xs uppercase tracking-[0.2em] text-white disabled:opacity-50"
              >
                {t('desabo.bouton')}
              </button>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); appeler('/api/newsletter/desabonnement/demande', { email: adresse }); }}
                className="flex flex-col gap-4"
              >
                <div>
                  <label className="block font-sans text-[10px] uppercase tracking-[0.2em] text-stone-gray mb-1.5" htmlFor="desabo-email">
                    {t('desabo.votreAdresse')}
                  </label>
                  <input id="desabo-email" type="email" required autoComplete="email" className={champ}
                    value={adresse} onChange={(e) => setAdresse(e.target.value)} />
                </div>
                <button type="submit" disabled={occupe}
                  className="press w-full rounded-full bg-slate-stone px-6 py-3 font-sans text-xs uppercase tracking-[0.2em] text-white disabled:opacity-50">
                  {t('desabo.recevoirLien')}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DesabonnementPage;

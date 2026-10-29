import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import Lien from '../components/Lien';

// Confirmer son inscription à la newsletter.
//
// C'est ce qui sépare une inscription réelle d'une adresse qu'un robot a
// inscrite à la place de sa propriétaire : seule celle qui reçoit le message
// peut cliquer. La confirmation demande un clic sur cette page plutôt que de
// se faire à l'ouverture du lien — certaines messageries visitent les liens
// pour les prévisualiser, et confirmeraient alors à la place de la personne.

function ConfirmationInfolettrePage() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const email = params.get('e') || '';
  const signature = params.get('s') || '';
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  const confirmer = async () => {
    setErreur(''); setOccupe(true);
    try {
      const r = await fetch('/api/newsletter/confirmer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, signature }),
      });
      if (r.ok) setMessage(t('confirmInfolettre.fait'));
      else setErreur(t('confirmInfolettre.invalide'));
    } catch {
      setErreur(t('confirmInfolettre.reseau'));
    } finally {
      setOccupe(false);
    }
  };

  const signe = Boolean(email && signature);

  return (
    <div className="pt-24 min-h-screen bg-mist-white">
      <div className="container mx-auto px-6 py-12 max-w-md text-center">
        <h1 className="font-serif text-3xl md:text-4xl text-slate-stone mb-3">{t('confirmInfolettre.titre')}</h1>
        {message ? (
          <>
            <p role="status" className="rounded-xl border border-sage bg-[#F2F5EC] px-4 py-3 font-sans text-sm leading-relaxed text-[#4A5B39] mt-8">
              {message}
            </p>
            <Lien to="/" className="inline-block mt-8 font-sans text-xs uppercase tracking-[0.2em] text-slate-stone underline underline-offset-4">
              {t('confirmInfolettre.retour')}
            </Lien>
          </>
        ) : signe ? (
          <>
            <p className="font-sans text-sm text-stone-gray mb-8">{t('confirmInfolettre.texte', { email })}</p>
            {erreur && (
              <p role="status" className="rounded-xl border border-[#C08A82] bg-[#FBF0EE] px-4 py-3 font-sans text-xs leading-relaxed text-[#8A3E33] mb-4">
                {erreur}
              </p>
            )}
            <button type="button" disabled={occupe} onClick={confirmer}
              className="press w-full rounded-full bg-slate-stone px-6 py-3 font-sans text-xs uppercase tracking-[0.2em] text-white disabled:opacity-50">
              {t('confirmInfolettre.bouton')}
            </button>
          </>
        ) : (
          <p className="font-sans text-sm text-stone-gray mt-8">{t('confirmInfolettre.invalide')}</p>
        )}
      </div>
    </div>
  );
}

export default ConfirmationInfolettrePage;

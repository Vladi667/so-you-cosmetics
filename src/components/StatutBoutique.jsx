import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { statutBoutique } from '../services/shop';
import { noterAction } from '../services/audience';
import { LIEN_ITINERAIRE, TELEPHONE_LIEN } from '../data/boutique';

// « Ouvert · ferme à 18:30 », et de quoi y aller.
//
// Le but de la boutique en ligne est aussi de faire venir en boutique : une
// visiteuse arrivée d'une annonce, à dix minutes des Eaux-Vives, a besoin de
// deux choses — savoir si c'est ouvert, et le chemin. Les deux tiennent ici.
//
// L'état n'est calculé qu'une fois la page montée dans le navigateur : rendu
// par le serveur, il aurait l'heure du serveur au moment du rendu, et la page
// mise en cache dirait « ouvert » à minuit. Il se remet à jour chaque minute.
const StatutBoutique = ({ sombre = false, boutons = true, className = '' }) => {
  const { t, language } = useLanguage();
  const [statut, setStatut] = useState(null);

  useEffect(() => {
    const maj = () => setStatut(statutBoutique());
    const premier = setTimeout(maj, 0);
    const minuterie = setInterval(maj, 60 * 1000);
    return () => { clearTimeout(premier); clearInterval(minuterie); };
  }, []);

  let texte = '';
  if (statut && statut.exceptionnel) {
    const jour = statut.dans === 1
      ? t('boutique.statut.demain')
      : statut.date.toLocaleDateString({ fr: 'fr-CH', en: 'en-GB', de: 'de-CH' }[language] || 'fr-CH', { weekday: 'long', timeZone: 'Europe/Zurich' });
    texte = t('boutique.statut.exceptionnel', { jour, h: statut.heure });
  } else if (statut && statut.ouvert) texte = t('boutique.statut.ouvert', { h: statut.jusqua });
  else if (statut && statut.pause) texte = t('boutique.statut.pause', { h: statut.heure });
  else if (statut && statut.dans === 0) texte = t('boutique.statut.ouvreAujourdhui', { h: statut.heure });
  else if (statut && statut.dans === 1) texte = t('boutique.statut.ouvreDemain', { h: statut.heure });
  else if (statut) {
    const jour = statut.date.toLocaleDateString({ fr: 'fr-CH', en: 'en-GB', de: 'de-CH' }[language] || 'fr-CH', { weekday: 'long', timeZone: 'Europe/Zurich' });
    texte = t('boutique.statut.ouvreJour', { jour, h: statut.heure });
  }

  const pastille = statut && statut.ouvert ? 'bg-[#5B7A4A]' : 'bg-[#B9A891]';
  const bouton = sombre
    ? 'border-white/40 text-white hover:bg-white hover:text-slate-stone'
    : 'border-slate-stone/25 text-slate-stone hover:bg-slate-stone hover:text-white';

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-3 ${className}`}>
      {/* La place est tenue même vide : sans elle, les boutons sauteraient
          d'une ligne à l'arrivée du texte. */}
      <span className={`inline-flex items-center gap-2 font-sans text-xs sm:text-sm min-h-[1.25rem] ${sombre ? 'text-white/90' : 'text-slate-stone'}`}>
        {texte && <span aria-hidden="true" className={`inline-block w-2 h-2 rounded-full ${pastille}`} />}
        {texte}
      </span>
      {boutons && (
        <span className="flex flex-wrap gap-2">
          <a
            href={LIEN_ITINERAIRE}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => noterAction('itineraire')}
            className={`press inline-flex items-center gap-2 rounded-full border px-4 py-2 font-sans text-[10px] sm:text-xs uppercase tracking-[0.18em] transition-colors ${bouton}`}
          >
            <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {t('boutique.itineraire')}
          </a>
          <a
            href={`tel:${TELEPHONE_LIEN}`}
            onClick={() => noterAction('appel')}
            className={`press inline-flex items-center gap-2 rounded-full border px-4 py-2 font-sans text-[10px] sm:text-xs uppercase tracking-[0.18em] transition-colors ${bouton}`}
          >
            <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            {t('boutique.appeler')}
          </a>
        </span>
      )}
    </div>
  );
};

export default StatutBoutique;

import { useLanguage } from '../i18n/LanguageContext';
import Lien from './Lien';
import StatutBoutique from './StatutBoutique';
import { ADRESSE_RUE } from '../data/boutique';

// La boutique, juste sous l'image d'accueil.
//
// Celles qui arrivent d'une annonce locale cherchent souvent la boutique plus
// que le site : l'adresse, l'ouverture et l'itinéraire doivent se lire sans
// faire défiler la page.
const BandeauBoutique = () => {
  const { t } = useLanguage();
  return (
    <section className="bg-ivory border-b border-slate-stone/10">
      <div className="container mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Lien to="/contact" className="font-serif text-lg sm:text-xl text-slate-stone hover:text-stone-gray transition-colors">
            {t('boutique.bandeau')}
          </Lien>
          <p className="font-sans text-xs sm:text-sm text-stone-gray font-light mt-0.5">
            {ADRESSE_RUE} · {t('boutique.bandeauTexte')}
          </p>
        </div>
        <StatutBoutique />
      </div>
    </section>
  );
};

export default BandeauBoutique;

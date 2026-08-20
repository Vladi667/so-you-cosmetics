import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

// Ce qu'on montre d'un produit qui n'a pas encore de photo.
//
// Avant, le site tirait une image de banque Unsplash choisie par la longueur du
// nom — trois produits étaient donc vendus avec le savon d'une autre marque, sur
// un site dont l'argument entier est l'artisanat genevois. La cliente croyait
// voir ce qu'elle achetait.
//
// Un vide assumé vaut mieux qu'une image qui ment : elle apprend qu'il manque
// une photo, ce qui est la vérité, et le produit reste achetable.
const ProductPlaceholder = ({ className = '' }) => {
  const { t } = useLanguage();
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-lake-mist ${className}`}
      aria-hidden="true"
    >
      <span className="font-serif text-4xl tracking-[0.2em] text-slate-stone/15 select-none">SY</span>
      <span className="font-sans text-[11px] uppercase tracking-[0.18em] text-taupe/70">
        {t('catalog.photoComing')}
      </span>
    </div>
  );
};

export default ProductPlaceholder;

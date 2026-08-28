import React from 'react';

// L'icône d'un engagement, choisie par son rang.
//
// C'étaient des émojis — 🌴 🧴 ♻️ 🌱 📍 — posés dans une boîte grise. Un émoji
// est dessiné par le système d'exploitation : il n'a ni la couleur de la marque
// ni son trait, et il change d'aspect d'un téléphone à l'autre. Sur une page qui
// parle de fabrication artisanale, il se lit comme un pictogramme de messagerie.
//
// Celles-ci sont au trait, dans le style des SVG déjà présents ailleurs sur le
// site : 1,5 d'épaisseur, extrémités rondes, et `currentColor` — donc la teinte
// de la marque, et elles suivent le thème sans qu'on y touche.
//
// Une métaphore par engagement, et jamais deux fois la même : « intemporelles »
// prend le cercle du retour, « ne peuvent pas être précipitées » le sablier.
// Les confondre aurait donné deux fois le temps qui passe.
//
// Un rang sans dessin ne rend rien plutôt qu'une boîte vide — c'est exactement
// ce qui arrivait avec quatre émojis pour cinq cartes.
const CHEMINS = [
  // 0 · Chaque ingrédient a sa raison d'être — une pousse, choisie.
  <>
    <path d="M12 21v-8" />
    <path d="M12 13c0-3.3 2.5-6 5.5-6 .3 2.9-2 6-5.5 6Z" />
    <path d="M12 16c-2.8 0-5-2.3-4.8-5C9.8 11.2 12 13.4 12 16Z" />
  </>,
  // 1 · Des formules intemporelles — ce vers quoi l'on revient.
  <>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4.5V9h4.5" />
  </>,
  // 2 · Au-delà de l'étiquette — l'étiquette, et ce qu'elle ne dit pas.
  <>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4.8A2 2 0 0 1 4.8 2.8H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8Z" />
    <circle cx="7.5" cy="7.5" r="1.3" />
  </>,
  // 3 · Local par choix — le relief genevois.
  <>
    <path d="M2.5 19h19" />
    <path d="M2.5 19 9 8l4 6.2 2.2-3.2L21.5 19" />
    <path d="M9 8l1.9 3.2" />
  </>,
  // 4 · Certaines choses ne peuvent pas être précipitées — la saponification à froid.
  <>
    <path d="M6.5 3h11M6.5 21h11" />
    <path d="M8 3v3.2c0 1.5 1.2 2.6 2.4 3.5.9.6.9 1.9 0 2.6C9.2 13.2 8 14.3 8 15.8V21" />
    <path d="M16 3v3.2c0 1.5-1.2 2.6-2.4 3.5-.9.6-.9 1.9 0 2.6 1.2.9 2.4 2 2.4 3.5V21" />
  </>,
];

// Les trois piliers de « fait main à Genève », et le colis de la fiche produit.
// Mêmes raisons, même trait : 🤍 🌿 💧 et 📦 souffraient exactement du même
// défaut que les cinq précédents.
const AUTRES = {
  // Votre peau, votre plus belle tenue.
  peau: (
    <>
      <path d="M12 21s-7-4.4-7-9.6A4.4 4.4 0 0 1 12 8a4.4 4.4 0 0 1 7 3.4C19 16.6 12 21 12 21Z" />
    </>
  ),
  // Les tendances passent. La beauté naturelle demeure.
  feuille: (
    <>
      <path d="M4 20c0-8 5-14 16-14 0 9-5 14-11.5 14H4Z" />
      <path d="M8 16c2.5-3.5 5.5-5.8 9-7" />
    </>
  ),
  // Votre peau est intuitive. Êtes-vous à l'écoute ?
  goutte: (
    <>
      <path d="M12 3s6 6.4 6 10.5A6 6 0 0 1 6 13.5C6 9.4 12 3 12 3Z" />
      <path d="M9.5 14.2a2.7 2.7 0 0 0 2.5 2.3" />
    </>
  ),
  // Le bloc livraison de la fiche produit.
  colis: (
    <>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
      <path d="M3 7.5 12 12l9-4.5M12 12v9" />
    </>
  ),
};

export const IconeSimple = ({ nom, className = '' }) => {
  const dessin = AUTRES[nom];
  if (!dessin) return null;
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}
    >
      {dessin}
    </svg>
  );
};

const IconeEngagement = ({ index, className = '' }) => {
  const dessin = CHEMINS[index];
  if (!dessin) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {dessin}
    </svg>
  );
};

export default IconeEngagement;

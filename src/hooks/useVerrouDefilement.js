import { useEffect } from 'react';

// Empêcher la page de défiler derrière une surface qui la recouvre.
//
// Seul le menu mobile le faisait. Les tiroirs du panier et des favoris, non :
// on faisait défiler le panier, on arrivait au bout, et c'est la page derrière
// qui repartait — en emportant le tiroir hors de l'écran.
//
// Le compteur n'est pas une précaution théorique : le menu mobile et un tiroir
// peuvent être ouverts en même temps. Avec un simple booléen, fermer l'un rend
// le défilement à la page alors que l'autre la recouvre encore.
let demandes = 0;
let valeurInitiale = '';
let margeInitiale = '';

export default function useVerrouDefilement(actif) {
  useEffect(() => {
    if (!actif) return undefined;

    if (demandes === 0) {
      valeurInitiale = document.body.style.overflow;
      margeInitiale = document.body.style.paddingRight;
      // Masquer la barre de défilement rend sa largeur à la page : sans
      // compensation, tout le contenu saute de quelques pixels vers la droite
      // à l'ouverture, puis revient à la fermeture.
      const largeurBarre = window.innerWidth - document.documentElement.clientWidth;
      if (largeurBarre > 0) {
        document.body.style.paddingRight = `${largeurBarre}px`;
      }
      document.body.style.overflow = 'hidden';
    }
    demandes += 1;

    return () => {
      // Jamais sous zéro : React remonte les effets deux fois en développement,
      // et un compteur négatif ne repasserait plus jamais par zéro — la page
      // resterait bloquée pour le reste de la visite.
      demandes = Math.max(0, demandes - 1);
      if (demandes === 0) {
        document.body.style.overflow = valeurInitiale;
        document.body.style.paddingRight = margeInitiale;
      }
    };
  }, [actif]);
}

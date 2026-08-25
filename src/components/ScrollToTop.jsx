import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Remonter en haut à chaque changement de page.
//
// Sept pages le faisaient chacune pour soi, dans leur propre effet — et les
// pages arrivées ensuite l'ont oublié : le Journal et la fiche atelier
// s'ouvraient au milieu, à la hauteur où le lecteur avait laissé la page
// précédente. Écrit une fois ici, aucune page nouvelle ne peut plus l'oublier.
//
// Monté DANS le Router : `useLocation` lève hors contexte, ce qui ferait tomber
// l'application entière. App est enfant de BrowserRouter, donc ce composant
// rendu par App l'est aussi.
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Instantané, pas « smooth » : une nouvelle page n'est pas un déplacement
    // dans la page courante. Regarder défiler l'ancienne avant de découvrir la
    // nouvelle n'apprend rien et retarde la lecture.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
};

export default ScrollToTop;

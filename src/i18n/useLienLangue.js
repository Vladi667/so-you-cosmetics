import { useLocation } from 'react-router-dom';
import { separerLangue, avecLangue } from './routes';

// L'adresse d'un chemin dans la langue de la page courante.
//
// Pour les rares endroits qui naviguent sans passer par un lien : la recherche,
// et le bouton de réservation d'un atelier. Partout ailleurs, <Lien> s'en
// charge tout seul.
//
// Dans son propre fichier plutôt qu'à côté du composant : un module qui exporte
// à la fois un composant et autre chose casse le rafraîchissement à chaud de
// Vite, qui ne sait alors plus quoi remplacer.
export default function useLienLangue() {
  const { pathname } = useLocation();
  const { langue } = separerLangue(pathname);
  return (chemin) => avecLangue(chemin, langue);
}

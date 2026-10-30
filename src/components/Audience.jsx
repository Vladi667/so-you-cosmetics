import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { noterPage } from '../services/audience';

// Compte chaque page vue, sans cookie — voir server/audience.js.
//
// Monté dans le Router, comme ScrollToTop, et seulement hors de
// l'administration : ses propres passages ne sont pas des visites.
const Audience = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    noterPage(pathname);
  }, [pathname]);

  return null;
};

export default Audience;

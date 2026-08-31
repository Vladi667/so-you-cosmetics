import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';

// Le routeur enveloppe le fournisseur de langue, et non l'inverse.
//
// La langue est desormais lue dans l'adresse : LanguageProvider appelle donc
// useLocation, qui n'existe qu'a l'interieur du routeur. Dans l'ordre
// precedent, il levait des le premier rendu.
const arbre = (
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>
);

const racine = document.getElementById('root');

// Hydrater ou monter, selon ce que le serveur a envoyé.
//
// Le serveur rend maintenant le corps de la page (src/entry-server.jsx), mais
// il peut aussi ne pas le faire : le rendu est enveloppé d'un filet côté
// serveur, et retombe sur la coquille vide si quoi que ce soit échoue. Le site
// doit donc démarrer dans les deux cas.
//
// hydrateRoot sur un conteneur vide produirait un avertissement et un rendu
// complet de toute façon ; createRoot sur un corps déjà rendu jetterait le
// travail du serveur et referait tout. On regarde donc ce qu'on a reçu.
if (racine.hasChildNodes()) {
  hydrateRoot(racine, arbre);
} else {
  createRoot(racine).render(arbre);
}

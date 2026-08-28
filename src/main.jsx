import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';

// Le routeur enveloppe le fournisseur de langue, et non l'inverse.
//
// La langue est desormais lue dans l'adresse : LanguageProvider appelle donc
// useLocation, qui n'existe qu'a l'interieur du routeur. Dans l'ordre
// precedent, il levait des le premier rendu.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)

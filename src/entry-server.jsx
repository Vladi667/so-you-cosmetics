import React from 'react';
import { renderToString } from 'react-dom/server';
// Depuis react-router-dom, et non « react-router-dom/server » : ce sous-chemin
// existait en v6 et a disparu en v7, où StaticRouter est exporté directement.
import { StaticRouter } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import App from './App.jsx';

// Pas d'import de la feuille de style ici, à dessein : le rendu serveur produit
// du balisage, pas de la mise en forme. dist/index.html lie déjà la feuille
// émise par la construction client, et la faire passer par Tailwind une seconde
// fois dans l'environnement serveur échouait à la résoudre.

// Le rendu du corps de la page par le serveur — l'étape 3.
//
// Jusqu'ici le serveur écrivait un <head> complet pour chaque route, et un
// <body> vide. C'est suffisant pour Google, qui exécute le JavaScript, et pour
// les aperçus de lien, qui ne lisent que le <head>. Ça ne l'est pas pour tout
// le reste : Bing sur un domaine sans notoriété, GPTBot, PerplexityBot,
// ClaudeBot, Pinterest — tous lisent le HTML tel qu'il arrive.
//
// Ce fichier est le seul ajout côté navigateur. Le serveur reste le même, les
// routes restent les mêmes, l'API ne bouge pas : renderToString est appelé dans
// le fourre-tout existant, et le <head> déjà construit par server/seo.js est
// repris tel quel.
//
// Les données sont posées sur globalThis avant le rendu, pas passées en props.
// C'est délibéré : le navigateur les lit au même endroit (window EST globalThis
// dans un navigateur), donc le premier rendu client reproduit exactement le
// rendu serveur. Passer par des props obligerait à dupliquer le chemin de
// données, et deux chemins finissent toujours par diverger.
export function rendre({ url, contenu, reglages, catalogue, seo }) {
  globalThis.__CONTENT__ = contenu || {};
  globalThis.__SHOP__ = reglages || {};
  globalThis.__CATALOGUE__ = Array.isArray(catalogue) ? catalogue : [];
  globalThis.__SEO__ = seo || null;

  try {
    return renderToString(
      <StaticRouter location={url}>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </StaticRouter>
    );
  } finally {
    // Le processus sert toutes les requêtes. Sans ce nettoyage, le catalogue et
    // les métadonnées d'une page resteraient posés pour la suivante — et une
    // fiche produit rendrait le titre de la précédente.
    globalThis.__CONTENT__ = undefined;
    globalThis.__SHOP__ = undefined;
    globalThis.__CATALOGUE__ = undefined;
    globalThis.__SEO__ = undefined;
  }
}

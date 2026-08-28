import { useEffect } from 'react';

// Le titre et la description de la page courante.
//
// Le site est une application à page unique : une seule index.html sert les
// vingt routes. Sans rien faire, les 178 fiches produit portent donc le même
// titre — celui du fichier — et aucune description. Trois conséquences, dont
// deux visibles avant même le référencement :
//
//   · l'onglet du navigateur, le favori et l'historique disent tous « So You
//     Cosmetics » : quelqu'un qui garde trois produits ouverts ne les
//     distingue pas ;
//   · un lien partagé s'affiche en URL nue, sans titre ni image, faute de
//     balises Open Graph ;
//   · le jour du lancement, un moteur verrait 178 pages jumelles.
//
// Ce dernier point est différé : index.html porte volontairement un
// « noindex » et public/robots.txt un « Disallow: / », le temps que la
// boutique ouvre. Ces deux-là ne sont pas touchés ici — les retirer est une
// décision de lancement, pas un détail technique.
//
// Les balises absentes sont créées, les existantes réutilisées, et tout est
// rendu à son état d'origine en quittant la page : une page sans description
// ne doit pas hériter de celle de la précédente.
const DEFAUT_TITRE = 'So You Cosmetics — Cosmétiques naturels faits main à Genève';

function baliseMeta(cle, valeur, parPropriete = false) {
  const attribut = parPropriete ? 'property' : 'name';
  let balise = document.head.querySelector(`meta[${attribut}="${cle}"]`);
  if (valeur === null || valeur === undefined || valeur === '') {
    // Ne retirer que ce que nous avons posé : le « noindex » d'avant-lancement
    // vit dans index.html et ne doit jamais disparaître par ce chemin.
    if (balise && balise.dataset.pose === 'app') balise.remove();
    return;
  }
  if (!balise) {
    balise = document.createElement('meta');
    balise.setAttribute(attribut, cle);
    balise.dataset.pose = 'app';
    document.head.appendChild(balise);
  }
  balise.setAttribute('content', valeur);
}

function lienCanonique(href) {
  let lien = document.head.querySelector('link[rel="canonical"]');
  if (!href) {
    if (lien && lien.dataset.pose === 'app') lien.remove();
    return;
  }
  if (!lien) {
    lien = document.createElement('link');
    lien.setAttribute('rel', 'canonical');
    lien.dataset.pose = 'app';
    document.head.appendChild(lien);
  }
  lien.setAttribute('href', href);
}

// Les fiches produit sont écrites en HTML : retirer les balises ne suffit pas,
// il reste les entités. Une description importée de Wix est pleine de &nbsp;,
// et « pour&nbsp;parfaire le nettoyage » s'afficherait tel quel dans Google et
// dans l'aperçu d'un lien partagé.
//
// Le decodage passe par un <textarea> : son contenu est analysé comme du texte
// pur, donc aucune balise n'est construite et aucune image ne part se charger —
// ce qu'un innerHTML sur un <div> ferait.
function decoderEntites(texte) {
  if (typeof document === 'undefined') return texte;
  const zone = document.createElement('textarea');
  zone.innerHTML = texte;
  return zone.value;
}

// Coupe proprement : on préfère une phrase entière un peu courte à une phrase
// tronquée au milieu d'un mot, que les moteurs affichent telle quelle.
export function resumer(texte, limite = 160) {
  const propre = decoderEntites(String(texte || '').replace(/<[^>]*>/g, ' '))
    // L'espace insécable de &nbsp; est invisible mais n'est pas une espace :
    // sans cette ligne, la collecte ci-dessous le laisserait s'accumuler.
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (propre.length <= limite) return propre;
  const coupe = propre.slice(0, limite);
  const dernier = Math.max(coupe.lastIndexOf('. '), coupe.lastIndexOf(' '));
  return (dernier > limite * 0.5 ? coupe.slice(0, dernier) : coupe).trim() + '…';
}

// La langue du document n'est pas réglée ici : LanguageContext en est le seul
// propriétaire, et deux effets qui écrivent le même attribut finissent toujours
// par se contredire dans un ordre qu'on ne contrôle pas.
// Ce que le serveur a déjà posé pour la page reçue, s'il s'agit toujours d'elle.
//
// Le serveur écrit un titre et une description pensés pour la recherche —
// « Savons artisanaux faits main à Genève » là où la page ne sait dire que
// « Savons ». Sans cette lecture, le hook écrasait ce texte au montage par le
// sien, et comme Google exécute le JavaScript avant de lire la page, c'est la
// version pauvre qui était indexée.
//
// La comparaison porte sur le chemin seul : une même page ouverte avec un
// ?utm_source reste la même page, tandis qu'une navigation vers une autre route
// rend la main au hook, dont c'est alors le tour.
function duServeur() {
  if (typeof window === 'undefined' || !window.__SEO__) return null;
  return window.__SEO__.chemin === window.location.pathname ? window.__SEO__ : null;
}

export default function useMetadonnees({ titre, description, image, type = 'website' } = {}) {
  const serveur = duServeur();
  const titreComplet = (serveur && serveur.titre)
    || (titre ? `${titre} — So You Cosmetics` : DEFAUT_TITRE);
  const resume = (serveur && serveur.description) || (description ? resumer(description) : '');
  const url = typeof window !== 'undefined' ? window.location.href.split('#')[0] : '';
  const absolue = image && typeof window !== 'undefined'
    ? new URL(image, window.location.origin).href
    : '';

  useEffect(() => {
    document.title = titreComplet;

    baliseMeta('description', resume);
    baliseMeta('og:title', titreComplet, true);
    baliseMeta('og:description', resume, true);
    baliseMeta('og:type', type, true);
    baliseMeta('og:url', url, true);
    baliseMeta('og:site_name', 'So You Cosmetics', true);
    baliseMeta('og:image', absolue, true);
    // Sans image, une grande carte afficherait un cadre vide : on annonce
    // alors la petite, qui est faite pour se passer d'illustration.
    baliseMeta('twitter:card', absolue ? 'summary_large_image' : 'summary');
    lienCanonique(url);

    return () => {
      document.title = DEFAUT_TITRE;
      baliseMeta('description', '');
      baliseMeta('og:title', '', true);
      baliseMeta('og:description', '', true);
      baliseMeta('og:image', '', true);
      baliseMeta('og:url', '', true);
      lienCanonique('');
    };
  }, [titreComplet, resume, absolue, url, type]);
}

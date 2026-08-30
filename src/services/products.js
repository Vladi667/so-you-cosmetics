// Module-level cache so the product list is fetched at most once per session.
// On any network failure we fall back to the bundled static JSON.
let cachedPromise = null;

export function getProducts() {
  if (cachedPromise) return cachedPromise;

  cachedPromise = fetch('/api/products')
    .then(res => {
      if (!res.ok) throw new Error('Network response not ok');
      return res.json();
    })
    .catch(err => {
      console.warn('API error fetching products, falling back to local static JSON:', err);
      // Le repli est charge a la demande, pas au chargement de la page.
      //
      // Il etait importe en haut de ce fichier : 444 Ko de JSON — le catalogue
      // entier, formate — entraient donc dans le paquet principal que chaque
      // visiteur telecharge, pour ne servir que le jour ou l'API ne repond
      // pas. Un import() en fait un morceau separe, demande seulement dans ce
      // cas-la, c'est-a-dire presque jamais.
      return import('../data/products.json').then((m) => (m.default || m).products);
    });

  return cachedPromise;
}

// Les photos du catalogue portent leur taille dans leur adresse : le gabarit
// Wix .../v1/fill/w_800,h_1000,... est figé dans la donnée. Le cadre d'une fiche
// produit fait environ 550 px, soit 1100 px sur un écran Retina — servir du
// 800 px, c'est du flou exactement là où on regarde la matière d'un savon fait
// main. Le même fichier existe en 1600 px chez Wix pour 114 Ko contre 35.
//
// On ne réécrit QUE les adresses Wix qui portent ce gabarit. Les photos qu'elle
// a téléversées (/uploads/…) et les liens Google Drive n'ont pas cette forme et
// passent inchangés.
//
// Le ratio 4/5 est celui des trois cadres du site (catalogue, fiche,
// suggestions) : demander autre chose ferait recadrer Wix.
// Les photos rapatriées de Wix, déposées par scripts/rapatrier-images.mjs :
//
//     /uploads/catalogue/<empreinte>-<largeur>.jpg
//
// Elles existent en 400, 800 et 1600, en JPEG et en AVIF. Le serveur choisit le
// format selon ce que le navigateur accepte ; ici on ne choisit que la largeur.
// Sans cette reconnaissance, le rapatriement ferait perdre le srcset gagné la
// veille : toutes les adresses locales seraient servies à la même taille.
const CATALOGUE_LOCAL = /^(\/uploads\/catalogue\/[a-f0-9]+)-(\d+)\.jpg$/i;
const LARGEURS_LOCALES = [400, 800, 1600];

// La largeur disponible la plus proche par le haut : mieux vaut une image un peu
// trop grande que floue.
function largeurLocale(voulue) {
  return LARGEURS_LOCALES.find((l) => l >= voulue) || LARGEURS_LOCALES[LARGEURS_LOCALES.length - 1];
}

export function imageUrl(src, largeur = 800) {
  if (typeof src !== 'string' || !src) return src;

  const local = src.match(CATALOGUE_LOCAL);
  if (local) return `${local[1]}-${largeurLocale(largeur)}.jpg`;

  const hauteur = Math.round(largeur * 5 / 4);
  const url = src.replace(/w_\d+,h_\d+/, `w_${largeur},h_${hauteur}`);
  return avecFormatAuto(url);
}

// « enc_auto » demande à Wix de choisir le format selon ce que le navigateur
// annonce accepter : WebP, ou AVIF là où il est reconnu, et JPEG pour le reste.
//
// Les 431 adresses du catalogue ne le portaient pas : chaque photo partait en
// JPEG, y compris vers des navigateurs qui savent lire deux fois plus léger
// depuis des années. C'est un paramètre à ajouter, pas une image à reconvertir —
// les fichiers restent ceux de Wix, c'est leur serveur qui fait le travail.
//
// Ajouté juste avant « /file.xxx », qui termine le segment de transformation.
// Une adresse d'une autre forme — les photos qu'elle téléverse, un lien Drive —
// n'a pas ce segment et passe inchangée.
function avecFormatAuto(url) {
  if (!/\/v1\/[a-z]+\//i.test(url) || url.includes('enc_auto')) return url;
  return url.replace(/\/(file\.[a-z0-9]+)(\?|$)/i, ',enc_auto/$1$2');
}

// Les largeurs proposées au navigateur, pour qu'il prenne celle qui correspond
// à son écran plutôt que la plus grande.
//
// La fiche produit demandait 1600 px à tout le monde, y compris à un téléphone
// de 375 px de large : trois fois les octets nécessaires, sur l'élément
// précisément mesuré par le LCP. Avec un srcset, c'est le navigateur qui
// tranche, et il connaît sa densité de pixels mieux que nous.
const LARGEURS = [400, 600, 800, 1200, 1600];

export function imageSrcSet(src, largeurMax = 1600) {
  if (typeof src !== 'string' || !src) return undefined;

  // Les photos rapatriées : trois largeurs réellement présentes sur le disque.
  // On n'annonce que celles-là — proposer une largeur qui n'existe pas ferait
  // demander au navigateur un fichier absent.
  if (CATALOGUE_LOCAL.test(src)) {
    return LARGEURS_LOCALES
      .filter((l) => l <= largeurMax)
      .map((l) => `${imageUrl(src, l)} ${l}w`)
      .join(', ');
  }

  // Uniquement les adresses Wix pour le reste : elles seules savent se
  // redimensionner. Une photo qu'elle téléverse depuis l'administration n'existe
  // qu'en une taille, et proposer des largeurs qui renverraient toutes le même
  // fichier ferait choisir la plus grande au navigateur — l'inverse de ce qu'on
  // cherche.
  if (!/\/v1\/[a-z]+\//i.test(src) || !/w_\d+,h_\d+/.test(src)) return undefined;
  return LARGEURS
    .filter((l) => l <= largeurMax)
    .map((l) => `${imageUrl(src, l)} ${l}w`)
    .join(', ');
}

// Applique le gabarit voulu à toutes les images d'un produit, sans le muter.
export function withImageWidth(product, largeur) {
  if (!product || !Array.isArray(product.images)) return product;
  return { ...product, images: product.images.map((u) => imageUrl(u, largeur)) };
}

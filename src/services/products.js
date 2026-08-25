import productsData from '../data/products.json';

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
      return productsData.products;
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
export function imageUrl(src, largeur = 800) {
  if (typeof src !== 'string' || !src) return src;
  const hauteur = Math.round(largeur * 5 / 4);
  return src.replace(/w_\d+,h_\d+/, `w_${largeur},h_${hauteur}`);
}

// Applique le gabarit voulu à toutes les images d'un produit, sans le muter.
export function withImageWidth(product, largeur) {
  if (!product || !Array.isArray(product.images)) return product;
  return { ...product, images: product.images.map((u) => imageUrl(u, largeur)) };
}

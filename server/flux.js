// Le flux produits, pour les fiches gratuites de Google Shopping.
//
// Un flux est la seule façon d'entrer dans l'onglet Shopping et dans les
// « fiches produit gratuites » — un affichage qui ne coûte rien et qui montre
// la photo, le prix et la disponibilité, là où un lien bleu ne montre qu'un
// titre. Pour une boutique sans notoriété de domaine, c'est un des rares
// endroits où l'on peut apparaître à côté d'acteurs installés.
//
// Rien de tout cela n'existait : ni flux, ni les identifiants qu'un flux
// demande. Ce module compose ce qu'il peut à partir de ce que le catalogue
// porte réellement, et ÉCARTE ce qui rendrait le flux invalide plutôt que de
// l'inventer — un flux à moitié faux est rejeté en bloc, et le compte peut être
// suspendu pour des prix qui ne correspondent pas à la page.
//
// Servi à /flux-produits.xml, à déclarer dans Merchant Center comme flux
// programmé. Il se construit à la demande depuis la base : elle change un prix,
// le flux suit à la prochaine lecture de Google.

const seo = require('./seo');

// Ce que Google exige pour chaque article, et qui manque au catalogue :
//
//   · gtin  — un code-barres. Un savon fait main n'en a pas, et c'est normal.
//   · mpn   — une référence fabricant. Elle n'en tient pas.
//
// « identifier_exists: no » est la réponse prévue pour exactement ce cas :
// l'artisanat sans code-barres. L'omettre ferait rejeter chaque article ;
// inventer un GTIN serait pire.
const MARQUE = 'So You Cosmetics';

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Le titre : 150 caractères au maximum chez Google, et coupé net au-delà.
function titre(nom) {
  const propre = String(nom || '').replace(/\s+/g, ' ').trim();
  return propre.length <= 150 ? propre : propre.slice(0, 149).trim() + '…';
}

// Retient un produit, ou dit pourquoi il est écarté.
//
// Les raisons sont conservées et journalisées : un catalogue de 177 fiches dont
// 7 sont absentes du flux doit pouvoir s'expliquer en une ligne, sinon on
// cherche des semaines pourquoi un produit n'apparaît pas.
function evaluer(produit, base) {
  if (!produit || !produit.id || !produit.name) return { ok: false, raison: 'sans nom ni identifiant' };

  const prix = Number(produit.price);
  // Les quatre « sur devis » — trois collections et la commande personnalisée.
  // Un article à 0.00 ferait afficher « gratuit », et Merchant Center compare
  // le prix du flux à celui de la page : un écart suspend le compte.
  if (!Number.isFinite(prix) || prix <= 0) return { ok: false, raison: 'prix sur devis' };

  const images = Array.isArray(produit.images) ? produit.images.filter(Boolean) : [];
  // image_link est obligatoire. Trois fiches n'ont aucune photo.
  if (!images.length) return { ok: false, raison: 'aucune photo' };

  const image = seo.absolutiser(images[0], base);
  if (!image) return { ok: false, raison: 'photo non résoluble' };

  const description = seo.resumerTexte(produit.description, 5000);
  if (!description) return { ok: false, raison: 'aucune description' };

  return {
    ok: true,
    article: {
      id: produit.id,
      titre: titre(produit.name),
      description,
      lien: `${base}/product/${seo.slugProduit(produit)}`,
      image,
      imagesEnPlus: images.slice(1, 11).map((u) => seo.absolutiser(u, base)).filter(Boolean),
      prix: prix.toFixed(2),
      // Le champ n'existe que sur une partie des fiches, et vaut vrai par
      // défaut côté base : on ne déclare « en rupture » que si c'est écrit.
      // Un « !inStock » aurait mis 170 produits en rupture dans le flux.
      dispo: produit.inStock === false ? 'out_of_stock' : 'in_stock',
      rubrique: (Array.isArray(produit.collections) && produit.collections[0]) || '',
    },
  };
}

function article(a) {
  const champs = [
    `<g:id>${escapeXml(a.id)}</g:id>`,
    `<g:title>${escapeXml(a.titre)}</g:title>`,
    `<g:description>${escapeXml(a.description)}</g:description>`,
    `<g:link>${escapeXml(a.lien)}</g:link>`,
    `<g:image_link>${escapeXml(a.image)}</g:image_link>`,
    ...a.imagesEnPlus.map((u) => `<g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`),
    `<g:availability>${a.dispo}</g:availability>`,
    `<g:price>${a.prix} CHF</g:price>`,
    `<g:condition>new</g:condition>`,
    `<g:brand>${escapeXml(MARQUE)}</g:brand>`,
    `<g:identifier_exists>no</g:identifier_exists>`,
    a.rubrique ? `<g:product_type>${escapeXml(a.rubrique)}</g:product_type>` : '',
  ];
  return `<item>${champs.filter(Boolean).join('')}</item>`;
}

async function construireFlux(base, db) {
  const produits = await db.getProducts();
  const liste = Array.isArray(produits) ? produits : [];

  const retenus = [];
  const ecartes = {};
  for (const p of liste) {
    const r = evaluer(p, base);
    if (r.ok) retenus.push(r.article);
    else ecartes[r.raison] = (ecartes[r.raison] || 0) + 1;
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>` +
    `<title>${escapeXml(MARQUE)}</title>` +
    `<link>${escapeXml(base)}</link>` +
    `<description>Cosmétiques naturels faits main à Genève</description>` +
    retenus.map(article).join('') +
    `</channel></rss>`;

  return { xml, retenus: retenus.length, total: liste.length, ecartes };
}

module.exports = { construireFlux, evaluer };

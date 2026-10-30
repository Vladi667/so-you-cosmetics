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
const { sku } = require('./caisse');

// La catégorie Google de chaque article (identifiants de la taxonomie
// officielle, vérifiés dans taxonomy-with-ids.en-US.txt en octobre 2026).
//
// Le nom décide d'abord — « Shampoing solide » dit plus que la rubrique
// « Soins Capillaires » —, la rubrique ensuite. Une catégorie juste fait
// apparaître l'article sur les bonnes recherches et règle d'office des
// questions comme la TVA ou les restrictions d'âge.
const CATEGORIES_PAR_NOM = [
  [/apr[eè]s[- ]shampo/i, 543616],               // Conditioners
  [/shampo/i, 543615],                            // Shampoo
  [/savon liquide|savons liquides/i, 474],        // Bath & Body
  [/savon/i, 2503],                               // Bar Soap
  [/loofa|[ée]ponge|konjac/i, 2875],              // Bath Sponges & Loofahs
  [/d[ée]odorant/i, 543598],                      // Deodorant
  [/dentifrice/i, 1360],                          // Toothpaste
  [/l[èe]vres/i, 543573],                         // Lip Balms
  [/masque/i, 6262],                              // Skin Care Masks & Peels
  [/glitter|huile[^,]*corps|huile de massage/i, 6104], // Body Oil
  [/sels? de bain|boules? .*bain|galets? .*bain/i, 2522], // Bath Additives
  [/parfum d.ambiance|bougie|diffuseur/i, 592],   // Home Fragrances
  [/parfum/i, 479],                               // Perfume & Cologne
  [/primer|maquillage/i, 477],                    // Makeup
  [/hydrolat|eau florale|aloe/i, 567],            // Skin Care
  [/huile/i, 6104],                               // Body Oil
  [/lotion|cr[èe]me|cream|lait de toilette|baume/i, 2592], // Lotion & Moisturizer
];
const CATEGORIES_PAR_RUBRIQUE = {
  Savons: 2503,
  'Soins Capillaires': 486,
  'Soins Visage': 567,
  'Soins Corps': 567,
  'Bain & Bien-être': 474,
  Maquillage: 477,
  Parfums: 479,
  Ambiance: 592,
  Accessoires: 2619,
};

function categorieGoogle(produit) {
  if (produit.bonCadeau) return 53;               // Gift Cards & Certificates
  const nom = String(produit.name || '');
  for (const [motif, id] of CATEGORIES_PAR_NOM) if (motif.test(nom)) return id;
  for (const r of produit.collections || []) if (CATEGORIES_PAR_RUBRIQUE[r]) return CATEGORIES_PAR_RUBRIQUE[r];
  return 473;                                     // Cosmetics
}

// Un nom de fiche sans les guillemets des noms de gamme (« 'So Lumineux' ») :
// dans une annonce Shopping, ils ne sont que du bruit.
function nomPropre(nom) {
  return String(nom || '')
    .replace(/['’"«»]{1,2}([^'’"«»]+?)['’"«»]{1,2}(?=[\s\-–—,.]|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Une description trop courte ne dit rien à l'acheteur ni à Google : on la
// complète par ce qui est vrai de tout le catalogue.
const COMPLEMENT = 'So You Cosmetics, boutique de cosmétiques naturels à Genève (Eaux-Vives). Retrait gratuit en boutique ou livraison en Suisse.';

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
  // Google Shopping n'accepte que des objets expédiables : un atelier est un
  // service, et les cartes cadeaux (formats A à F, sans valeur dans le nom)
  // n'ont rien à gagner à une annonce produit. Les deux restent en vente sur
  // le site.
  if (produit.bonCadeau) return { ok: false, raison: 'carte cadeau' };
  if (/^\s*atelier/i.test(produit.name)) return { ok: false, raison: 'atelier (service)' };

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

  const lien = `${base}/product/${seo.slugProduit(produit)}`;
  const commun = {
    description: description.length < 150 ? `${description} ${COMPLEMENT}` : description,
    image,
    imagesEnPlus: images.slice(1, 11).map((u) => seo.absolutiser(u, base)).filter(Boolean),
    // Le champ n'existe que sur une partie des fiches, et vaut vrai par
    // défaut côté base : on ne déclare « en rupture » que si c'est écrit, ou
    // si le stock suivi est tombé à zéro. Un « !inStock » aurait mis 170
    // produits en rupture dans le flux.
    dispo: produit.inStock === false || produit.stock === 0 ? 'out_of_stock' : 'in_stock',
    categorie: categorieGoogle(produit),
    poids: Number(produit.poids) > 0 ? Math.round(Number(produit.poids)) : null,
  };

  // Une fiche à formats (15, 30, 50 ml) devient un article par format, chacun
  // à son prix, groupés par item_group_id. Annoncer le seul plus petit prix
  // pour toute la fiche, c'était afficher 33.50 dans Google pour un pot qui
  // en coûte 82.50 sur la page — l'écart que Merchant Center sanctionne. Le
  // lien ouvre la fiche sur ce format (?format=…), au prix annoncé.
  const variantes = (Array.isArray(produit.variantes) ? produit.variantes : [])
    .filter((v) => Number(v.prix) > 0);
  if (variantes.length) {
    // Un nom qui porte déjà un format (« … - 15 ml ») le perd : chaque
    // article reçoit le sien.
    const nom = nomPropre(produit.name).replace(/\s*[-–—]\s*\d+([.,]\d+)?\s*(ml|g|cl|l)$/i, '');
    const articles = variantes.map((v) => {
      const libelle = String(v.libelle || v.id || '').trim();
      return {
        ...commun,
        id: sku(produit, v),
        groupe: sku(produit),
        taille: libelle,
        titre: titre(nom.toLowerCase().includes(libelle.toLowerCase()) ? nom : `${nom} – ${libelle}`),
        lien: `${lien}?format=${encodeURIComponent(v.id)}`,
        prix: Number(v.prix).toFixed(2),
        poids: Number(v.poids) > 0 ? Math.round(Number(v.poids)) : commun.poids,
        rubrique: (Array.isArray(produit.collections) && produit.collections[0]) || '',
        coupDeCoeur: Array.isArray(produit.collections) && produit.collections.includes('Coup de cœur'),
        tranche: Number(v.prix) < 15 ? 'moins-de-15' : Number(v.prix) < 35 ? '15-35' : 'plus-de-35',
        misEnAvant: produit.annonces === true,
      };
    });
    return { ok: true, article: articles[0], articles };
  }

  const article = {
    ...commun,
    id: sku(produit),
    titre: titre(nomPropre(produit.name)),
    lien,
    prix: prix.toFixed(2),
      rubrique: (Array.isArray(produit.collections) && produit.collections[0]) || '',
      // Deux étiquettes pour Google Ads, qui ne servent qu'à ranger les
      // annonces Shopping : mettre en avant ses coups de cœur, et ne pas
      // enchérir autant sur un savon à 9 francs que sur un coffret à 60.
      coupDeCoeur: Array.isArray(produit.collections) && produit.collections.includes('Coup de cœur'),
      tranche: prix < 15 ? 'moins-de-15' : prix < 35 ? '15-35' : 'plus-de-35',
      // Choisi par elle, produit par produit, dans l'administration.
      misEnAvant: produit.annonces === true,
  };
  return { ok: true, article, articles: [article] };
}

function article(a) {
  const champs = [
    `<g:id>${escapeXml(a.id)}</g:id>`,
    `<g:title>${escapeXml(a.titre)}</g:title>`,
    `<g:description>${escapeXml(a.description)}</g:description>`,
    `<g:link>${escapeXml(a.lien)}</g:link>`,
    `<g:image_link>${escapeXml(a.image)}</g:image_link>`,
    ...a.imagesEnPlus.map((u) => `<g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`),
    a.groupe ? `<g:item_group_id>${escapeXml(a.groupe)}</g:item_group_id>` : '',
    a.taille ? `<g:size>${escapeXml(a.taille)}</g:size>` : '',
    a.categorie ? `<g:google_product_category>${a.categorie}</g:google_product_category>` : '',
    a.poids ? `<g:shipping_weight>${a.poids} g</g:shipping_weight>` : '',
    `<g:availability>${a.dispo}</g:availability>`,
    `<g:price>${a.prix} CHF</g:price>`,
    `<g:condition>new</g:condition>`,
    `<g:brand>${escapeXml(MARQUE)}</g:brand>`,
    `<g:identifier_exists>no</g:identifier_exists>`,
    a.rubrique ? `<g:product_type>${escapeXml(a.rubrique)}</g:product_type>` : '',
    `<g:custom_label_0>${a.coupDeCoeur ? 'coup-de-coeur' : 'catalogue'}</g:custom_label_0>`,
    `<g:custom_label_1>${a.tranche}</g:custom_label_1>`,
    `<g:custom_label_2>${a.misEnAvant ? 'mise-en-avant' : 'standard'}</g:custom_label_2>`,
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
    if (r.ok) retenus.push(...r.articles);
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

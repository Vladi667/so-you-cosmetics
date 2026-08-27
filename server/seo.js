// Ce que le serveur sait dire de chaque page, avant que le navigateur n'ait
// exécuté une seule ligne.
//
// Le site est une application à page unique : une seule index.html sert les
// vingt routes, et son corps est un <div id="root"> vide. Le hook du navigateur
// (src/hooks/useMetadonnees.js) repose bien un titre et une description, mais
// seulement une fois React monté. Or les robots qui fabriquent l'aperçu d'un
// lien — WhatsApp, Facebook, LinkedIn, Signal, Slack — lisent le HTML tel qu'il
// arrive et repartent. Les moteurs autres que Google aussi.
//
// server/index.js posait déjà ces balises, mais pour les fiches produit
// uniquement. Ce fichier généralise le mécanisme à tous les types de page et y
// ajoute le JSON-LD, que rien n'émettait jusqu'ici.
//
// Les balises portent data-pose="app" : le hook du navigateur les reprend alors
// comme les siennes et les nettoie en quittant la page, au lieu de laisser le
// titre d'un produit sur la page suivante.

const SITE_NOM = 'So You Cosmetics';
const TITRE_DEFAUT = 'So You Cosmetics — Cosmétiques naturels faits main à Genève';

// L'identité de la boutique, en un seul endroit.
//
// Elle était jusqu'ici dispersée entre le pied de page, la page « Nous
// trouver », les conditions générales et les courriels transactionnels. Pour un
// commerce physique, la constance de ces trois lignes — nom, adresse,
// téléphone — est ce qui permet à Google de relier le site à la fiche
// d'établissement, donc d'apparaître dans les trois résultats cartographiques.
// Une seule source ici, et les annuaires suisses recopieront la même.
const BOUTIQUE = {
  nom: SITE_NOM,
  // La boutique physique s'appelle « Soap Opera ». C'est un second nom, pas le
  // nom principal : « soap opera » désigne un genre télévisuel et ne ramènera
  // jamais personne. alternateName le dit sans en faire l'enseigne.
  autreNom: 'Boutique Soap Opera',
  rue: '3 av. Pictet-De-Rochemont',
  codePostal: '1207',
  ville: 'Genève',
  region: 'GE',
  pays: 'CH',
  telephone: '+41225566992',
  courriel: 'contact@soyoucosmetics.com',
  // Les profils sociaux servent à confirmer l'identité de l'établissement. Ils
  // doivent être des adresses canoniques et stables : celle du pied de page
  // porte les paramètres de suivi d'un partage (?igsh=…), qui ne désignent rien
  // de durable. On la nettoie ici.
  //
  // La page Facebook manque volontairement : le pied de page n'en connaît qu'un
  // lien « /share/… », qui est une redirection, pas l'adresse de la page. Mieux
  // vaut aucune entrée qu'une adresse qui changera.
  reseaux: [
    'https://www.instagram.com/soyoucosmetics.ch',
  ],
};

// Les entités HTML des descriptions reprises de Wix. Sans DOM côté serveur, il
// faut les décoder à la main : « pour&nbsp;parfaire » partirait sinon tel quel
// dans l'aperçu d'un lien et dans les résultats de recherche.
const ENTITES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â',
  ccedil: 'ç', ocirc: 'ô', ugrave: 'ù', ucirc: 'û', icirc: 'î',
  iuml: 'ï', euml: 'ë', laquo: '«', raquo: '»', hellip: '…',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  ndash: '–', mdash: '—', deg: '°', eur: '€',
};

function decoderEntites(texte) {
  return String(texte || '')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10);
      return Number.isFinite(code) && code > 0 && code < 1114112 ? String.fromCodePoint(code) : ' ';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const code = parseInt(n, 16);
      return Number.isFinite(code) && code > 0 && code < 1114112 ? String.fromCodePoint(code) : ' ';
    })
    .replace(/&([a-z]+);/gi, (tout, nom) => {
      const v = ENTITES[String(nom).toLowerCase()];
      return v === undefined ? tout : v;
    });
}

// Coupe proprement : on préfère une phrase entière un peu courte à une phrase
// tronquée au milieu d'un mot, que les moteurs affichent telle quelle.
function resumerTexte(texte, limite = 160) {
  const propre = decoderEntites(String(texte || '').replace(/<[^>]*>/g, ' '))
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (propre.length <= limite) return propre;
  const coupe = propre.slice(0, limite);
  const dernier = Math.max(coupe.lastIndexOf('. '), coupe.lastIndexOf(' '));
  return (dernier > limite * 0.5 ? coupe.slice(0, dernier) : coupe).trim() + '…';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Une adresse absolue, ou rien.
//
// Open Graph et schema.org exigent l'absolu. Les photos reprises de Wix en sont
// déjà, celles qu'elle téléverse sont enregistrées en « /uploads/… » : le robot
// qui fabrique l'aperçu n'a aucun moyen de les résoudre, et la vignette reste
// vide. On résout contre l'origine, jamais contre l'adresse de la page — un
// chemin sans barre oblique initiale deviendrait sinon « /product/uploads/… ».
function absolutiser(src, base) {
  const valeur = String(src || '').trim();
  if (!valeur) return '';
  if (/^https?:\/\//i.test(valeur)) return valeur;
  try {
    return new URL(valeur, base).href;
  } catch (err) {
    // Un chemin illisible ne vaut pas une balise cassée : mieux vaut aucune
    // image qu'une adresse que personne ne peut ouvrir.
    return '';
  }
}

// Sérialise un objet pour l'intérieur d'une balise <script>.
//
// JSON.stringify seul ne suffit pas : un texte contenant </script> fermerait la
// balise en avance et casserait la page. Échapper < > & en séquences unicode
// garde une valeur JSON valide tout en rendant la chose impossible. U+2028 et
// U+2029 sont légaux en JSON mais pas dans un littéral JS, ils partent aussi.
function serialiserJson(valeur) {
  return JSON.stringify(valeur).replace(
    /[<>&\u2028\u2029]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
  );
}

function baliseMeta(attribut, cle, valeur) {
  return valeur
    ? `<meta ${attribut}="${cle}" content="${escapeHtml(String(valeur))}" data-pose="app">`
    : '';
}

// ---------------------------------------------------------------------------
// Les données structurées
// ---------------------------------------------------------------------------

// L'établissement. Posé sur toutes les pages : c'est ce qui relie le site à la
// fiche Google, donc au bloc cartographique local — la seule visibilité
// atteignable en semaines plutôt qu'en mois pour un commerce de quartier.
function schemaEtablissement(base, shop) {
  return {
    '@context': 'https://schema.org',
    '@type': ['HealthAndBeautyBusiness', 'Store'],
    '@id': `${base}/#boutique`,
    name: BOUTIQUE.nom,
    alternateName: BOUTIQUE.autreNom,
    url: `${base}/`,
    image: `${base}/boutique_exterior.png`,
    logo: `${base}/apple-touch-icon.png`,
    telephone: BOUTIQUE.telephone,
    email: BOUTIQUE.courriel,
    currenciesAccepted: 'CHF',
    paymentAccepted: 'Carte de crédit, TWINT, espèces',
    address: {
      '@type': 'PostalAddress',
      streetAddress: BOUTIQUE.rue,
      postalCode: BOUTIQUE.codePostal,
      addressLocality: BOUTIQUE.ville,
      addressRegion: BOUTIQUE.region,
      addressCountry: BOUTIQUE.pays,
    },
    // « geo » manque volontairement. Les coordonnées doivent être reprises du
    // point posé sur la fiche Google, pas devinées depuis l'adresse : deux
    // positions qui se contredisent valent moins qu'une seule bien placée.
    // À renseigner le jour où la fiche est créée.
    areaServed: [
      { '@type': 'City', name: 'Genève' },
      { '@type': 'AdministrativeArea', name: 'Canton de Genève' },
    ],
    sameAs: BOUTIQUE.reseaux,
    openingHoursSpecification: horairesSchema(shop && shop.hours),
  };
}

const JOURS = {
  lundi: 'Monday', mardi: 'Tuesday', mercredi: 'Wednesday', jeudi: 'Thursday',
  vendredi: 'Friday', samedi: 'Saturday', dimanche: 'Sunday',
};

// Ses horaires, tels qu'elle les écrit, rendus lisibles par une machine.
//
// Le champ est du texte libre — « 11:00–13:00 / 14:00–18:30 » — parce qu'elle
// doit pouvoir le corriger depuis l'administration sans nous. On en extrait
// toutes les plages : une journée coupée en fait deux, ce que schema.org
// exprime par deux entrées plutôt qu'une.
//
// Un jour absent de la liste ne produit rien, ce qui signifie fermé — c'est
// exactement le cas du dimanche, que le modèle de données ne connaît pas.
function horairesSchema(hours) {
  if (!Array.isArray(hours)) return [];
  const specs = [];
  for (const entree of hours) {
    if (!entree || entree.closed) continue;
    const jour = JOURS[String(entree.day || '').toLowerCase().trim()];
    if (!jour) continue;
    // Le tiret peut être un demi-cadratin, un cadratin ou un trait d'union :
    // les trois se ressemblent à l'écran et elle tape ce que son clavier donne.
    for (const m of String(entree.hours || '').matchAll(/(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})/g)) {
      specs.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${jour}`,
        opens: m[1],
        closes: m[2],
      });
    }
  }
  return specs;
}

function schemaSite(base) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${base}/#site`,
    url: `${base}/`,
    name: SITE_NOM,
    inLanguage: 'fr-CH',
    publisher: { '@id': `${base}/#boutique` },
  };
  // Pas de SearchAction : la cible serait /search/…, que public/robots.txt
  // interdit. Déclarer une recherche que le moteur n'a pas le droit de suivre
  // serait se contredire.
}

// Le fil d'Ariane, qui est déjà affiché sur les fiches et les rubriques mais
// que rien ne disait à la machine. C'est lui qui remplace l'adresse nue par un
// chemin lisible sous le titre, dans les résultats.
function schemaFilAriane(base, elements) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: elements.map((el, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: el.nom,
      item: `${base}${el.chemin}`,
    })),
  };
}

// Une fiche produit.
//
// Trois règles que la donnée impose, et qu'il ne faut pas relâcher :
//
//   · la disponibilité se teste par « === false ». Le champ inStock n'est porté
//     que par huit fiches sur 178 dans le repli JSON, et vaut true par défaut
//     côté base. Un « !p.inStock » déclarerait 170 produits en rupture ;
//   · un prix à zéro ne s'annonce pas. Quatre produits sont « sur devis » —
//     trois collections et la commande personnalisée. Écrire « 0.00 » invite
//     Google à afficher « gratuit » et vaut un rappel à l'ordre côté Merchant
//     Center. On émet alors la fiche sans offre du tout ;
//   · une fiche sans photo ne produit pas de données structurées. L'image est
//     obligatoire, et trois produits ont un tableau d'images vide : mieux vaut
//     rien qu'un bloc invalide.
function schemaProduit(produit, urlPage, base) {
  const images = (Array.isArray(produit.images) ? produit.images : [])
    .map((src) => absolutiser(src, base))
    .filter(Boolean);
  if (!images.length) return null;

  const prix = Number(produit.price);
  const surDevis = !Number.isFinite(prix) || prix <= 0;

  const noeud = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${urlPage}#product`,
    name: produit.name,
    description: resumerTexte(produit.description, 300),
    image: images,
    sku: produit.id,
    brand: { '@type': 'Brand', name: SITE_NOM },
    url: urlPage,
  };

  const rubrique = Array.isArray(produit.collections) && produit.collections[0];
  if (rubrique) noeud.category = rubrique;

  if (!surDevis) {
    // Google avertit quand priceValidUntil manque ou est dépassé, et la date
    // n'est stockée nulle part : on la calcule à un an de la requête.
    const dans1An = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    noeud.offers = {
      '@type': 'Offer',
      url: urlPage,
      priceCurrency: 'CHF',
      price: prix.toFixed(2),
      priceValidUntil: dans1An,
      itemCondition: 'https://schema.org/NewCondition',
      availability: produit.inStock === false
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      seller: { '@id': `${base}/#boutique` },
    };
  }

  return noeud;
}

// Un atelier. Le format déclaré est « une à deux personnes » : c'est une
// prestation réservable, et Event est ce que Google comprend — y compris dans
// Maps, où les ateliers d'un commerce de quartier se cherchent réellement.
//
// La date manque au modèle de données (les ateliers se prennent sur rendez-vous
// et n'ont pas de séance fixe). Un Event sans startDate est refusé par Google :
// on émet donc un Service, qui n'en demande pas et qui décrit honnêtement
// l'offre telle qu'elle existe. Le jour où des séances datées apparaissent,
// c'est ici qu'Event prend sa place.
function schemaAtelier(atelier, urlPage, base) {
  const noeud = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${urlPage}#atelier`,
    name: atelier.title,
    description: resumerTexte(atelier.description, 300),
    serviceType: 'Atelier de cosmétique et de savon',
    provider: { '@id': `${base}/#boutique` },
    areaServed: { '@type': 'City', name: 'Genève' },
    url: urlPage,
  };
  const image = absolutiser(atelier.image_url, base);
  if (image) noeud.image = image;

  const prix = Number(atelier.price);
  if (Number.isFinite(prix) && prix > 0) {
    noeud.offers = {
      '@type': 'Offer',
      url: urlPage,
      priceCurrency: 'CHF',
      price: prix.toFixed(2),
      availability: 'https://schema.org/InStock',
      seller: { '@id': `${base}/#boutique` },
    };
  }
  return noeud;
}

// Un article du journal. Les articles sont écrits dans une seule langue —
// les réécrire trois fois n'est pas tenable pour une personne — et inLanguage
// le dit, au lieu de laisser le moteur le deviner.
function schemaArticle(article, urlPage, base) {
  const noeud = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${urlPage}#article`,
    headline: article.title,
    description: resumerTexte(article.excerpt || article.body, 300),
    inLanguage: article.language || 'fr',
    mainEntityOfPage: urlPage,
    url: urlPage,
    publisher: { '@id': `${base}/#boutique` },
    author: { '@type': 'Organization', name: SITE_NOM },
  };
  if (article.date) noeud.datePublished = article.date;
  if (article.updated_at) noeud.dateModified = article.updated_at;
  const image = absolutiser(article.image_url, base);
  if (image) noeud.image = image;
  return noeud;
}

// ---------------------------------------------------------------------------
// Les textes des pages fixes
// ---------------------------------------------------------------------------

// Écrits ici, et non repris de src/i18n/translations.js, pour deux raisons.
//
// La première est technique : le serveur est en CommonJS, translations.js est
// un module ES de 102 Ko chargé par le navigateur.
//
// La seconde est la bonne. La page d'accueil et les treize rubriques
// partageaient jusqu'ici une seule description — celle de about.s2p1 — qui ne
// dit ni Genève, ni boutique, ni ce qu'on peut y acheter. Une description de
// résultat de recherche ne s'écrit pas comme un paragraphe de page : elle a
// 155 caractères pour donner une raison de cliquer. Ce sont deux textes
// différents, et les confondre était le défaut.
const PAGES = {
  '/': {
    titre: TITRE_DEFAUT,
    description: 'Savons saponifiés à froid, soins visage et corps, parfums : cosmétiques naturels faits main à Genève. Boutique aux Eaux-Vives et ateliers sur rendez-vous.',
    image: '/premium_product_stone.png',
  },
  '/about': {
    titre: 'Notre histoire — cosmétiques faits main à Genève',
    description: 'Une artisane, un atelier genevois, des formules courtes et végétaliennes. L’histoire de So You Cosmetics et la façon dont chaque savon est fabriqué.',
    image: '/workshop_crafting.png',
  },
  '/workshops': {
    titre: 'Ateliers de cosmétique et de savon à Genève',
    description: 'Apprenez à fabriquer vos savons et vos soins dans notre atelier genevois. Ateliers privés, en solo ou en duo, sur rendez-vous. Idée cadeau à Genève.',
    image: '/workshop_ingredients.png',
  },
  '/journal': {
    titre: 'Journal — ingrédients, recettes et savoir-faire',
    description: 'Saponification à froid, hydrolats, poudres ayurvédiques, passage au solide : ce que nous avons appris à l’atelier, expliqué simplement.',
    image: '/botanical_flatlay.png',
  },
  '/contact': {
    titre: 'Notre boutique de cosmétiques naturels à Genève',
    description: 'So You Cosmetics — 3 av. Pictet-De-Rochemont, 1207 Genève, quartier des Eaux-Vives. Horaires, plan d’accès, téléphone et retrait gratuit en boutique.',
    image: '/boutique_exterior.png',
  },
  '/personnalisation': {
    titre: 'Savons personnalisés — entreprise, mariage, naissance',
    description: 'Savons et cosmétiques personnalisés fabriqués à Genève : cadeaux d’entreprise, mariage, baptême, baby shower. Sur devis, prévoir trois mois.',
    image: '/artisanal_soap_crafting.png',
  },
  '/terms': {
    titre: 'Conditions générales de vente',
    description: 'Conditions générales de vente de So You Cosmetics : commandes, prix en francs suisses, livraison, droit de rétractation et garantie.',
    image: '',
  },
  '/privacy': {
    titre: 'Politique de confidentialité',
    description: 'Comment So You Cosmetics collecte, utilise et protège vos données personnelles, conformément à la nLPD suisse.',
    image: '',
  },
};

// Les rubriques, avec leur qualificatif local.
//
// « Savons » seul ne dit rien à personne : soixante savons artisanaux vivaient
// derrière un titre d'un mot. Chaque rubrique porte maintenant ce qu'elle vend
// et où elle le vend, ce qui est exactement la requête que quelqu'un tape.
const RUBRIQUES = {
  'Savons': {
    titre: 'Savons artisanaux faits main à Genève',
    description: 'Savons saponifiés à froid, surgras, fabriqués à Genève : olive, coco, karité, Alep et Marseille revisités. Retrait gratuit en boutique aux Eaux-Vives.',
  },
  'Soins Visage': {
    titre: 'Soins visage naturels — Genève',
    description: 'Masques à l’argile, hydrolats, sérums et huiles végétales : soins du visage naturels et végétaliens, fabriqués dans notre atelier genevois.',
  },
  'Soins Corps': {
    titre: 'Soins du corps naturels — Genève',
    description: 'Baumes, huiles, gommages et déodorants naturels sans sels d’aluminium, faits main à Genève avec des formules courtes et végétaliennes.',
  },
  'Soins Capillaires': {
    titre: 'Soins capillaires naturels et coloration végétale — Genève',
    description: 'Shampoings solides, poudres ayurvédiques, henné, cassia, indigo et rhassoul : soins capillaires naturels disponibles à Genève.',
  },
  'Bain & Bien-être': {
    titre: 'Bain et bien-être — produits naturels faits main',
    description: 'Sels de bain, boules effervescentes et soins relaxants aux huiles essentielles, fabriqués à Genève. À retirer en boutique ou à recevoir chez vous.',
  },
  'Maquillage': {
    titre: 'Maquillage naturel — Genève',
    description: 'Soins des lèvres teintés et maquillage naturel, formulés sans ingrédients d’origine animale et fabriqués à Genève.',
  },
  'Parfums': {
    titre: 'Parfums et senteurs naturelles — Genève',
    description: 'Parfums et parfums d’ambiance aux senteurs naturelles, composés et fabriqués dans notre atelier genevois.',
  },
  'Enfants': {
    titre: 'Soins bébé et enfant naturels — Genève',
    description: 'Liniment oléo-calcaire, savons doux à l’huile d’olive et soins pour les peaux les plus sensibles, faits main à Genève.',
  },
  'DIY': {
    titre: 'DIY cosmétique — bases, kits et matières premières',
    description: 'Bases de savon melt and pour, beurres, cires, colorants et flacons : tout pour fabriquer ses cosmétiques soi-même, disponible à Genève.',
  },
  'Ambiance': {
    titre: 'Bougies et parfums d’ambiance naturels — Genève',
    description: 'Bougies naturelles et parfums d’ambiance fabriqués à Genève, à la cire et aux senteurs choisies pour tenir sans écœurer.',
  },
  'Accessoires': {
    titre: 'Accessoires zéro déchet — porte-savons, éponges, lingettes',
    description: 'Porte-savons, éponges konjac, disques démaquillants lavables et pochettes à savon : les accessoires qui font durer un cosmétique solide.',
  },
  'Cadeaux': {
    titre: 'Coffrets et idées cadeaux — cosmétiques faits main à Genève',
    description: 'Coffrets, cartes cadeaux et bons pour un atelier : des cadeaux fabriqués à Genève, à retirer en boutique aux Eaux-Vives.',
  },
  'Personnalisation': {
    titre: 'Cosmétiques personnalisés fabriqués à Genève',
    description: 'Savons et soins personnalisés pour un mariage, une naissance ou un cadeau d’entreprise, fabriqués sur mesure dans notre atelier genevois.',
  },
  'All': {
    titre: 'La boutique — tous nos cosmétiques naturels',
    description: 'Savons, soins et accessoires naturels de So You Cosmetics, fabriqués à Genève. Livraison en Suisse et retrait gratuit en boutique aux Eaux-Vives.',
  },

  // Les rubriques telles que la base les nomme réellement.
  //
  // src/data/categories.js et src/data/products.json — le repli hors ligne du
  // navigateur — annoncent « Soins Visage », « Soins Capillaires », « DIY ».
  // La base servie par /api/products dit « Soins de la peau », « Soin des
  // cheveux », « Savon Liquide » : quatre noms sur douze seulement coïncident.
  // Les deux jeux sont donc décrits ici, faute de savoir lequel la base de
  // production porte. Une rubrique absente des deux retombe de toute façon sur
  // un titre composé depuis son nom, jamais sur rien.
  'Soins de la peau': {
    titre: 'Soins de la peau naturels — Genève',
    description: 'Masques à l’argile, hydrolats, sérums et huiles végétales : soins du visage et du corps naturels et végétaliens, faits main dans notre atelier genevois.',
  },
  'Soin des cheveux': {
    titre: 'Soins capillaires naturels et coloration végétale — Genève',
    description: 'Henné, cassia, indigo, rhassoul et soins capillaires naturels, disponibles à Genève. Conseils en boutique au 3 av. Pictet-De-Rochemont.',
  },
  'Shampoings': {
    titre: 'Shampoings solides et naturels — Genève',
    description: 'Shampoings solides et liquides naturels, sans sulfates, fabriqués à Genève. Un format qui dure et qui voyage, à retirer en boutique.',
  },
  'Soin des lèvres': {
    titre: 'Baumes et soins des lèvres naturels — Genève',
    description: 'Baumes à lèvres nourrissants et teintés, au beurre de karité et aux cires naturelles, fabriqués à la main dans notre atelier genevois.',
  },
  'Savon Liquide': {
    titre: 'Savons liquides naturels — Genève',
    description: 'Savons liquides doux pour les mains et le corps, sans tensioactifs agressifs, fabriqués à Genève et disponibles en recharge.',
  },
  'Bien-être et détente': {
    titre: 'Bien-être et détente — bain, sels et bougies',
    description: 'Sels de bain, boules effervescentes, bougies et soins relaxants aux huiles essentielles, fabriqués à Genève pour prolonger la pause.',
  },
  'Bébés': {
    titre: 'Soins bébé naturels et liniment — Genève',
    description: 'Liniment oléo-calcaire, savons très doux et soins pour les peaux de bébé, aux formules courtes, fabriqués à la main à Genève.',
  },
  'Hommes': {
    titre: 'Rasage traditionnel et soins pour homme — Genève',
    description: 'Savons à barbe, savons mous de rasage à l’huile d’olive et huile à barbe à l’argan bio, fabriqués artisanalement à Genève.',
  },
};

// ---------------------------------------------------------------------------
// Le routeur
// ---------------------------------------------------------------------------

// Les routes que le site connaît, dans les formes que src/App.jsx déclare.
// Tout ce qui n'entre dans aucune d'elles n'existe pas, et doit le dire par un
// vrai 404 plutôt que par une page vide servie en 200.
const ROUTES_DYNAMIQUES = [
  /^\/product\/[^/]+$/,
  /^\/category\/[^/]+$/,
  /^\/workshops\/[^/]+$/,
  /^\/journal\/[^/]+$/,
  /^\/search\/[^/]+$/,
];

function routeConnue(chemin) {
  if (Object.prototype.hasOwnProperty.call(PAGES, chemin)) return true;
  if (chemin === '/workshops' || chemin === '/journal') return true;
  if (chemin === '/admin' || chemin.startsWith('/admin/')) return true;
  return ROUTES_DYNAMIQUES.some((r) => r.test(chemin));
}

// Rend les métadonnées d'une page, ou null si la ressource demandée n'existe
// pas — auquel cas l'appelant répond 404 et pose un « noindex ».
//
// « undefined » est un troisième cas, distinct des deux autres : la route est
// connue mais nous n'avons rien de particulier à en dire (l'administration, la
// recherche). La page part alors telle quelle, sans balises et sans 404.
async function metadonneesDeRoute(chemin, urlPage, base, db, shop) {
  // L'administration et la recherche : connues, volontairement muettes.
  // public/robots.txt les interdit déjà, il n'y a rien à leur écrire.
  if (chemin === '/admin' || chemin.startsWith('/admin/')) return undefined;
  if (/^\/search\//.test(chemin)) return undefined;

  const fixe = PAGES[chemin];
  if (fixe) {
    const jsonLd = [schemaEtablissement(base, shop)];
    if (chemin === '/') jsonLd.push(schemaSite(base));
    return {
      titre: fixe.titre,
      description: fixe.description,
      image: absolutiser(fixe.image, base),
      type: 'website',
      jsonLd,
    };
  }

  const fiche = chemin.match(/^\/product\/([^/]+)$/);
  if (fiche) {
    const produit = await db.getProductById(decodeURIComponent(fiche[1]));
    if (!produit || !produit.name) return null;
    const description = resumerTexte(produit.description);
    const rubrique = Array.isArray(produit.collections) && produit.collections[0];
    const jsonLd = [schemaEtablissement(base, shop)];
    const noeud = schemaProduit(produit, urlPage, base);
    if (noeud) jsonLd.push(noeud);
    jsonLd.push(schemaFilAriane(base, [
      { nom: 'Accueil', chemin: '/' },
      ...(rubrique ? [{ nom: rubrique, chemin: `/category/${encodeURIComponent(rubrique)}` }] : []),
      { nom: produit.name, chemin: `/product/${encodeURIComponent(produit.id)}` },
    ]));
    return {
      titre: `${produit.name} — ${SITE_NOM}`,
      description,
      image: absolutiser((produit.images || [])[0], base),
      type: 'product',
      jsonLd,
    };
  }

  const rubrique = chemin.match(/^\/category\/([^/]+)$/);
  if (rubrique) {
    let nom;
    try {
      nom = decodeURIComponent(rubrique[1]);
    } catch (err) {
      // Un pourcentage isolé dans l'adresse fait lever decodeURIComponent. La
      // rubrique n'existe alors pas : c'est un 404, pas une erreur serveur.
      return null;
    }
    const textes = RUBRIQUES[nom];
    // Une rubrique qu'elle a créée depuis l'administration n'est pas dans la
    // table ci-dessus, et c'est normal : on compose alors un titre honnête à
    // partir de son nom plutôt que de refuser la page.
    const titre = textes ? textes.titre : `${nom} — cosmétiques naturels à Genève`;
    const description = textes
      ? textes.description
      : `${nom} : cosmétiques naturels faits main à Genève par So You Cosmetics. Retrait gratuit en boutique aux Eaux-Vives.`;
    return {
      titre: `${titre} — ${SITE_NOM}`,
      description,
      image: absolutiser('/premium_product_stone.png', base),
      type: 'website',
      jsonLd: [
        schemaEtablissement(base, shop),
        schemaFilAriane(base, [
          { nom: 'Accueil', chemin: '/' },
          { nom: nom === 'All' ? 'La boutique' : nom, chemin: `/category/${encodeURIComponent(nom)}` },
        ]),
      ],
    };
  }

  const atelier = chemin.match(/^\/workshops\/([^/]+)$/);
  if (atelier) {
    const id = decodeURIComponent(atelier[1]);
    const ateliers = await db.getWorkshops();
    const trouve = (Array.isArray(ateliers) ? ateliers : []).find((w) => String(w.id) === id);
    if (!trouve) return null;
    return {
      titre: `${trouve.title} — Atelier à Genève — ${SITE_NOM}`,
      description: resumerTexte(trouve.description),
      image: absolutiser(trouve.image_url, base),
      type: 'article',
      jsonLd: [
        schemaEtablissement(base, shop),
        schemaAtelier(trouve, urlPage, base),
        schemaFilAriane(base, [
          { nom: 'Accueil', chemin: '/' },
          { nom: 'Ateliers', chemin: '/workshops' },
          { nom: trouve.title, chemin: `/workshops/${encodeURIComponent(trouve.id)}` },
        ]),
      ],
    };
  }

  const article = chemin.match(/^\/journal\/([^/]+)$/);
  if (article) {
    const trouve = db.getArticleBySlug(decodeURIComponent(article[1]));
    // Un brouillon n'est pas une page : il ne doit ni s'indexer ni répondre 200.
    if (!trouve || !trouve.published) return null;
    return {
      titre: `${trouve.title} — Journal — ${SITE_NOM}`,
      description: resumerTexte(trouve.excerpt || trouve.body),
      image: absolutiser(trouve.image_url, base),
      type: 'article',
      jsonLd: [
        schemaEtablissement(base, shop),
        schemaArticle(trouve, urlPage, base),
        schemaFilAriane(base, [
          { nom: 'Accueil', chemin: '/' },
          { nom: 'Journal', chemin: '/journal' },
          { nom: trouve.title, chemin: `/journal/${encodeURIComponent(trouve.slug)}` },
        ]),
      ],
    };
  }

  return undefined;
}

// Assemble les balises à injecter dans <head>.
//
// Le nonce est porté par les blocs JSON-LD par prudence : un <script> de type
// application/ld+json est un bloc de données, que les navigateurs n'exécutent
// pas et ne devraient donc pas soumettre à script-src. Le porter ne coûte rien
// et ferme le cas où l'un d'eux en déciderait autrement.
function baliseshtml(meta, urlPage, nonce) {
  const balises = [
    baliseMeta('name', 'description', meta.description),
    baliseMeta('property', 'og:type', meta.type || 'website'),
    baliseMeta('property', 'og:site_name', SITE_NOM),
    baliseMeta('property', 'og:title', meta.titre),
    baliseMeta('property', 'og:description', meta.description),
    baliseMeta('property', 'og:image', meta.image),
    baliseMeta('property', 'og:url', urlPage),
    baliseMeta('property', 'og:locale', 'fr_CH'),
    baliseMeta('name', 'twitter:card', meta.image ? 'summary_large_image' : 'summary'),
    // L'adresse canonique, que rien n'écrivait dans le HTML reçu : le hook du
    // navigateur la pose, mais seulement après React. Elle est donnée sans
    // paramètres — une même page partagée avec un ?utm_source ne doit pas
    // devenir un doublon.
    `<link rel="canonical" href="${escapeHtml(urlPage)}" data-pose="app">`,
  ].join('');

  const donnees = (meta.jsonLd || [])
    .filter(Boolean)
    .map((n) => `<script type="application/ld+json" nonce="${nonce}">${serialiserJson(n)}</script>`)
    .join('');

  return balises + donnees;
}

// ---------------------------------------------------------------------------
// Le plan du site
// ---------------------------------------------------------------------------

// Construit à la demande depuis la base : elle ajoute un produit, il y est. Un
// fichier écrit au build serait faux le jour même.
//
// C'est la correction la plus urgente du site. Le catalogue n'affiche que douze
// produits avant de demander un défilement ou un clic, et les rubriques ne
// s'atteignent que depuis le fil d'Ariane d'une fiche : un robot tourne en rond
// et ne voit jamais la centaine de fiches qui suit. Le plan du site est le seul
// chemin qui ne dépende pas du graphe de liens.
async function construireSitemap(base, db) {
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const url = (loc, priorite, frequence) =>
    `<url><loc>${esc(loc)}</loc><changefreq>${frequence}</changefreq><priority>${priorite}</priority></url>`;

  const [produits, ateliers] = await Promise.all([db.getProducts(), db.getWorkshops()]);
  // getArticles est synchrone, contrairement aux deux précédentes.
  const articles = db.getArticles({ publishedOnly: true });

  const listeProduits = Array.isArray(produits) ? produits : [];
  const rubriques = [...new Set(listeProduits.flatMap((p) => p.collections || []))];

  const entrees = [
    url(`${base}/`, '1.0', 'weekly'),
    url(`${base}/category/All`, '0.9', 'weekly'),
    ...rubriques.map((c) => url(`${base}/category/${encodeURIComponent(c)}`, '0.8', 'weekly')),
    ...listeProduits
      .filter((p) => p && p.id)
      .map((p) => url(`${base}/product/${encodeURIComponent(p.id)}`, '0.7', 'weekly')),
    url(`${base}/workshops`, '0.8', 'monthly'),
    ...(Array.isArray(ateliers) ? ateliers : [])
      .filter((w) => w && w.id)
      .map((w) => url(`${base}/workshops/${encodeURIComponent(w.id)}`, '0.6', 'monthly')),
    url(`${base}/personnalisation`, '0.7', 'monthly'),
    url(`${base}/about`, '0.6', 'monthly'),
    url(`${base}/contact`, '0.7', 'monthly'),
    url(`${base}/journal`, '0.5', 'weekly'),
    ...(Array.isArray(articles) ? articles : [])
      .filter((a) => a && a.slug)
      .map((a) => url(`${base}/journal/${encodeURIComponent(a.slug)}`, '0.5', 'monthly')),
    url(`${base}/terms`, '0.2', 'yearly'),
    url(`${base}/privacy`, '0.2', 'yearly'),
  ].join('');

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entrees}</urlset>`;
}

module.exports = {
  SITE_NOM,
  TITRE_DEFAUT,
  BOUTIQUE,
  escapeHtml,
  resumerTexte,
  absolutiser,
  serialiserJson,
  routeConnue,
  metadonneesDeRoute,
  baliseshtml,
  construireSitemap,
  horairesSchema,
  schemaProduit,
};

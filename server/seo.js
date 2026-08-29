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

// La langue est dans l'adresse. Le français reste à la racine — aucune adresse
// existante ne change — et l'anglais et l'allemand prennent un préfixe.
//
// Le miroir exact de src/i18n/routes.js, en CommonJS. Deux copies d'une règle
// aussi courte valent mieux qu'un module partagé entre un paquet ESM destiné au
// navigateur et un serveur qui, lui, n'est pas transpilé.
const LANGUE_DEFAUT = 'fr';
const LANGUES_PREFIXEES = ['en', 'de'];
const LANGUES = [LANGUE_DEFAUT, ...LANGUES_PREFIXEES];

// Le code complet, pour hreflang et og:locale. « fr-CH » plutôt que « fr » :
// la boutique est à Genève, ses prix sont en francs, et la variante suisse est
// ce qui la distingue d'un site français aux yeux d'un moteur.
const LOCALES = { fr: 'fr-CH', en: 'en', de: 'de-CH' };
const OG_LOCALES = { fr: 'fr_CH', en: 'en_GB', de: 'de_CH' };

function separerLangue(pathname) {
  const chemin = String(pathname || '/');
  for (const langue of LANGUES_PREFIXEES) {
    // La barre oblique qui suit distingue le préfixe « /de » d'une page dont le
    // nom commencerait par ces deux lettres.
    if (chemin === `/${langue}`) return { langue, chemin: '/' };
    if (chemin.startsWith(`/${langue}/`)) return { langue, chemin: chemin.slice(langue.length + 1) };
  }
  return { langue: LANGUE_DEFAUT, chemin };
}

function avecLangue(chemin, langue) {
  const nu = separerLangue(chemin).chemin;
  if (!LANGUES_PREFIXEES.includes(langue)) return nu;
  return nu === '/' ? `/${langue}` : `/${langue}${nu}`;
}

// Les trois adresses d'une même page, pour hreflang et pour le plan du site.
//
// C'est ce qui dit à un moteur que /about, /en/about et /de/about sont la même
// page en trois langues, et non trois pages qui se ressemblent — la différence
// entre trois résultats servis au bon public et trois pages qui se
// cannibalisent.
function alternatives(chemin, base = '') {
  const nu = separerLangue(chemin).chemin;
  return LANGUES.map((langue) => ({
    langue,
    locale: LOCALES[langue],
    href: `${base}${avecLangue(nu, langue)}`,
  }));
}

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
function schemaFilAriane(base, elements, langue) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: elements.map((el, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: el.nom,
      item: `${base}${avecLangue(el.chemin, langue)}`,
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
//
// L'anglais et l'allemand ne sont pas traités de la même façon, et c'est
// délibéré. Genève compte des dizaines de milliers d'anglophones à fort pouvoir
// d'achat, et la recherche « soap making workshop Geneva » ne remonte
// aujourd'hui aucune offre commerciale locale : c'est le trou le plus rentable
// du marché, et les pages anglaises visent celui-là — l'atelier, l'histoire, la
// boutique. L'allemand, lui, sert la courtoisie : personne à Genève ne cherche
// « Naturkosmetik Genf » en volume utile, et le terrain alémanique
// (« Naturseife », « handgemachte Seife ») est tenu par des savonneries
// établies depuis des années. Traduire, oui ; en attendre du trafic, non.
const PAGES_EN = {
  '/': {
    titre: 'So You Cosmetics — Natural handmade cosmetics in Geneva',
    description: 'Cold-process soaps, face and body care, workshops. Natural cosmetics made by hand in Geneva, in our Eaux-Vives boutique.',
    image: '/premium_product_stone.png',
  },
  '/about': {
    titre: 'Our story — handmade cosmetics in Geneva',
    description: 'One maker, a Geneva workshop, short vegan formulas. The story behind So You Cosmetics and how each soap is actually made.',
    image: '/workshop_crafting.png',
  },
  '/workshops': {
    titre: 'Soap and cosmetics workshops in Geneva',
    description: 'Learn to make your own soap and skincare in our Geneva workshop. Private sessions, solo or for two, by appointment. English spoken.',
    image: '/workshop_ingredients.png',
  },
  '/journal': {
    titre: 'Journal — ingredients, recipes and craft',
    description: 'Cold saponification, hydrosols, ayurvedic powders, switching to solid bars: what we have learned at the bench, plainly explained.',
    image: '/botanical_flatlay.png',
  },
  '/contact': {
    titre: 'Our natural cosmetics boutique in Geneva',
    description: 'So You Cosmetics — 3 av. Pictet-De-Rochemont, 1207 Geneva, Eaux-Vives. Opening hours, directions, phone, and free in-store pickup.',
    image: '/boutique_exterior.png',
  },
  '/personnalisation': {
    titre: 'Personalised soaps — corporate, wedding, new baby',
    description: 'Custom soaps and cosmetics made in Geneva: corporate gifts, weddings, christenings, baby showers. By quotation, three months’ notice.',
    image: '/artisanal_soap_crafting.png',
  },
  '/terms': {
    titre: 'Terms and conditions of sale',
    description: 'So You Cosmetics terms of sale: orders, prices in Swiss francs, delivery, right of withdrawal and warranty.',
    image: '',
  },
  '/privacy': {
    titre: 'Privacy policy',
    description: 'How So You Cosmetics collects, uses and protects your personal data, in accordance with the Swiss revised FADP.',
    image: '',
  },
};

const PAGES_DE = {
  '/': {
    titre: 'So You Cosmetics — Handgemachte Naturkosmetik aus Genf',
    description: 'Kaltgerührte Seifen, Gesichts- und Körperpflege, Kurse. Handgemachte Naturkosmetik aus Genf, in unserer Boutique in den Eaux-Vives.',
    image: '/premium_product_stone.png',
  },
  '/about': {
    titre: 'Unsere Geschichte — handgemachte Kosmetik aus Genf',
    description: 'Eine Handwerkerin, ein Genfer Atelier, kurze vegane Rezepturen. Die Geschichte von So You Cosmetics und wie jede Seife entsteht.',
    image: '/workshop_crafting.png',
  },
  '/workshops': {
    titre: 'Seifen- und Kosmetikkurse in Genf',
    description: 'Stellen Sie Ihre eigenen Seifen und Pflegeprodukte in unserem Genfer Atelier her. Private Kurse, allein oder zu zweit, nach Vereinbarung.',
    image: '/workshop_ingredients.png',
  },
  '/journal': {
    titre: 'Journal — Zutaten, Rezepte und Handwerk',
    description: 'Kaltverseifung, Hydrolate, ayurvedische Pulver, der Wechsel zu fester Pflege: was wir im Atelier gelernt haben, einfach erklärt.',
    image: '/botanical_flatlay.png',
  },
  '/contact': {
    titre: 'Unsere Naturkosmetik-Boutique in Genf',
    description: 'So You Cosmetics — 3 av. Pictet-De-Rochemont, 1207 Genf, Eaux-Vives. Öffnungszeiten, Anfahrt, Telefon und kostenlose Abholung.',
    image: '/boutique_exterior.png',
  },
  '/personnalisation': {
    titre: 'Personalisierte Seifen — Firma, Hochzeit, Geburt',
    description: 'Individuelle Seifen und Kosmetik aus Genf: Firmengeschenke, Hochzeiten, Taufen, Baby-Partys. Auf Anfrage, drei Monate Vorlauf.',
    image: '/artisanal_soap_crafting.png',
  },
  '/terms': {
    titre: 'Allgemeine Geschäftsbedingungen',
    description: 'Verkaufsbedingungen von So You Cosmetics: Bestellungen, Preise in Schweizer Franken, Lieferung, Widerrufsrecht und Garantie.',
    image: '',
  },
  '/privacy': {
    titre: 'Datenschutzerklärung',
    description: 'Wie So You Cosmetics Ihre personenbezogenen Daten erhebt, verwendet und schützt, gemäss dem revidierten Schweizer DSG.',
    image: '',
  },
};

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

function pagesPourLangue(langue) {
  if (langue === 'en') return PAGES_EN;
  if (langue === 'de') return PAGES_DE;
  return PAGES;
}

// Les rubriques gardent leur nom français dans les trois langues.
//
// C'est une décision de la boutique, pas un oubli : « Savons », « Soins de la
// peau » sont les noms sous lesquels elle range son catalogue, et les fiches
// elles-mêmes ne sont écrites qu'en français. Seul l'habillage de la phrase est
// traduit, autour d'un nom qui ne l'est pas. Une page à moitié traduite qui le
// dit vaut mieux qu'une traduction qui promet ce qu'il n'y a pas derrière.
function rubriquePourLangue(nom, langue) {
  if (langue === 'en') {
    return {
      titre: `${nom} — natural cosmetics handmade in Geneva`,
      description: `${nom}: natural, vegan cosmetics made by hand in our Geneva workshop. Free pickup at our Eaux-Vives boutique, delivery across Switzerland.`,
    };
  }
  if (langue === 'de') {
    return {
      titre: `${nom} — handgemachte Naturkosmetik aus Genf`,
      description: `${nom}: vegane Naturkosmetik, handgemacht in unserem Genfer Atelier. Kostenlose Abholung in der Boutique, Versand in der ganzen Schweiz.`,
    };
  }
  const textes = RUBRIQUES[nom];
  if (textes) return textes;
  // Une rubrique qu'elle a créée depuis l'administration n'est pas dans la
  // table : on compose alors un titre honnête à partir de son nom.
  return {
    titre: `${nom} — cosmétiques naturels à Genève`,
    description: `${nom} : cosmétiques naturels faits main à Genève par So You Cosmetics. Retrait gratuit en boutique aux Eaux-Vives.`,
  };
}

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

function routeConnue(cheminComplet) {
  // Le préfixe de langue d'abord : « /en/about » est la même route qu'« /about »,
  // et sans ce retrait toute la version anglaise répondrait 404.
  const { chemin } = separerLangue(cheminComplet);
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
async function metadonneesDeRoute(cheminComplet, urlPage, base, db, shop) {
  // La langue sort de l'adresse, et le reste du travail se fait sur le chemin
  // nu : une seule table de routes pour les trois versions du site.
  const { langue, chemin } = separerLangue(cheminComplet);
  // Ce que toute page doit porter : sa langue, et l'adresse de ses sœurs.
  const commun = { langue, alternatives: alternatives(chemin, base) };

  // L'administration et la recherche : connues, volontairement muettes.
  // public/robots.txt les interdit déjà, il n'y a rien à leur écrire.
  if (chemin === '/admin' || chemin.startsWith('/admin/')) return undefined;
  if (/^\/search\//.test(chemin)) return undefined;

  const fixe = pagesPourLangue(langue)[chemin];
  if (fixe) {
    const jsonLd = [schemaEtablissement(base, shop)];
    if (chemin === '/') jsonLd.push(schemaSite(base));
    return {
      ...commun,
      titre: fixe.titre,
      description: fixe.description,
      image: absolutiser(fixe.image, base),
      type: 'website',
      jsonLd,
    };
  }

  const fiche = chemin.match(/^\/product\/([^/]+)$/);
  if (fiche) {
    // Le catalogue entier plutôt que getProductById : l'adresse porte désormais
    // un slug, et l'empreinte de huit caractères qui le termine doit être
    // comparée à toutes les fiches. Les anciennes adresses, elles, restent
    // reconnues telles quelles.
    let parametre;
    try {
      parametre = decodeURIComponent(fiche[1]);
    } catch {
      // Un pourcentage isolé fait lever decodeURIComponent : la fiche n'existe
      // pas, c'est un 404 et non une erreur serveur.
      return null;
    }
    const produit = trouverProduit(parametre, await db.getProducts());
    if (!produit || !produit.name) return null;
    const description = resumerTexte(produit.description);
    const rubrique = Array.isArray(produit.collections) && produit.collections[0];
    const jsonLd = [schemaEtablissement(base, shop)];
    const noeud = schemaProduit(produit, urlPage, base);
    if (noeud) jsonLd.push(noeud);
    jsonLd.push(schemaFilAriane(base, [
      { nom: 'Accueil', chemin: '/' },
      ...(rubrique ? [{ nom: rubrique, chemin: `/category/${encodeURIComponent(rubrique)}` }] : []),
      { nom: produit.name, chemin: `/product/${slugProduit(produit)}` },
    ], langue));
    return {
      ...commun,
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
    const textes = rubriquePourLangue(nom, langue);
    return {
      ...commun,
      titre: `${textes.titre} — ${SITE_NOM}`,
      description: textes.description,
      image: absolutiser('/premium_product_stone.png', base),
      type: 'website',
      jsonLd: [
        schemaEtablissement(base, shop),
        schemaFilAriane(base, [
          { nom: 'Accueil', chemin: '/' },
          { nom: nom === 'All' ? 'La boutique' : nom, chemin: `/category/${encodeURIComponent(nom)}` },
        ], langue),
      ],
    };
  }

  const atelier = chemin.match(/^\/workshops\/([^/]+)$/);
  if (atelier) {
    const id = decodeURIComponent(atelier[1]);
    const ateliers = await db.getWorkshops();
    const trouve = (Array.isArray(ateliers) ? ateliers : []).find((w) => String(w.id) === id);
    if (!trouve) return null;
    const suffixe = { fr: 'Atelier à Genève', en: 'Workshop in Geneva', de: 'Kurs in Genf' }[langue];
    return {
      ...commun,
      titre: `${trouve.title} — ${suffixe} — ${SITE_NOM}`,
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
        ], langue),
      ],
    };
  }

  const article = chemin.match(/^\/journal\/([^/]+)$/);
  if (article) {
    const trouve = db.getArticleBySlug(decodeURIComponent(article[1]));
    // Un brouillon n'est pas une page : il ne doit ni s'indexer ni répondre 200.
    if (!trouve || !trouve.published) return null;
    return {
      ...commun,
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
        ], langue),
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
    baliseMeta('property', 'og:locale', OG_LOCALES[meta.langue] || OG_LOCALES.fr),
    // Les deux autres versions, annoncées à l'aperçu de lien comme au moteur.
    ...(meta.alternatives || [])
      .filter((a) => a.langue !== meta.langue)
      .map((a) => baliseMeta('property', 'og:locale:alternate', OG_LOCALES[a.langue])),
    baliseMeta('name', 'twitter:card', meta.image ? 'summary_large_image' : 'summary'),
    // L'adresse canonique, que rien n'écrivait dans le HTML reçu : le hook du
    // navigateur la pose, mais seulement après React. Elle est donnée sans
    // paramètres — une même page partagée avec un ?utm_source ne doit pas
    // devenir un doublon.
    `<link rel="canonical" href="${escapeHtml(urlPage)}" data-pose="app">`,
    // hreflang : ce qui dit à un moteur que ces trois adresses sont la même
    // page en trois langues, et non trois pages qui se ressemblent. Sans elles,
    // les versions se cannibalisent au lieu d'être servies chacune à son public.
    //
    // Chaque page se cite elle-même dans la liste — la règle est que l'ensemble
    // soit réflexif, sans quoi Google ignore le groupe entier.
    ...(meta.alternatives || []).map((a) =>
      `<link rel="alternate" hreflang="${a.locale}" href="${escapeHtml(a.href)}" data-pose="app">`),
    // « x-default » désigne la version servie à qui ne correspond à aucune
    // langue déclarée : le français, qui est celle de la boutique.
    ...((meta.alternatives || []).length
      ? [`<link rel="alternate" hreflang="x-default" href="${escapeHtml(
          (meta.alternatives.find((a) => a.langue === LANGUE_DEFAUT) || meta.alternatives[0]).href
        )}" data-pose="app">`]
      : []),
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

  // Une entrée par langue, chacune déclarant les trois adresses du groupe.
  //
  // C'est la forme que Google demande : chaque URL du groupe doit lister toutes
  // les autres, elle-même comprise. Le plan du site est le seul endroit où
  // porter cela sans alourdir chaque page de trois balises supplémentaires —
  // sauf qu'on les pose aussi dans le <head>, parce que les autres moteurs ne
  // lisent que celui-là.
  const url = (chemin, priorite, frequence) => {
    const groupe = alternatives(chemin, base);
    const liens = groupe
      .map((a) => `<xhtml:link rel="alternate" hreflang="${a.locale}" href="${esc(a.href)}"/>`)
      .join('') +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(
        (groupe.find((a) => a.langue === LANGUE_DEFAUT) || groupe[0]).href
      )}"/>`;
    return groupe
      .map((a) => `<url><loc>${esc(a.href)}</loc>${liens}` +
        `<changefreq>${frequence}</changefreq><priority>${priorite}</priority></url>`)
      .join('');
  };

  const [produits, ateliers] = await Promise.all([db.getProducts(), db.getWorkshops()]);
  // getArticles est synchrone, contrairement aux deux précédentes.
  const articles = db.getArticles({ publishedOnly: true });

  const listeProduits = Array.isArray(produits) ? produits : [];
  const rubriques = [...new Set(listeProduits.flatMap((p) => p.collections || []))];

  // Les chemins sont nus : url() se charge d'en produire les trois langues.
  const entrees = [
    url('/', '1.0', 'weekly'),
    url('/category/All', '0.9', 'weekly'),
    ...rubriques.map((c) => url(`/category/${encodeURIComponent(c)}`, '0.8', 'weekly')),
    ...listeProduits
      .filter((p) => p && p.id)
      .map((p) => url(`/product/${slugProduit(p)}`, '0.7', 'weekly')),
    url('/workshops', '0.8', 'monthly'),
    ...(Array.isArray(ateliers) ? ateliers : [])
      .filter((w) => w && w.id)
      .map((w) => url(`/workshops/${encodeURIComponent(w.id)}`, '0.6', 'monthly')),
    url('/personnalisation', '0.7', 'monthly'),
    url('/about', '0.6', 'monthly'),
    url('/contact', '0.7', 'monthly'),
    url('/journal', '0.5', 'weekly'),
    ...(Array.isArray(articles) ? articles : [])
      .filter((a) => a && a.slug)
      .map((a) => url(`/journal/${encodeURIComponent(a.slug)}`, '0.5', 'monthly')),
    url('/terms', '0.2', 'yearly'),
    url('/privacy', '0.2', 'yearly'),
  ].join('');

  // L'espace de noms xhtml est ce qui rend les <xhtml:link> lisibles : sans sa
  // déclaration, le plan est un XML invalide et Google le rejette en bloc.
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:xhtml="http://www.w3.org/1999/xhtml">${entrees}</urlset>`;
}

// ---------------------------------------------------------------------------
// L'adresse lisible d'une fiche produit
// ---------------------------------------------------------------------------

// Le miroir de src/data/slug.js, en CommonJS, pour la même raison que
// separerLangue : deux copies d'une règle courte valent mieux qu'un module
// partagé entre un paquet destiné au navigateur et un serveur non transpilé.
// La suite de vérification compare les deux implémentations sur le catalogue
// entier, pour qu'elles ne puissent pas diverger en silence.
const LONGUEUR_EMPREINTE = 8;

function empreinte(id) {
  return String(id || '')
    .replace(/^product_/, '')
    .replace(/-/g, '')
    .slice(0, LONGUEUR_EMPREINTE)
    .toLowerCase();
}

function slugifier(texte) {
  return String(texte || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

function slugProduit(produit) {
  if (!produit || !produit.id) return '';
  const nom = slugifier(produit.name);
  const emp = empreinte(produit.id);
  return nom ? `${nom}-${emp}` : emp;
}

// Accepte l'ancienne forme comme la nouvelle : les adresses déjà envoyées par
// message ou déposées au plan du site doivent continuer de répondre. Le serveur
// redirige ensuite vers la forme lisible, pour qu'une seule soit indexée.
function trouverProduit(parametre, produits) {
  if (!parametre || !Array.isArray(produits)) return null;
  const brut = String(parametre);
  const direct = produits.find((p) => p.id === brut);
  if (direct) return direct;
  const emp = brut.slice(-LONGUEUR_EMPREINTE).toLowerCase();
  return produits.find((p) => empreinte(p.id) === emp) || null;
}

module.exports = {
  SITE_NOM,
  TITRE_DEFAUT,
  LANGUES,
  LANGUE_DEFAUT,
  LOCALES,
  slugProduit,
  trouverProduit,
  empreinte,
  separerLangue,
  avecLangue,
  alternatives,
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

// Vérifie les modules de référencement contre le catalogue réel, sans démarrer
// le serveur ni toucher au réseau.
//
// Cette suite vivait dans un dossier temporaire, hors du dépôt : quatre-vingts
// assertions qui décrivaient exactement pourquoi chaque règle est écrite comme
// elle l'est, et que la prochaine personne à toucher server/seo.js n'aurait
// jamais vues. Elle couvre des choix qu'un relecteur ne devinerait pas —
// pourquoi un produit à prix nul part sans offre, pourquoi la disponibilité se
// teste « === false », pourquoi « /deodorant » n'est pas la version allemande.
//
//     npm run verifier:seo
//
// La racine est déduite du fichier : la suite tourne sans argument.
const path = require('path');
const RACINE = process.argv[2] || path.join(__dirname, '..');
const seo = require(path.join(RACINE, 'server/seo.js'));
const catalogue = require(path.join(RACINE, 'src/data/products.json')).products;
const mesure = require(path.join(RACINE, 'server/mesure.js'));
const flux = require(path.join(RACINE, 'server/flux.js'));

const BASE = 'https://soyoucosmetics.com';
let echecs = 0;
const ok = (cond, nom, detail) => {
  if (cond) { console.log('  ok   ' + nom); }
  else { console.log('  FAIL ' + nom + (detail ? ' :: ' + detail : '')); echecs++; }
};

// --- une base factice, de la forme que server/db.js expose -----------------
const ateliers = [
  { id: 'ws_1', title: 'Atelier savon à froid', description: 'Fabriquez vos savons.', price: 145, duration: '3h', image_url: '/workshop_ingredients.png' },
];
const articles = [
  { slug: 'le-rhassoul', title: 'Le rhassoul', excerpt: 'La terre qui lave.', body: '...', published: true, date: '2026-08-20', language: 'fr', image_url: '/botanical_flatlay.png' },
  { slug: 'brouillon', title: 'Brouillon', excerpt: '', body: '', published: false, date: '2026-08-25', language: 'fr' },
];
const db = {
  getProducts: async () => catalogue,
  getProductById: async (id) => catalogue.find((p) => p.id === id) || null,
  getWorkshops: async () => ateliers,
  getArticles: ({ publishedOnly } = {}) => (publishedOnly ? articles.filter((a) => a.published) : articles),
  getArticleBySlug: (s) => articles.find((a) => a.slug === s) || null,
};
const shop = {
  hours: [
    { day: 'lundi', closed: true, hours: '' },
    { day: 'mardi', closed: false, hours: '11:00–13:00 / 14:00–18:30' },
    { day: 'samedi', closed: false, hours: '11:00–16:30' },
  ],
};

(async () => {
  console.log('\n== horaires ==');
  const h = seo.horairesSchema(shop.hours);
  ok(h.length === 3, 'trois plages (mardi coupé en deux, samedi une)', JSON.stringify(h.map((x) => x.opens + '-' + x.closes)));
  ok(h[0].dayOfWeek === 'https://schema.org/Tuesday', 'lundi fermé est absent, mardi vient en premier');
  ok(h[1].opens === '14:00' && h[1].closes === '18:30', 'la seconde plage du mardi');

  console.log('\n== routes connues ==');
  ['/', '/about', '/contact', '/workshops', '/workshops/ws_1', '/journal', '/journal/le-rhassoul',
   '/category/Savons', '/product/x', '/search/savon', '/admin', '/terms', '/privacy', '/personnalisation']
    .forEach((c) => ok(seo.routeConnue(c), 'connue: ' + c));
  ['/nimportequoi', '/product/a/b', '/wp-admin', '/category'].forEach((c) => ok(!seo.routeConnue(c), 'inconnue: ' + c));

  console.log('\n== pages fixes ==');
  const accueil = await seo.metadonneesDeRoute('/', BASE + '/', BASE, db, shop);
  ok(accueil.description.includes('Genève'), 'la description d’accueil dit Genève');
  ok(accueil.description.length <= 160, 'description <= 160 (' + accueil.description.length + ')');
  ok(accueil.jsonLd.length === 2, 'accueil : établissement + site');
  ok(accueil.jsonLd[0]['@type'].includes('Store'), 'établissement présent');
  ok(accueil.jsonLd[0].openingHoursSpecification.length === 3, 'horaires dans l’établissement');

  const contact = await seo.metadonneesDeRoute('/contact', BASE + '/contact', BASE, db, shop);
  ok(contact.titre !== accueil.titre, 'contact a son propre titre');
  ok(/Pictet/.test(contact.description), 'contact donne l’adresse');

  console.log('\n== rubriques ==');
  const savons = await seo.metadonneesDeRoute('/category/Savons', BASE + '/category/Savons', BASE, db, shop);
  ok(/Genève/.test(savons.titre), 'la rubrique Savons porte le qualificatif local :: ' + savons.titre);
  const accent = await seo.metadonneesDeRoute('/category/Bain%20%26%20Bien-%C3%AAtre', BASE + '/x', BASE, db, shop);
  ok(accent && /Bain/.test(accent.titre), 'rubrique accentuée et encodée résolue :: ' + (accent && accent.titre));
  const inventee = await seo.metadonneesDeRoute('/category/Coffrets%20de%20No%C3%ABl', BASE + '/x', BASE, db, shop);
  ok(inventee && /Coffrets de Noël/.test(inventee.titre), 'rubrique créée depuis l’admin : titre composé');
  const casse = await seo.metadonneesDeRoute('/category/%E0%A4%A', BASE + '/x', BASE, db, shop);
  ok(casse === null, 'adresse mal encodée -> 404, pas une exception');

  console.log('\n== fiches produit ==');
  const p1 = catalogue.find((p) => p.price > 0 && (p.images || []).length);
  const m1 = await seo.metadonneesDeRoute('/product/' + p1.id, BASE + '/product/' + p1.id, BASE, db, shop);
  const prod = m1.jsonLd.find((n) => n['@type'] === 'Product');
  ok(!!prod, 'Product émis');
  ok(prod.offers.priceCurrency === 'CHF', 'devise CHF');
  ok(/^\d+\.\d{2}$/.test(prod.offers.price), 'prix à deux décimales :: ' + prod.offers.price);
  ok(prod.offers.availability.endsWith('InStock'), 'inStock absent => disponible (défaut correct)');
  ok(prod.image.every((u) => /^https?:\/\//.test(u)), 'toutes les images absolues');
  ok(m1.jsonLd.some((n) => n['@type'] === 'BreadcrumbList'), 'fil d’Ariane émis');
  const inconnu = await seo.metadonneesDeRoute('/product/nexiste-pas', BASE + '/x', BASE, db, shop);
  ok(inconnu === null, 'produit inconnu -> 404');

  console.log('\n== cas limites du catalogue ==');
  const zeros = catalogue.filter((p) => !Number(p.price));
  console.log('  (' + zeros.length + ' produits à prix nul, ' +
              catalogue.filter((p) => !(p.images || []).length).length + ' sans image)');
  for (const z of zeros) {
    const n = seo.schemaProduit(z, BASE + '/product/' + z.id, BASE);
    if (n) ok(!n.offers, 'pas d’offre pour « ' + z.name.slice(0, 40) + ' »');
  }
  const sansImage = catalogue.filter((p) => !(p.images || []).length);
  for (const si of sansImage) {
    ok(seo.schemaProduit(si, BASE + '/x', BASE) === null, 'pas de Product sans image : ' + si.name.slice(0, 40));
  }
  const rupture = seo.schemaProduit({ ...p1, inStock: false }, BASE + '/x', BASE);
  ok(rupture.offers.availability.endsWith('OutOfStock'), 'inStock === false => rupture');

  console.log('\n== ateliers et journal ==');
  const a = await seo.metadonneesDeRoute('/workshops/ws_1', BASE + '/workshops/ws_1', BASE, db, shop);
  ok(/Genève/.test(a.titre), 'l’atelier porte Genève dans son titre');
  ok(a.jsonLd.some((n) => n['@type'] === 'Service'), 'Service émis pour l’atelier');
  ok(await seo.metadonneesDeRoute('/workshops/inconnu', BASE + '/x', BASE, db, shop) === null, 'atelier inconnu -> 404');
  const art = await seo.metadonneesDeRoute('/journal/le-rhassoul', BASE + '/journal/le-rhassoul', BASE, db, shop);
  ok(art.jsonLd.some((n) => n['@type'] === 'BlogPosting'), 'BlogPosting émis');
  ok(await seo.metadonneesDeRoute('/journal/brouillon', BASE + '/x', BASE, db, shop) === null, 'brouillon -> 404');

  console.log('\n== routes muettes ==');
  ok(await seo.metadonneesDeRoute('/admin', BASE + '/admin', BASE, db, shop) === undefined, '/admin muet');
  ok(await seo.metadonneesDeRoute('/search/savon', BASE + '/x', BASE, db, shop) === undefined, '/search muet');

  console.log('\n== balises ==');
  const html = seo.baliseshtml(m1, BASE + '/product/' + p1.id, 'NONCE123');
  ok(html.includes('rel="canonical"'), 'canonique posée dans le HTML reçu');
  ok(html.includes('data-pose="app"'), 'data-pose posé (le hook les reprend)');
  ok(html.includes('application/ld+json'), 'JSON-LD présent');
  ok(!html.includes('</script><'.replace('<', '<' + '/')), 'pas de sortie de balise');
  const mechant = seo.schemaProduit(
    { ...p1, name: 'Savon </script><img src=x onerror=alert(1)>' },
    BASE + '/x', BASE);
  const htmlMechant = seo.baliseshtml({ ...m1, jsonLd: [mechant] }, BASE + '/x', 'N');
  ok(!htmlMechant.includes('</script><img'), 'un </script> dans un nom ne casse pas la page');

  console.log('\n== plan du site ==');
  const xml = await seo.construireSitemap(BASE, db);
  const n = (xml.match(/<loc>/g) || []).length;
  // (178 fiches + 12 rubriques + /category/All + 8 pages fixes + 1 atelier
  //  + 1 article) × 3 langues
  const rubriques = new Set(catalogue.flatMap((p) => p.collections || [])).size;
  const parLangue = catalogue.length + rubriques + 1 + 8 + ateliers.length +
                    articles.filter((a) => a.published).length;
  const attendu = parLangue * 3;
  ok(n === attendu, 'nombre d’URL attendu ' + attendu + ' (' + parLangue + ' × 3), obtenu ' + n);
  ok(xml.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'), 'espace de noms xhtml déclaré');
  ok(xml.includes('<loc>' + BASE + '/en/about</loc>'), 'la version anglaise est au plan');
  ok(xml.includes('<loc>' + BASE + '/de/contact</loc>'), 'la version allemande est au plan');
  // Chaque <url> du groupe doit porter l'ensemble complet des alternatives,
  // elle-même comprise — donc un x-default par <url>, pas un par groupe.
  ok((xml.match(/hreflang="x-default"/g) || []).length === attendu,
     'un x-default par <url> (' + attendu + ')');
  ok((xml.match(/<xhtml:link/g) || []).length === attendu * 4,
     'quatre <xhtml:link> par <url> (3 langues + x-default)');

  console.log('\n== langues ==');
  const enAccueil = await seo.metadonneesDeRoute('/en', BASE + '/en', BASE, db, shop);
  ok(enAccueil && /Geneva/.test(enAccueil.titre), 'accueil anglais :: ' + (enAccueil && enAccueil.titre));
  ok(enAccueil.langue === 'en', 'langue reconnue depuis le préfixe');
  const deAteliers = await seo.metadonneesDeRoute('/de/workshops', BASE + '/de/workshops', BASE, db, shop);
  ok(/Genf/.test(deAteliers.titre), 'ateliers en allemand :: ' + deAteliers.titre);
  const enRubrique = await seo.metadonneesDeRoute('/en/category/Savons', BASE + '/x', BASE, db, shop);
  ok(/Savons/.test(enRubrique.titre) && /Geneva/.test(enRubrique.titre),
     'rubrique : nom français, phrase anglaise :: ' + enRubrique.titre);
  ok(enRubrique.alternatives.length === 3, 'trois alternatives');
  ok(enRubrique.alternatives.some((a) => a.href === BASE + '/category/Savons'),
     'l’alternative française est sans préfixe');
  ok(enRubrique.alternatives.some((a) => a.href === BASE + '/de/category/Savons'),
     'l’alternative allemande est préfixée');

  console.log('\n== routes préfixées ==');
  ['/en', '/de', '/en/about', '/de/category/Savons', '/en/product/x'].forEach((c) =>
    ok(seo.routeConnue(c), 'connue: ' + c));
  ok(!seo.routeConnue('/en/nimportequoi'), 'inconnue sous préfixe -> 404');
  ok(!seo.routeConnue('/deodorant'), '« /deodorant » n’est pas le préfixe « /de »');
  ok(seo.separerLangue('/deodorant').langue === 'fr', 'et sa langue reste le français');
  ok(await seo.metadonneesDeRoute('/en/product/nexiste-pas', BASE + '/x', BASE, db, shop) === null,
     'produit inconnu sous préfixe -> 404');

  console.log('\n== balises hreflang ==');
  const htmlEn = seo.baliseshtml(enRubrique, BASE + '/en/category/Savons', 'N');
  ok((htmlEn.match(/rel="alternate" hreflang=/g) || []).length === 4,
     'trois langues + x-default');
  ok(htmlEn.includes('hreflang="fr-CH"') && htmlEn.includes('hreflang="de-CH"'),
     'les variantes suisses sont déclarées');
  ok(htmlEn.includes('og:locale" content="en_GB"'), 'og:locale suit la langue');
  ok(htmlEn.includes('hreflang="x-default" href="' + BASE + '/category/Savons"'),
     'x-default pointe le français');
  ok(xml.includes('<loc>' + BASE + '/product/' + seo.slugProduit(catalogue[0]) + '</loc>'), 'une fiche précise y est, sous son slug');
  ok(!xml.includes('brouillon'), 'le brouillon n’est pas au plan');
  ok(!/<loc>[^<]*&(?!amp;|apos;|quot;|lt;|gt;)/.test(xml), 'les & sont échappés dans les <loc>');
  ok(xml.includes('Bain%20%26%20Bien-'), 'la rubrique accentuée est encodée');


  console.log('\n== mesure d’audience ==');
  // Rien ne doit fuir tant que rien n’est configuré : ni balise, ni origine
  // ouverte dans la politique de contenu. Une politique se resserre par défaut.
  ok(mesure.balises('N', {}) === '', 'aucune balise sans réglage');
  const cspVide = mesure.originesCsp({});
  ok(cspVide.script.length === 0 && cspVide.connect.length === 0 && cspVide.img.length === 0,
     'aucune origine ouverte sans réglage');
  ok(/plausible/.test(mesure.balises('N', { PLAUSIBLE_DOMAIN: 'soyoucosmetics.com' })),
     'Plausible posé quand le domaine est donné');
  // Un identifiant recopié d’un ancien compte Universal Analytics produirait une
  // balise muette qu’on mettrait des semaines à soupçonner.
  ok(!/googletagmanager/.test(mesure.balises('N', { GA4_ID: 'UA-12345-1' })),
     'un identifiant UA- est ignoré, pas posé');
  ok(/googletagmanager/.test(mesure.balises('N', { GA4_ID: 'G-ABC123' })),
     'un G- valide est posé');
  ok(!/<script>alert/.test(mesure.balises('N', { GOOGLE_SITE_VERIFICATION: 'a"><script>alert(1)</script>' })),
     'le jeton de vérification est échappé');
  const cspGa = mesure.originesCsp({ GA4_ID: 'G-ABC123' });
  ok(cspGa.script.includes('https://www.googletagmanager.com'), 'GA4 ouvre googletagmanager');
  ok(!cspGa.script.includes('https://plausible.io'),
     'et pas Plausible, qui n’est pas configuré');

  console.log('\n== flux produits ==');
  const f1 = await flux.construireFlux(BASE, db);
  ok(f1.retenus > 0, 'des articles sont émis (' + f1.retenus + '/' + f1.total + ')');
  ok(/xmlns:g=/.test(f1.xml), 'espace de noms g déclaré');
  const items = (f1.xml.match(/<item>/g) || []).length;
  ok(items === f1.retenus, 'un <item> par article retenu');
  ['g:id', 'g:title', 'g:link', 'g:image_link', 'g:availability', 'g:price',
   'g:condition', 'g:brand', 'g:identifier_exists'].forEach((c) => {
    const n = (f1.xml.match(new RegExp('<' + c.replace(':', '\\:') + '>', 'g')) || []).length;
    ok(n === items, 'attribut obligatoire sur chaque article : ' + c);
  });
  // Un article à 0.00 ferait afficher « gratuit », et Merchant Center compare le
  // prix du flux à celui de la page — un écart suspend le compte.
  ok(!/>0\.00 CHF</.test(f1.xml), 'aucun article à prix nul');
  ok(/<g:price>[0-9]+\.[0-9]{2} CHF<\/g:price>/.test(f1.xml), 'prix à deux décimales, en CHF');
  const zeroEcarte = flux.evaluer({ id: 'x', name: 'Sur devis', price: 0, images: ['/a.png'], description: 'x' }, BASE);
  ok(!zeroEcarte.ok && /devis/.test(zeroEcarte.raison), 'prix nul écarté, avec sa raison');
  const sansPhoto = flux.evaluer({ id: 'x', name: 'X', price: 10, images: [], description: 'x' }, BASE);
  ok(!sansPhoto.ok && /photo/.test(sansPhoto.raison), 'sans photo écarté, avec sa raison');
  // Le champ n’est présent que sur une partie des fiches et vaut vrai par défaut
  // côté base : un « !inStock » aurait déclaré tout le catalogue en rupture.
  const dispo = flux.evaluer({ id: 'x', name: 'X', price: 10, images: ['/a.png'], description: 'x' }, BASE);
  ok(dispo.article.dispo === 'in_stock', 'inStock absent => disponible');
  const rupt = flux.evaluer({ id: 'x', name: 'X', price: 10, images: ['/a.png'], description: 'x', inStock: false }, BASE);
  ok(rupt.article.dispo === 'out_of_stock', 'inStock === false => rupture');
  ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(f1.xml), 'entités échappées dans tout le flux');


  console.log('\n== adresses lisibles des fiches ==');
  const tousLesSlugs = catalogue.map((p) => seo.slugProduit(p));
  ok(new Set(tousLesSlugs).size === catalogue.length,
     'les ' + catalogue.length + ' slugs sont uniques (' + new Set(tousLesSlugs).size + ' distincts)');
  ok(tousLesSlugs.every((s) => /^[a-z0-9-]+$/.test(s)),
     'aucun accent, aucune majuscule, aucun caractère à encoder');
  ok(tousLesSlugs.every((s) => !/--|^-|-$/.test(s)), 'pas de tiret double ni en bordure');
  // Le suffixe n’est pas décoratif : plusieurs fiches partagent le même nom,
  // et sans lui elles se réduiraient à la même adresse.
  const sansSuffixe = tousLesSlugs.map((s) => s.replace(/-[a-z0-9]{8}$/, ''));
  ok(new Set(sansSuffixe).size < catalogue.length,
     'des noms sont partagés (' + (catalogue.length - new Set(sansSuffixe).size) + ') — le suffixe les sépare');

  const echantillon = catalogue[0];
  ok(seo.trouverProduit(seo.slugProduit(echantillon), catalogue) === echantillon,
     'une fiche se retrouve par son slug');
  // Les anciennes adresses doivent continuer de répondre : elles ont été
  // envoyées par message et déposées au plan du site.
  ok(seo.trouverProduit(echantillon.id, catalogue) === echantillon,
     'et par son ancien identifiant Wix entier');
  ok(seo.trouverProduit('nexiste-pas-du-tout', catalogue) === null, 'un slug inconnu ne résout rien');
  ok(seo.trouverProduit('', catalogue) === null, 'une chaîne vide ne résout rien');
  ok(catalogue.every((p) => seo.trouverProduit(seo.slugProduit(p), catalogue) === p),
     'chaque fiche du catalogue se retrouve par son propre slug');

  // Les deux implémentations — celle du navigateur et celle du serveur — sont
  // des copies volontaires. Rien n’empêcherait qu’elles divergent, sauf ceci.
  const sourceClient = require('fs')
    .readFileSync(path.join(RACINE, 'src/data/slug.js'), 'utf8')
    .replace(/export /g, '');
  const modClient = {};
  new Function('module', sourceClient + '\nmodule.exports = { slugProduit, trouverProduit };')(modClient);
  const desaccords = catalogue.filter(
    (p) => modClient.exports.slugProduit(p) !== seo.slugProduit(p)
  );
  ok(desaccords.length === 0,
     'navigateur et serveur produisent le même slug sur les ' + catalogue.length + ' fiches' +
     (desaccords.length ? ' (' + desaccords[0].name + ')' : ''));

  console.log('\n== la fiche répond sous les deux formes ==');
  const parSlug = await seo.metadonneesDeRoute(
    '/product/' + seo.slugProduit(echantillon), BASE + '/x', BASE, db, shop);
  ok(parSlug && parSlug.titre.startsWith(echantillon.name), 'métadonnées résolues depuis le slug');
  const parId = await seo.metadonneesDeRoute(
    '/product/' + echantillon.id, BASE + '/x', BASE, db, shop);
  ok(parId && parId.titre === parSlug.titre, 'et identiques depuis l’ancien identifiant');
  ok(await seo.metadonneesDeRoute('/product/inconnu-00000000', BASE + '/x', BASE, db, shop) === null,
     'une fiche inconnue reste un 404');

  console.log('\n' + (echecs === 0 ? 'TOUT PASSE' : echecs + ' ECHEC(S)'));
  process.exit(echecs ? 1 : 0);
})();

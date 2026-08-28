require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const morgan = require('morgan');

const apiRouter = require('./routes');
const { ensureUploadsDir } = require('./uploads');
const db = require('./db');
const seo = require('./seo');

const app = express();
const PORT = process.env.PORT || 5000;

// Les en-têtes de sécurité, posés avant tout le reste pour couvrir aussi bien
// les pages que les fichiers servis en statique.
//
// Le site n'en avait aucun. Peu grave tant qu'il est fermé, plus visible une
// fois ouvert au public — c'est ce qui a motivé cet ajout.
//
// Ce qui est IMPOSÉ ci-dessous est sans risque : ces en-têtes n'empêchent de
// charger aucune ressource, ils restreignent des comportements du navigateur.
//
// La politique de contenu (CSP), elle, PEUT casser le paiement si une origine
// manque à l'appel — et le formulaire de carte de SumUp monte un iframe qu'on
// ne voit qu'au moment de payer. Elle est donc posée en « Report-Only » : le
// navigateur signale les violations dans sa console sans rien bloquer. Une
// fois une vraie commande passée sans violation, il suffira de renommer
// l'en-tête pour l'appliquer.
app.use((req, res, next) => {
  // Un jeton à usage unique pour le seul script en ligne de la page : celui que
  // le catch-all injecte plus bas avec ses contenus et ses réglages.
  //
  // C'est le mode Report-Only qui l'a révélé — la politique bloquait ce
  // script-là, pas ceux de SumUp. Imposée d'emblée, elle aurait vidé
  // window.__SHOP__ : plus d'horaires, plus de tarifs d'expédition, et le site
  // serait retombé sur ses valeurs codées sans que rien ne le signale.
  //
  // Un nonce plutôt que 'unsafe-inline' : autoriser tout le code en ligne pour
  // un seul script connu reviendrait à ouvrir la porte qu'on vient de fermer.
  res.locals.cspNonce = require('crypto').randomBytes(16).toString('base64');

  // Le site redirige déjà HTTP vers HTTPS ; ceci demande au navigateur de ne
  // plus essayer HTTP du tout. Six mois, sans includeSubDomains ni preload :
  // je ne connais pas l'état des sous-domaines (messagerie, webmail), et ces
  // deux options-là sont difficiles à défaire.
  res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  // Empêche le navigateur de deviner un type MIME différent de celui annoncé.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Le site ne doit pas pouvoir être encadré par un tiers : c'est la parade au
  // détournement de clic, où un cadre invisible recouvre le bouton d'achat.
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // L'adresse complète n'est pas transmise aux sites tiers — seulement
  // l'origine, et rien du tout en descendant vers HTTP.
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Ni caméra, ni micro, ni position. « payment » reste ouvert à SumUp :
  // le fermer bloquerait Apple Pay et Google Pay le jour où ils arrivent.
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self "https://gateway.sumup.com")'
  );

  // Relevé sur le site en ligne : le SDK de SumUp, les photos reprises de Wix,
  // la feuille de polices Google et ses fichiers, et le reste chez nous.
  // `unsafe-inline` sur les styles est nécessaire tant que des attributs style
  // subsistent dans le rendu ; il ne concerne pas les scripts.
  res.setHeader(
    'Content-Security-Policy-Report-Only',
    [
      "default-src 'self'",
      `script-src 'self' 'nonce-${res.locals.cspNonce}' https://gateway.sumup.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://static.wixstatic.com https://gateway.sumup.com",
      "media-src 'self'",
      "connect-src 'self' https://gateway.sumup.com https://api.sumup.com",
      // Le plan d'acces de la page « Nous trouver » : maps.google.com
      // redirige vers www.google.com, il faut donc les deux. Trouve par la
      // mise en observation — imposee, la politique aurait fait disparaitre
      // la carte de la page dont c'est toute la raison d'etre.
      "frame-src https://gateway.sumup.com https://*.sumup.com https://maps.google.com https://www.google.com",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
    ].join('; ')
  );
  next();
});

// Enable CORS
app.use(cors());

// Log HTTP requests (Morgan)
app.use(morgan('dev'));

// La compression, mesurée sur le site en ligne plutôt que supposée.
//
//   curl -H 'Accept-Encoding: gzip, br' .../assets/index-….js
//   -> 1 037 027 octets, aucun en-tête content-encoding
//
// Le paquet principal partait donc entier, à chaque première visite, sur un
// site dont la clientèle est à Genève et souvent sur son téléphone. Rien devant
// le serveur ne compressait : ni proxy, ni hébergeur. Le doute était permis
// avant la mesure — il ne l'est plus.
//
// Le gain est immédiat et sans contrepartie : ce paquet tombe aux alentours de
// 146 Ko, et translations.js de 102 à 33 Ko.
//
// Dans un try/catch, et c'est délibéré. Les commentaires de ce dépôt décrivent
// un déploiement qui ne remplace que ./dist ; si node_modules n'est pas
// réinstallé sur l'hôte, `require` échouerait au démarrage et le site entier
// tomberait — pour une optimisation. Absent, il ne se passe rien de plus
// qu'avant, et la ligne du journal dit quoi faire.
try {
  const compression = require('compression');
  app.use(compression());
} catch (err) {
  console.warn(
    'compression absent : les fichiers partent sans compression. ' +
    'Lancer « npm install --prefix server » sur l’hôte pour l’activer.'
  );
}

// Parse incoming JSON requests. Preserve the raw body too so /api/sumup/webhook
// can verify SumUp's HMAC signature against the exact bytes that were signed.
// Limit is generous because product image uploads are sent as base64 JSON.
app.use(express.json({
  limit: '25mb',
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));

// Serve admin-uploaded product images. Location is shared with routes.js and
// overridable via UPLOADS_DIR so it can point at a persistent volume.
const uploadsRoot = ensureUploadsDir();
app.use('/uploads', express.static(uploadsRoot));

// Serve ACME HTTP-01 challenge files from the filesystem (for Let's Encrypt SSL validation).
// Infomaniak writes challenge tokens into ./.well-known/acme-challenge/ at the site root.
const acmeRoot = path.join(__dirname, '..', '.well-known');
app.use('/.well-known', express.static(acmeRoot, { dotfiles: 'allow', fallthrough: false }));

// API endpoints mounted on /api
app.use('/api', apiRouter);

// Le plan du site, construit à la demande depuis la base : elle ajoute un
// produit, il y est. Un fichier écrit au moment du build serait faux le jour
// même, et le catalogue change depuis l'administration.
//
// Posé ici, avant express.static et avant le catch-all : sans cela une panne de
// génération ferait répondre le catch-all, c'est-à-dire du HTML en 200 là où
// Google attend du XML — ce qu'il signale comme un plan illisible plutôt que
// comme un plan absent, et c'est bien plus difficile à diagnostiquer.
app.get('/sitemap.xml', async (req, res) => {
  try {
    // Sans « trust proxy », req.protocol dit « http » derrière le proxy qui
    // termine le TLS : on lit d'abord ce que le proxy annonce.
    const schema = req.get('x-forwarded-proto') || req.protocol || 'https';
    const base = `${schema}://${req.get('host')}`;
    res.type('application/xml').send(await seo.construireSitemap(base, db));
  } catch (err) {
    // Un plan absent vaut mieux qu'un plan faux : on ne sert pas une liste
    // tronquée que Google prendrait pour la vérité sur l'étendue du site.
    console.error('sitemap.xml indisponible :', err.message);
    res.status(500).type('text/plain').send('sitemap indisponible');
  }
});

// Serve static built files from React in production
const buildPath = path.join(__dirname, '../dist');
// index: false is load-bearing. express.static answers a directory request with
// index.html by default, so "/" — the page most people land on — would be served
// straight from disk and never reach the catch-all below, arriving without her
// texts injected. Every other route worked, which is exactly what made this
// worth catching with a test rather than by eye.
app.use(express.static(buildPath, {
  index: false,
  setHeaders: (res, chemin) => {
    // Les fichiers de /assets/ portent une empreinte dans leur nom : Vite en
    // change à chaque fois que leur contenu change. Ils sont donc immuables au
    // sens strict — une adresse donnée ne désignera jamais un autre contenu.
    //
    // Le site les servait avec « max-age=0 » (relevé en ligne) : chaque visite
    // suivante revalidait le paquet entier auprès du serveur pour s'entendre
    // répondre qu'il n'avait pas changé. Un aller-retour réseau par fichier,
    // pour rien.
    //
    // Un an et « immutable » : le navigateur ne redemande plus rien. Le
    // déploiement suivant produit d'autres noms, donc d'autres adresses, et
    // rien ne peut rester coincé sur une version périmée.
    //
    // index.html est délibérément exclu : c'est lui qui désigne les empreintes
    // du jour, et le mettre en cache figerait le site sur son ancienne version.
    if (/[\\/]assets[\\/]/.test(chemin)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

// Serialise the content overrides for embedding inside a <script> tag.
//
// JSON.stringify alone is not safe here: a text containing </script> would end
// the tag early and break every page on the site. Escaping < > & as unicode
// sequences keeps the value a valid JS string while making that impossible.
// U+2028/U+2029 are legal in JSON but not in JS string literals, so they go too.
// Her maintenance message goes into HTML text, not into a script, so it needs
// the ordinary entity escaping rather than the unicode form used below.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Ce que la page publique a le droit de connaître des réglages.
//
// Le catch-all injectait l'objet entier, qui s'est enrichi depuis : il contient
// désormais l'adresse où la prévenir de ses ruptures de stock, ses coordonnées
// de facturation, son numéro de TVA et le compteur de factures — c'est-à-dire
// le nombre de commandes qu'elle a reçues. Rien de tout cela n'a sa place dans
// le source d'une page publique.
//
// Liste blanche plutôt que liste noire : le prochain réglage ajouté sera privé
// par défaut, ce qui est le bon sens de l'erreur.
function reglagesPublics(shop) {
  return {
    hours: shop.hours,
    absence: shop.absence,
    shipping: shop.shipping,
    // Le prix de l'emballage cadeau est public : il s'affiche a la caisse. Ce
    // qui reste prive, c'est tout le reste — l'adresse d'alerte, le compteur de
    // factures, le numero de TVA. La liste est blanche, jamais noire.
    giftWrap: shop.giftWrap,
  };
}

function serialiseContent(content) {
  // The replacement is the six characters backslash-u-0-0-3-c, not the character
  // it denotes: writing the escape sequence itself here would substitute '<' for
  // '<' and do nothing at all, which is the quiet way this protection fails.
  return JSON.stringify(content).replace(
    /[<>&\u2028\u2029]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
  );
}

// Catch-all handler for client-side routing. Serves index.html for any non-API
// page request, with her content overrides injected into the document.
//
// Injecting here rather than fetching them from the client is the whole point:
// the texts are read synchronously from the bundle today, so a fetch would make
// the *old* wording flash on every page load before the new one replaced it.
//
// Both files are read per request rather than cached at startup. index.html is
// replaced by every deploy, and a restart cannot be relied on to happen (the
// hosting panel's restart button fails silently — see the execution plan), so a
// process-lifetime cache would keep serving a stale bundle reference. Two small
// reads that the OS already caches are cheaper than that class of bug.
app.get('*', async (req, res, next) => {
  // Never swallow ACME challenge requests with the SPA fallback
  if (req.path.startsWith('/.well-known/')) return next();

  const indexPath = path.join(buildPath, 'index.html');
  try {
    const shop = db.getShopSettings();

    // Maintenance mode. She asked for a way to take the shop off the air while
    // it is still being finished, without it also locking her — or us — out.
    // /admin and /api stay reachable, so she can turn it back off from the same
    // interface that turned it on; anything else gets a plain notice.
    if (shop.maintenance && shop.maintenance.active && !req.path.startsWith('/admin')) {
      const message = shop.maintenance.fr || 'Le site est momentanément en maintenance. Merci de votre patience.';
      return res.status(503).type('html').send(
        `<!doctype html><html lang="fr"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>So You Cosmetics</title><style>` +
        `body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
        `background:#F7F3EC;color:#3A332B;font-family:system-ui,-apple-system,sans-serif;padding:2rem}` +
        `div{max-width:32rem;text-align:center}h1{font-weight:300;letter-spacing:.02em}` +
        `p{color:#6A6157;line-height:1.6}</style></head><body><div>` +
        `<h1>So You Cosmetics</h1><p>${escapeHtml(message)}</p></div></body></html>`
      );
    }

    let html = fs.readFileSync(indexPath, 'utf8');
    const content = db.readContent();
    // Le script de données est assemblé plus bas, une fois connu ce que le
    // serveur a su dire de la page : window.__SEO__ en fait partie.
    let tag = '';
    let seoClient = null;
    // If </head> is somehow absent, fall through to the untouched file rather
    // than guessing where to put the tag.
    if (!html.includes('</head>')) return res.sendFile(indexPath);

    // Le titre, la description, l'adresse canonique et les données structurées
    // de la page demandée — quelle qu'elle soit.
    //
    // Ce bloc ne traitait que les fiches produit. Les robots qui fabriquent
    // l'aperçu d'un lien — WhatsApp, Facebook, LinkedIn, Signal, Slack — ne
    // lisent que le HTML reçu et ne l'exécutent pas : un lien vers l'accueil,
    // une rubrique, un atelier ou un article partait donc en adresse nue, sans
    // titre ni photo. Pour une boutique dont le geste commercial le plus
    // courant est d'envoyer un lien, c'était le lien lui-même qui ne vendait
    // pas. Les moteurs autres que Google sont dans le même cas.
    //
    // Sans « trust proxy », req.protocol dit « http » derrière le proxy qui
    // termine le TLS : on lit d'abord ce que le proxy annonce.
    const schema = req.get('x-forwarded-proto') || req.protocol || 'https';
    const base = `${schema}://${req.get('host')}`;
    // L'adresse canonique est donnée sans la chaîne de requête : la même page
    // partagée avec un ?utm_source ne doit pas devenir un doublon d'elle-même.
    const urlPage = `${base}${req.path}`;
    let statut = 200;

    try {
      const meta = await seo.metadonneesDeRoute(req.path, urlPage, base, db, shop);

      if (meta === null || !seo.routeConnue(req.path)) {
        // La ressource n'existe pas : une référence inconnue, un atelier
        // supprimé, un brouillon, ou une adresse qui ne correspond à aucune
        // route. Le site répondait 200 à tout, y compris à cela — chaque
        // adresse morte devenait donc une page indexable de plus, vide et
        // indistinguable des vraies. On dit maintenant ce qui est.
        //
        // Le corps reste la même application : elle affiche déjà ses propres
        // messages « introuvable ». Seuls le statut et le « noindex » changent.
        statut = 404;
        const avant = html;
        html = html.replace(
          /<meta\s+name="robots"[^>]*>/i,
          '<meta name="robots" content="noindex, follow">'
        );
        // Si index.html ne portait pas la balise — elle y est aujourd'hui, mais
        // rien ne le garantit demain — on la pose plutôt que de servir un 404
        // sans consigne. Deux balises « robots » qui se contredisent seraient
        // pires que pas de balise du tout, d'où le remplacement d'abord.
        if (html === avant) tag = '<meta name="robots" content="noindex, follow">' + tag;
      } else if (meta) {
        // index.html déclare lang="fr" en dur. Une page anglaise servie avec
        // cette déclaration se contredit elle-même : le moteur lit « français »
        // dans le document et de l'anglais dedans, et les lecteurs d'écran
        // prononcent le texte avec la mauvaise phonétique.
        html = html.replace(/<html([^>]*)\slang="[^"]*"/i, `<html$1 lang="${meta.langue}"`);
        html = html.replace(/<title>[\s\S]*?<\/title>/i,
          `<title data-pose="app">${seo.escapeHtml(meta.titre)}</title>`);
        // Le plancher d'index.html s'efface devant celle de la route. Sans ce
        // retrait la page porterait deux balises « description » : Google en
        // choisirait une au hasard, et le hook du navigateur — qui prend la
        // première venue — mettrait à jour l'autre. Une seule, toujours.
        html = html.replace(/<meta\s+name="description"[^>]*>/i, '');
        tag = seo.baliseshtml(meta, urlPage, res.locals.cspNonce) + tag;
        // Ce que le serveur vient de poser, laissé à portée du navigateur.
        //
        // Sans cela le hook du navigateur écrase le titre du serveur au montage
        // par le sien, qui est plus pauvre : « Savons » remplaçait « Savons
        // artisanaux faits main à Genève ». Google exécute le JavaScript avant
        // de lire la page — c'est donc la version écrasée qu'il indexe, et tout
        // le travail fait ici était perdu à la seconde près.
        //
        // Le chemin sert de garde : dès que le visiteur navigue ailleurs, il ne
        // correspond plus et le hook reprend la main, comme avant.
        seoClient = { chemin: req.path, titre: meta.titre, description: meta.description };
      }
      // meta === undefined : route connue mais volontairement muette
      // (l'administration, la recherche). La page part telle quelle.
    } catch (err) {
      // Une base muette ne doit pas empêcher la page de s'afficher : on sert
      // alors le document générique, comme avant. Répondre 404 sur une panne
      // serait pire que le défaut qu'on corrige — cela désindexerait des pages
      // qui existent.
      console.error('Balises de partage non posees :', err.message);
    }

    // Le script de données vient en dernier, après les balises : ainsi le
    // titre et la description sont lisibles par un robot qui s'arrête au
    // premier kilo-octet, et window.__SEO__ y porte ce que le serveur a posé.
    tag += `<script nonce="${res.locals.cspNonce}">window.__CONTENT__=${serialiseContent(content)};` +
           `window.__SHOP__=${serialiseContent(reglagesPublics(shop))};` +
           `window.__SEO__=${serialiseContent(seoClient)}</script>`;

    res.status(statut).type('html').send(html.replace('</head>', `${tag}</head>`));
  } catch (err) {
    // The site must survive a failure here: worst case it serves the page with
    // its coded defaults, which is exactly how it behaved before this existed.
    console.error('Content injection failed, serving index.html as-is:', err.message);
    res.sendFile(indexPath);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`  Serveur So You Cosmetics démarré.`);
  console.log(`  Local URL:  http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Uploads dir: ${uploadsRoot}`);
  console.log(`=========================================`);
});

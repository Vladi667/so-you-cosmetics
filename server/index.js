require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const morgan = require('morgan');

const apiRouter = require('./routes');
const { ensureUploadsDir } = require('./uploads');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Log HTTP requests (Morgan)
app.use(morgan('dev'));

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

// Serve static built files from React in production
const buildPath = path.join(__dirname, '../dist');
// index: false is load-bearing. express.static answers a directory request with
// index.html by default, so "/" — the page most people land on — would be served
// straight from disk and never reach the catch-all below, arriving without her
// texts injected. Every other route worked, which is exactly what made this
// worth catching with a test rather than by eye.
app.use(express.static(buildPath, { index: false }));

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
app.get('*', (req, res, next) => {
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

    const html = fs.readFileSync(indexPath, 'utf8');
    const content = db.readContent();
    const tag = `<script>window.__CONTENT__=${serialiseContent(content)};` +
                `window.__SHOP__=${serialiseContent(reglagesPublics(shop))}</script>`;
    // If </head> is somehow absent, fall through to the untouched file rather
    // than guessing where to put the tag.
    if (!html.includes('</head>')) return res.sendFile(indexPath);
    res.type('html').send(html.replace('</head>', `${tag}</head>`));
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

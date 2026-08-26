const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

// Load static products as our database fallback / catalog source
const productsData = require('./products.json');

// Paths for local JSON files
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json');
const WORKSHOPS_FILE = path.join(DATA_DIR, 'workshops.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');
const NEWSLETTER_FILE = path.join(DATA_DIR, 'newsletter.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');

// Ensure data folder exists locally
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Password hashing helpers
function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  const hash = crypto.createHmac('sha256', salt);
  hash.update(password);
  return hash.digest('hex');
}

// Écrire un fichier de données sans jamais le laisser à moitié écrit.
//
// Tout ici passait par `fs.writeFileSync` nu : le fichier est tronqué à zéro,
// puis rempli. Une coupure de courant, un disque plein ou un redémarrage entre
// les deux laisse un fichier vide ou coupé au milieu d'un objet — et sur
// orders.json, cela veut dire toutes les commandes perdues, sans sauvegarde.
//
// On écrit à côté, puis on renomme. Sur un même système de fichiers, le
// renommage est atomique : à tout instant, le fichier visible est soit
// l'ancien complet, soit le nouveau complet, jamais un entre-deux.
function ecrireJson(cheminFichier, donnees) {
  const temporaire = `${cheminFichier}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporaire, JSON.stringify(donnees, null, 2), 'utf8');
    fs.renameSync(temporaire, cheminFichier);
  } catch (err) {
    // Le fichier d'origine est intact : on n'y a pas touché.
    try { fs.unlinkSync(temporaire); } catch { /* deja disparu */ }
    throw err;
  }
}

const initJsonFile = (filePath, defaultData = []) => {
  if (!fs.existsSync(filePath)) {
    ecrireJson(filePath, defaultData);
  }
};

// ------------- Admin sessions (server-side, file-based) -------------
// Cryptographically-random bearer tokens, stored with an expiry and validated
// on every admin request. Replaces the old forgeable "token_admin_" prefix.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function readSessions() {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')) || [];
  } catch (_) {
    return [];
  }
}

function writeSessions(list) {
  ecrireJson(SESSIONS_FILE, list);
}

function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex'); // 256-bit, unguessable
  const sessions = readSessions().filter(s => s.expiresAt > Date.now()); // prune expired
  sessions.push({ token, username, createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS });
  writeSessions(sessions);
  return token;
}

function getSession(token) {
  if (!token) return null;
  const session = readSessions().find(s => s.token === token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) return null;
  return session;
}

function deleteSession(token) {
  if (!token) return;
  writeSessions(readSessions().filter(s => s.token !== token));
}

initJsonFile(ORDERS_FILE);
initJsonFile(BOOKINGS_FILE);
initJsonFile(CONTACTS_FILE);
initJsonFile(WORKSHOPS_FILE);
initJsonFile(SETTINGS_FILE, {});
initJsonFile(CONTENT_FILE, {});
initJsonFile(ARTICLES_FILE, []);
initJsonFile(NEWSLETTER_FILE);
initJsonFile(SESSIONS_FILE);

// Seed admin in JSON file if it doesn't exist
if (!fs.existsSync(ADMIN_FILE)) {
  const salt = generateSalt();
  const hash = hashPassword('soyoucosmetics', salt);
  const defaultAdmin = {
    username: 'admin',
    password_hash: hash,
    salt: salt
  };
  ecrireJson(ADMIN_FILE, defaultAdmin);
}

// Check if MySQL is configured (env variables)
const isProductionDb = process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME;
let pool = null;

if (isProductionDb) {
  console.log('Database: Configuring MySQL Connection Pool...');
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Verify and initialize database tables
  initProductionDatabase();
} else {
  console.log('Database: Running locally using File-based JSON Database.');
}

// Which optional columns are actually available on the live schema. Writes are
// built from this: if a migration could not run (e.g. the database user has no
// ALTER privilege), we must fall back to the older column set rather than issue
// an INSERT naming a column that does not exist — that would fail, hit the
// JSON-file fallback, and quietly write products to a file the MySQL-backed
// catalogue never reads.
const schema = { productStock: false };

// Add a column only if it is missing. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
// is MariaDB-only syntax and throws on stock MySQL, so we check the catalog
// first — this works on both. Returns true if the column is available
// afterwards (whether it already existed or we just created it).
async function ensureColumn(conn, table, column, definition) {
  try {
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    if (rows[0].n > 0) return true;
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`Database: added missing column ${table}.${column}`);
    return true;
  } catch (err) {
    console.error(`Database: failed to ensure column ${table}.${column}`, err.message);
    return false;
  }
}

async function initProductionDatabase() {
  try {
    const conn = await pool.getConnection();
    console.log('Database: Connected to MySQL successfully!');
    
    // Create products table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        ribbon VARCHAR(100),
        collections TEXT,
        images TEXT,
        stock INT NULL,
        in_stock TINYINT(1) NOT NULL DEFAULT 1
      )
    `);

    // Migrate tables created before stock tracking existed. Without this the
    // admin's stock/"épuisé" edits are accepted by the API and silently dropped.
    const hasStock = await ensureColumn(conn, 'products', 'stock', 'INT NULL');
    const hasInStock = await ensureColumn(conn, 'products', 'in_stock', 'TINYINT(1) NOT NULL DEFAULT 1');
    schema.productStock = hasStock && hasInStock;
    if (!schema.productStock) {
      console.error('Database: products.stock/in_stock unavailable — stock levels will NOT be saved. Check that the database user has ALTER privileges.');
    }

    // Create orders table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(100) PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        items TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        stripe_payment_intent VARCHAR(255),
        fulfillment TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrate orders tables created before pickup/shipping tracking existed.
    await ensureColumn(conn, 'orders', 'fulfillment', 'TEXT NULL');

    // Create bookings table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id VARCHAR(100) PRIMARY KEY,
        workshop_id VARCHAR(100) NOT NULL,
        slot_date VARCHAR(100) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        seats INT DEFAULT 1,
        status VARCHAR(50) DEFAULT 'Confirmed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create contact queries table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(255),
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create newsletter subscribers table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS newsletter (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create workshops table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS workshops (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        duration VARCHAR(100),
        image_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create admins table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        salt VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed admin if empty
    const [adminRows] = await conn.query('SELECT COUNT(*) as count FROM admins');
    if (adminRows[0].count === 0) {
      console.log('Database: Seeding MySQL admins table with default user...');
      const salt = generateSalt();
      const hash = hashPassword('soyoucosmetics', salt);
      await conn.query(
        'INSERT INTO admins (username, password_hash, salt) VALUES (?, ?, ?)',
        ['admin', hash, salt]
      );
    }

    // Seed products table if empty
    const [rows] = await conn.query('SELECT COUNT(*) as count FROM products');
    if (rows[0].count === 0) {
      console.log('Database: Seeding MySQL products table from products.json...');
      for (const prod of productsData.products) {
        const cols = ['id', 'name', 'description', 'price', 'ribbon', 'collections', 'images'];
        const vals = [
          prod.id,
          prod.name,
          prod.description,
          prod.price,
          prod.ribbon || null,
          JSON.stringify(prod.collections),
          JSON.stringify(prod.images)
        ];
        if (schema.productStock) {
          cols.push('stock', 'in_stock');
          vals.push(prod.stock == null ? null : Number(prod.stock), prod.inStock === false ? 0 : 1);
        }
        await conn.query(
          `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          vals
        );
      }
      console.log(`Database: Successfully seeded ${productsData.products.length} products.`);
    }

    conn.release();
  } catch (err) {
    console.error('Database Initialization failed! Falling back to JSON database.', err);
    pool = null; // Disable MySQL
  }
}

// ==========================================
// database actions
// ==========================================

// Parse a TEXT/JSON column that should hold an array of strings. A malformed
// value must never throw: previously one bad row made the whole catalogue fall
// back to the bundled static JSON, which is how edited products appeared to
// "lose" their images.
function parseArrayColumn(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

// Map a MySQL products row onto the shape the app uses everywhere else
// (camelCase `inStock`, arrays for collections/images).
function mapProductRow(r) {
  const { in_stock, ...rest } = r;
  return {
    ...rest,
    price: parseFloat(r.price),
    collections: parseArrayColumn(r.collections),
    images: parseArrayColumn(r.images),
    stock: r.stock == null ? null : Number(r.stock),
    inStock: in_stock === undefined || in_stock === null ? true : !!in_stock
  };
}

// Map a MySQL orders row onto the shape the app uses. `items` and `fulfillment`
// are JSON-encoded TEXT columns; a malformed value must degrade gracefully
// rather than throw, and `fulfillment` must be an object — the admin reads
// .type/.carrier/.tracking_number off it directly.
function mapOrderRow(r) {
  let fulfillment = null;
  if (r.fulfillment) {
    if (typeof r.fulfillment === 'string') {
      try { fulfillment = JSON.parse(r.fulfillment); } catch (_) { fulfillment = null; }
    } else {
      fulfillment = r.fulfillment;
    }
  }
  let items = r.items;
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch (_) { items = []; }
  }
  return { ...r, total: parseFloat(r.total), items, fulfillment };
}

// 1. Get Products
async function getProducts() {
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM products');
      return rows.map(mapProductRow);
    } catch (err) {
      console.error('MySQL getProducts failed, falling back to JSON file', err);
    }
  }
  return productsData.products;
}

// 2. Get Product By ID
async function getProductById(id) {
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
      if (rows.length > 0) return mapProductRow(rows[0]);
      return null;
    } catch (err) {
      console.error('MySQL getProductById failed, falling back to JSON file', err);
    }
  }
  return productsData.products.find(p => p.id === id) || null;
}

// ---- Product catalog editing (admin) ----
// In file-based mode, products live in server/products.json ({ categories, products }).
// We read/write that file and keep the in-memory `productsData` cache in sync so
// changes are reflected immediately without a restart.
function readProductsFile() {
  return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
}

function writeProductsFile(data) {
  ecrireJson(PRODUCTS_FILE, data);
  // keep the cached require() object in sync
  productsData.products = data.products;
  if (data.categories) productsData.categories = data.categories;
}

// Reprendre les trois champs que seule elle possède : composition, contenance,
// poids.
//
// Les colonnes existent depuis la vague 10 ; elles sont vides sur les 178
// produits. Ce qui manquait, c'était le chemin pour y verser son export sans
// passer par 178 saisies à la main.
//
// SIMULE PAR DÉFAUT. La règle du plan est explicite pour ce genre d'écriture :
// produire d'abord le tableau, le lui faire valider, appliquer ensuite. Rien
// n'est écrit sans `appliquer: true`.
function normaliserReference(texte) {
  return String(texte || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Une liste d'ingrédients coupée est pire qu'absente : l'allergène disparaît de
// la ligne que quelqu'un est en train de lire pour savoir s'il peut acheter.
// On refuse ce qu'on soupçonne plutôt que de le publier.
function inciSuspecte(texte) {
  const t = String(texte || '');
  const motifs = [];
  if (/[a-z]-[a-z]{2,}/.test(t) && !/[a-z]-(free|\d)/i.test(t)) motifs.push('mot coupé par un tiret');
  if (/,[A-Za-z]/.test(t)) motifs.push('virgule sans espace');
  if (/\.{3}|…/.test(t)) motifs.push('liste tronquée');
  if (t.length > 0 && t.length < 25) motifs.push('liste anormalement courte');
  return motifs;
}

function importerMetadonnees(lignes, options = {}) {
  const appliquer = options.appliquer === true;
  const data = readProductsFile();
  const produits = data.products || [];

  const parId = new Map(produits.map((p) => [String(p.id), p]));
  const parNom = new Map();
  for (const p of produits) {
    const cle = normaliserReference(p.name);
    if (!cle) continue;
    // Deux produits portant le même nom : on ne devine pas lequel elle visait.
    parNom.set(cle, parNom.has(cle) ? null : p);
  }

  const rapport = {
    traitees: 0, appliquees: 0,
    introuvables: [], ambigues: [], refusees: [], avertissements: [],
  };

  for (const ligne of Array.isArray(lignes) ? lignes : []) {
    rapport.traitees++;
    const ref = String((ligne && ligne.reference) || '').trim();
    if (!ref) { rapport.refusees.push({ ref: '(vide)', motif: 'référence absente' }); continue; }

    let produit = parId.get(ref);
    if (!produit) {
      const cle = normaliserReference(ref);
      if (parNom.has(cle) && parNom.get(cle) === null) { rapport.ambigues.push(ref); continue; }
      produit = parNom.get(cle);
    }
    if (!produit) { rapport.introuvables.push(ref); continue; }

    const champs = {};

    if (ligne.inci !== undefined && String(ligne.inci).trim()) {
      const inci = String(ligne.inci).trim();
      const doutes = inciSuspecte(inci);
      if (doutes.length) {
        rapport.refusees.push({ ref, motif: 'composition suspecte — ' + doutes.join(', ') });
      } else {
        champs.inci = inci;
      }
    }

    if (ligne.contenance !== undefined && String(ligne.contenance).trim()) {
      champs.contenance = String(ligne.contenance).trim();
    }

    if (ligne.poids !== undefined && String(ligne.poids).trim()) {
      const g = Number(String(ligne.poids).replace(',', '.'));
      if (!Number.isFinite(g) || g <= 0) {
        rapport.refusees.push({ ref, motif: 'poids illisible : ' + ligne.poids });
      } else if (g > 20000) {
        rapport.refusees.push({ ref, motif: 'poids invraisemblable : ' + g + ' g' });
      } else {
        // En grammes, entier : la Poste ne facture pas au milligramme.
        champs.poids = Math.round(g);
        if (g < 5) rapport.avertissements.push({ ref, motif: 'poids très faible : ' + g + ' g' });
      }
    }

    if (Object.keys(champs).length === 0) continue;
    rapport.appliquees++;
    if (appliquer) Object.assign(produit, champs);
  }

  if (appliquer && rapport.appliquees > 0) {
    // Une sauvegarde horodatée avant d'écrire : c'est le seul exemplaire de son
    // catalogue, et un import raté ne se rattrape pas.
    const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const copie = PRODUCTS_FILE + '.bak-avant-import-' + horodatage;
    fs.copyFileSync(PRODUCTS_FILE, copie);
    rapport.sauvegarde = copie;
    writeProductsFile(data);
  }

  rapport.simulation = !appliquer;
  return rapport;
}

// Turn a Google Drive *share* link into a directly-embeddable image URL.
// Accepts the common shapes the admin might paste:
//   https://drive.google.com/file/d/FILEID/view?usp=sharing
//   https://drive.google.com/open?id=FILEID
//   https://drive.google.com/uc?export=view&id=FILEID
//   https://docs.google.com/...?id=FILEID
// and rewrites them to https://drive.google.com/thumbnail?id=FILEID&sz=w1920
// (renders in <img> for files shared as "Anyone with the link"). Non-Drive
// URLs are returned unchanged.
function normalizeImageUrl(url) {
  if (typeof url !== 'string') return url;
  const u = url.trim();
  if (!/(?:drive|docs)\.google\.com/.test(u)) return u;
  let m, id = null;
  if ((m = u.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/))) id = m[1];
  else if ((m = u.match(/[?&]id=([a-zA-Z0-9_-]{10,})/))) id = m[1];
  else if ((m = u.match(/\/d\/([a-zA-Z0-9_-]{10,})/))) id = m[1];
  if (!id) return u;
  return `https://drive.google.com/thumbnail?id=${id}&sz=w1920`;
}

function normalizeProductInput(input, base = {}) {
  const toArray = (v) => {
    if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    return [];
  };

  // Les URL ne se decoupent QUE sur les retours a la ligne. Une adresse Wix
  // contient des virgules : .../v1/fill/w_800,h_1000,al_c,q_90,usm_0.66/file.jpg
  // et toArray la debitait en cinq morceaux. C est arrive a « Hydrolat de menthe
  // poivree bio », dont la galerie affiche aujourd hui une URL tronquee suivie
  // de quatre fragments.
  const toUrls = (v) => {
    if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    return [];
  };
  const out = { ...base };
  if (input.name !== undefined) out.name = input.name;
  if (input.description !== undefined) out.description = input.description;
  if (input.price !== undefined) out.price = Number(input.price) || 0;
  if (input.ribbon !== undefined) out.ribbon = input.ribbon || null;
  if (input.collections !== undefined) out.collections = toArray(input.collections);
  // Les produits qu'elle a choisi de mettre en « Vous aimerez aussi ». Stockés
  // comme identifiants : un nom changé ne doit pas rompre l'association.
  if (input.related !== undefined) out.related = toArray(input.related);
  if (input.images !== undefined) {
    const next = toUrls(input.images).map(normalizeImageUrl);
    const had = Array.isArray(base.images) && base.images.length > 0;
    // Refuse to silently wipe a product's images. A client bug (or a stale form
    // that never loaded them) must not destroy them; clearing is only honoured
    // when the caller says so explicitly via `clearImages`.
    if (next.length === 0 && had && !input.clearImages) {
      console.warn(`Product update sent an empty image list for "${base.name || base.id}" without clearImages — keeping the existing ${base.images.length} image(s).`);
    } else {
      out.images = next;
    }
  }
  // Stock count (optional, admin-only) and explicit in/out-of-stock flag.
  if (input.stock !== undefined) {
    out.stock = input.stock === '' || input.stock === null ? null : (Number(input.stock) || 0);
  }
  if (input.inStock !== undefined) {
    out.inStock = !!input.inStock;
  }

  // Ce qu'il y a dans le flacon.
  //
  // Ces champs sont cadrés TOUS ENSEMBLE, y compris ceux dont l'interface
  // viendra plus tard. La raison est mécanique : cette liste blanche est
  // stricte et sans branche par défaut — tout champ qu'elle ne connaît pas est
  // silencieusement jeté. Les ajouter au fil de l'eau voudrait dire six
  // migrations du catalogue et six redémarrages du serveur, alors qu'un seul
  // cadrage suffit.
  //
  // Un champ n'existe vraiment qu'ajouté aux QUATRE endroits : ici, dans les
  // colonnes SQL, dans le modèle ensureColumn, ET dans le payload de
  // l'administration. Oublier le quatrième donne une saisie qui paraît
  // acceptée et qui s'évapore au rechargement.
  // Un produit marque bon cadeau declenche les champs du destinataire a la
  // caisse. Le montant reste celui de la fiche : un bon de CHF 150 est un
  // produit a CHF 150, et le serveur facture toujours le prix du catalogue par
  // identifiant. Une variante de prix aurait ouvert la porte a un bon debite au
  // montant d'un autre.
  if (input.bonCadeau !== undefined) out.bonCadeau = !!input.bonCadeau;
  if (input.contenance !== undefined) out.contenance = String(input.contenance || '').trim();
  if (input.ingredients !== undefined) out.ingredients = String(input.ingredients || '').trim();
  if (input.inci !== undefined) out.inci = String(input.inci || '').trim();
  if (input.typePeau !== undefined) out.typePeau = toArray(input.typePeau);
  if (input.besoins !== undefined) out.besoins = toArray(input.besoins);
  if (input.etiquettes !== undefined) out.etiquettes = toArray(input.etiquettes);

  // Réservés aux modules signature, cadrés maintenant pour ne plus toucher au
  // catalogue ensuite : la recette et le parfum (orgue à parfums), le rituel
  // {etape, geste} (rituel complet), le contenant (recharge en ligne).
  if (input.recette !== undefined) out.recette = String(input.recette || '').trim();
  if (input.parfum !== undefined) out.parfum = String(input.parfum || '').trim();
  if (input.contenant !== undefined) out.contenant = String(input.contenant || '').trim();
  // Le prix de la recharge, quand la cliente rapporte son flacon. C'est une
  // VRAIE variante de prix, pas un rabais affiché : le serveur facturera ce
  // montant-là pour cette ligne. Sans cela, « je rapporte le mien — CHF 15.00 »
  // débiterait le prix plein, et elle l'apprendrait par une cliente mécontente
  // plutôt que par un test.
  if (input.rechargePrix !== undefined) {
    const n = Number(input.rechargePrix);
    out.rechargePrix = Number.isFinite(n) && n > 0 ? n : null;
  }
  if (input.rituel !== undefined) {
    const r = input.rituel || {};
    out.rituel = r && (r.etape || r.geste)
      ? { id: String(r.id || '').trim(), etape: String(r.etape || '').trim(), geste: String(r.geste || '').trim() }
      : null;
  }

  return out;
}

async function createProduct(input) {
  const product = normalizeProductInput(input, {
    id: 'product_' + crypto.randomUUID(),
    description: '',
    price: 0,
    ribbon: null,
    collections: [],
    images: [],
    stock: null,
    inStock: true
  });

  if (pool) {
    try {
      const cols = ['id', 'name', 'description', 'price', 'ribbon', 'collections', 'images'];
      const vals = [product.id, product.name, product.description, product.price, product.ribbon, JSON.stringify(product.collections), JSON.stringify(product.images)];
      if (schema.productStock) {
        cols.push('stock', 'in_stock');
        vals.push(product.stock ?? null, product.inStock === false ? 0 : 1);
      }
      await pool.query(
        `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        vals
      );
      return product;
    } catch (err) {
      console.error('MySQL createProduct failed, falling back to JSON file', err);
    }
  }

  const data = readProductsFile();
  data.products.push(product);
  writeProductsFile(data);
  return product;
}

// Retire du stock ce qu'une commande payée a emporté, et rend compte de ce qui
// est passé sous les seuils.
//
// Le décrément se fait au paiement confirmé, pas à la création de la commande :
// un panier abandonné immobiliserait sinon du stock que personne n'a acheté.
// Le revers est connu et accepté ici — deux clients peuvent payer le dernier
// article à quelques secondes d'intervalle. À ce volume, une rupture rare et
// visible vaut mieux qu'un stock fantôme permanent.
//
// Un produit dont le stock est `null` n'est pas suivi : on n'y touche pas.
function decrementStock(items, seuilBas = 3) {
  const data = readProductsFile();
  const parId = new Map(data.products.map((p) => [String(p.id), p]));
  const evenements = [];

  for (const ligne of items || []) {
    const produit = parId.get(String(ligne.id));
    if (!produit) continue;
    if (produit.stock === null || produit.stock === undefined) continue;

    const avant = Number(produit.stock) || 0;
    const qte = Math.max(1, parseInt(ligne.qty, 10) || 1);
    // Jamais en dessous de zéro : un stock négatif ne veut rien dire dans une
    // liste d'inventaire et masquerait l'ampleur du problème.
    const apres = Math.max(0, avant - qte);
    if (apres === avant) continue;

    produit.stock = apres;
    if (apres === 0) produit.inStock = false;

    if (apres === 0) evenements.push({ nom: produit.name, restant: 0, type: 'rupture' });
    else if (apres <= seuilBas) evenements.push({ nom: produit.name, restant: apres, type: 'bas' });
  }

  writeProductsFile(data);
  return evenements;
}

async function updateProduct(id, input) {
  if (pool) {
    try {
      const existing = await getProductById(id);
      if (!existing) throw new Error('Product not found');
      const merged = normalizeProductInput(input, existing);
      const sets = ['name = ?', 'description = ?', 'price = ?', 'ribbon = ?', 'collections = ?', 'images = ?'];
      const vals = [merged.name, merged.description, merged.price, merged.ribbon, JSON.stringify(merged.collections), JSON.stringify(merged.images)];
      if (schema.productStock) {
        sets.push('stock = ?', 'in_stock = ?');
        vals.push(merged.stock ?? null, merged.inStock === false ? 0 : 1);
      }
      vals.push(id);
      await pool.query(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, vals);
      return merged;
    } catch (err) {
      console.error('MySQL updateProduct failed, falling back to JSON file', err);
    }
  }

  const data = readProductsFile();
  const idx = data.products.findIndex(p => p.id === id);
  if (idx === -1) throw new Error('Product not found');
  const merged = normalizeProductInput(input, data.products[idx]);
  data.products[idx] = merged;
  writeProductsFile(data);
  return merged;
}

async function deleteProduct(id) {
  if (pool) {
    try {
      await pool.query('DELETE FROM products WHERE id = ?', [id]);
      return true;
    } catch (err) {
      console.error('MySQL deleteProduct failed, falling back to JSON file', err);
    }
  }

  const data = readProductsFile();
  data.products = data.products.filter(p => p.id !== id);
  writeProductsFile(data);
  return true;
}

// 3. Create Order
// Les modes d'expédition qui ne demandent pas d'adresse.
//
// Huit des neuf modes sont postaux ; seul le retrait en boutique ne l'est pas.
// On raisonne sur l'identifiant, et non sur un drapeau ajouté aux options :
// ses réglages sont déjà enregistrés sur le serveur et ne le porteraient pas,
// si bien qu'un retrait en boutique se mettrait soudain à réclamer une adresse.
// Le poids du panier, et la limite que la Poste impose vraiment.
//
// Ses quatre tarifs colis portent la mention « Jusqu'à 2 kg ». Comme pour
// « Bon cadeau uniquement », la mention était affichée et jamais vérifiée : un
// panier de trois kilos partait au tarif de deux, et le surcoût était pour elle.
//
// La règle ne mord que sur ce qu'on connaît. Tant qu'un seul article du panier
// n'a pas de poids — et aujourd'hui aucun n'en a — le total est déclaré inconnu
// et rien n'est bloqué : on ne refuse pas une commande sur une somme incomplète.
// Le jour où son export remplit les 178 champs, la limite s'applique d'elle-même.
const LIMITE_COLIS_G = 2000;
const MODES_LIMITES_2KG = new Set(['economy', 'economysig', 'priority', 'prioritysig']);

function poidsPanier(lignes) {
  const articles = Array.isArray(lignes) ? lignes : [];
  let grammes = 0;
  let connu = articles.length > 0;
  for (const a of articles) {
    const g = Number(a && a.produit ? a.produit.poids : a && a.poids);
    const qte = Math.max(1, parseInt((a && a.qty) || 1, 10) || 1);
    if (!Number.isFinite(g) || g <= 0) { connu = false; continue; }
    grammes += g * qte;
  }
  return { connu, grammes: connu ? grammes : null };
}

// Rend `true` quand on ne sait pas : l'ignorance n'est pas un motif de refus.
function modeSupporteLePoids(shippingId, lignes) {
  if (!MODES_LIMITES_2KG.has(String(shippingId || ''))) return true;
  const { connu, grammes } = poidsPanier(lignes);
  if (!connu) return true;
  return grammes <= LIMITE_COLIS_G;
}

// Les modes d'expédition qu'elle réserve aux bons cadeaux.
//
// Ses quatre tarifs Courrier portent la mention « Bon cadeau uniquement » — un
// bon tient dans une enveloppe, un colis de savons non. Mais la mention n'était
// qu'un texte affiché : rien ne l'appliquait. On pouvait commander le kit DIY à
// CHF 49.50 et choisir Courrier B à CHF 1.00, alors que l'envoi lui coûte de
// CHF 11 à CHF 15. La différence sortait de sa poche, à chaque commande.
//
// On raisonne sur les identifiants, comme pour le retrait : ses réglages
// enregistrés ne porteraient pas un drapeau ajouté aujourd'hui.
const MODES_BON_CADEAU = new Set(['courrierB', 'courrierBsig', 'courrierA', 'courrierAsig']);

// Un bon cadeau n'est pas un objet : rien à peser, rien à emballer.
// Le catalogue n'en contient aucun pour l'instant, donc ces quatre modes ne
// s'offrent à personne — ce qui est exactement ce qu'il faut. Le jour où elle
// en crée un, la règle le reconnaît sans qu'on touche au code.
function estBonCadeau(produit) {
  if (!produit) return false;
  if (produit.estBonCadeau === true) return true;
  const texte = `${produit.name || ''} ${(produit.collections || []).join(' ')}`;
  return /bon\s+cadeau|carte\s+cadeau|gift\s+(card|voucher)/i.test(texte);
}

// Un mode réservé n'est proposé que si TOUTE la commande tient dans l'enveloppe.
// Un seul savon glissé parmi les bons suffit à en faire un colis.
function modeAutorise(shippingId, produits) {
  if (!MODES_BON_CADEAU.has(String(shippingId || ''))) return true;
  const lignes = Array.isArray(produits) ? produits : [];
  return lignes.length > 0 && lignes.every(estBonCadeau);
}

const MODES_SANS_ADRESSE = new Set(['pickup']);

function exigeAdresse(shippingId) {
  return !MODES_SANS_ADRESSE.has(String(shippingId || ''));
}

async function createOrder(order) {
  const orderId = 'order_' + Math.random().toString(36).substr(2, 9);
  const newOrder = {
    id: orderId,
    customer_name: order.name,
    customer_email: order.email,
    total: order.total,
    items: order.items,
    // Ce qu'elle doit expédier, et ce que le client a payé pour cela. Sans ce
    // champ, une commande à retirer en boutique et un envoi Priority se
    // ressemblent dans la liste.
    shipping: order.shipping || null,
    // L'adresse de livraison. Elle manquait : le site proposait neuf modes
    // d'expédition, dont huit postaux, sans jamais demander où envoyer le colis.
    // Elle devait écrire à chaque cliente pour la lui réclamer.
    //
    // Normalisée ici plutôt qu'au vol : la fiche de commande, l'e-mail
    // d'expédition et l'export CSV lisent tous les mêmes clés.
    address: order.address
      ? {
          line1: String(order.address.line1 || '').trim(),
          line2: String(order.address.line2 || '').trim(),
          zip: String(order.address.zip || '').trim(),
          city: String(order.address.city || '').trim(),
          country: String(order.address.country || 'CH').trim(),
        }
      : null,
    // Ce qui accompagne un cadeau. Le message est borne a 200 caracteres ici
    // aussi, et pas seulement dans le formulaire : le navigateur ne decide pas
    // de ce qui sera imprime.
    cadeau: order.cadeau
      ? {
          destinataire: String(order.cadeau.destinataire || '').trim(),
          email: String(order.cadeau.email || '').trim(),
          message: String(order.cadeau.message || '').trim().slice(0, 200),
          date: String(order.cadeau.date || '').trim(),
          emballage: !!order.cadeau.emballage,
        }
      : null,
    status: 'Pending',
    created_at: new Date().toISOString()
  };

  if (pool) {
    try {
      await pool.query(
        'INSERT INTO orders (id, customer_name, customer_email, total, items, status) VALUES (?, ?, ?, ?, ?, ?)',
        [
          newOrder.id,
          newOrder.customer_name,
          newOrder.customer_email,
          newOrder.total,
          JSON.stringify(newOrder.items),
          newOrder.status
        ]
      );
      return newOrder;
    } catch (err) {
      console.error('MySQL createOrder failed, falling back to JSON file', err);
    }
  }

  // Local JSON write
  const data = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  data.push(newOrder);
  ecrireJson(ORDERS_FILE, data);
  return newOrder;
}

// 4. Create Booking
async function createBooking(booking) {
  const bookingId = 'booking_' + Math.random().toString(36).substr(2, 9);
  const newBooking = {
    id: bookingId,
    workshop_id: booking.workshop_id,
    slot_date: booking.date,
    customer_name: booking.name,
    customer_email: booking.email,
    seats: booking.seats || 1,
    status: 'Confirmed',
    created_at: new Date().toISOString()
  };

  if (pool) {
    try {
      await pool.query(
        'INSERT INTO bookings (id, workshop_id, slot_date, customer_name, customer_email, seats, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          newBooking.id,
          newBooking.workshop_id,
          newBooking.slot_date,
          newBooking.customer_name,
          newBooking.customer_email,
          newBooking.seats,
          newBooking.status
        ]
      );
      return newBooking;
    } catch (err) {
      console.error('MySQL createBooking failed, falling back to JSON file', err);
    }
  }

  const data = JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8'));
  data.push(newBooking);
  ecrireJson(BOOKINGS_FILE, data);
  return newBooking;
}

// 5. Create Contact Query
async function createContact(contact) {
  const newContact = {
    name: contact.name,
    email: contact.email,
    subject: contact.subject,
    message: contact.message,
    created_at: new Date().toISOString()
  };

  if (pool) {
    try {
      await pool.query(
        'INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)',
        [
          newContact.name,
          newContact.email,
          newContact.subject,
          newContact.message
        ]
      );
      return newContact;
    } catch (err) {
      console.error('MySQL createContact failed, falling back to JSON file', err);
    }
  }

  const data = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8'));
  data.push(newContact);
  ecrireJson(CONTACTS_FILE, data);
  return newContact;
}

// 5b. Create Newsletter Subscriber (idempotent — ignores duplicate emails)
async function createNewsletterSubscriber(email) {
  const normalized = String(email).toLowerCase().trim();
  const entry = { email: normalized, created_at: new Date().toISOString() };

  if (pool) {
    try {
      await pool.query('INSERT IGNORE INTO newsletter (email) VALUES (?)', [normalized]);
      return entry;
    } catch (err) {
      console.error('MySQL createNewsletterSubscriber failed, falling back to JSON file', err);
    }
  }

  const data = JSON.parse(fs.readFileSync(NEWSLETTER_FILE, 'utf8'));
  if (!data.some(s => s.email === normalized)) {
    data.push(entry);
    ecrireJson(NEWSLETTER_FILE, data);
  }
  return entry;
}

// ==============================================
// Admin operations
// ==============================================

// --- Workshops ---
async function getWorkshops() {
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM workshops ORDER BY created_at DESC');
      return rows;
    } catch (err) {
      console.error('MySQL getWorkshops failed, falling back to JSON file', err);
    }
  }
  return JSON.parse(fs.readFileSync(WORKSHOPS_FILE, 'utf8'));
}

async function createWorkshop(workshopData) {
  const workshop = {
    id: 'ws_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    title: workshopData.title,
    description: workshopData.description,
    price: workshopData.price,
    duration: workshopData.duration,
    image_url: workshopData.image_url || '/workshop_ingredients.png',
    created_at: new Date().toISOString()
  };

  if (pool) {
    try {
      await pool.query(
        'INSERT INTO workshops (id, title, description, price, duration, image_url) VALUES (?, ?, ?, ?, ?, ?)',
        [workshop.id, workshop.title, workshop.description, workshop.price, workshop.duration, workshop.image_url]
      );
      return workshop;
    } catch (err) {
      console.error('MySQL createWorkshop failed, falling back to JSON file', err);
    }
  }

  const workshops = JSON.parse(fs.readFileSync(WORKSHOPS_FILE, 'utf8'));
  workshops.push(workshop);
  ecrireJson(WORKSHOPS_FILE, workshops);
  return workshop;
}

async function updateWorkshop(id, workshopData) {
  if (pool) {
    try {
      await pool.query(
        'UPDATE workshops SET title = ?, description = ?, price = ?, duration = ?, image_url = ? WHERE id = ?',
        [workshopData.title, workshopData.description, workshopData.price, workshopData.duration, workshopData.image_url, id]
      );
      return { id, ...workshopData };
    } catch (err) {
      console.error('MySQL updateWorkshop failed, falling back to JSON file', err);
    }
  }

  const workshops = JSON.parse(fs.readFileSync(WORKSHOPS_FILE, 'utf8'));
  const idx = workshops.findIndex(w => w.id === id);
  if (idx !== -1) {
    workshops[idx] = { ...workshops[idx], ...workshopData };
    ecrireJson(WORKSHOPS_FILE, workshops);
    return workshops[idx];
  }
  throw new Error('Workshop not found');
}

async function deleteWorkshop(id) {
  if (pool) {
    try {
      await pool.query('DELETE FROM workshops WHERE id = ?', [id]);
      return true;
    } catch (err) {
      console.error('MySQL deleteWorkshop failed, falling back to JSON file', err);
    }
  }

  let workshops = JSON.parse(fs.readFileSync(WORKSHOPS_FILE, 'utf8'));
  workshops = workshops.filter(w => w.id !== id);
  ecrireJson(WORKSHOPS_FILE, workshops);
  return true;
}

// 6. Get Admin
async function getAdmin(username) {
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);
      if (rows.length > 0) return rows[0];
      return null;
    } catch (err) {
      console.error('MySQL getAdmin failed, falling back to JSON file', err);
    }
  }
  
  const adminData = JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));
  if (adminData.username === username) return adminData;
  return null;
}

// 7. Update Admin Password
async function updateAdminPassword(username, newPassword) {
  const salt = generateSalt();
  const hash = hashPassword(newPassword, salt);
  
  if (pool) {
    try {
      await pool.query(
        'UPDATE admins SET password_hash = ?, salt = ? WHERE username = ?',
        [hash, salt, username]
      );
      return true;
    } catch (err) {
      console.error('MySQL updateAdminPassword failed, falling back to JSON file', err);
    }
  }

  const adminData = { username, password_hash: hash, salt };
  ecrireJson(ADMIN_FILE, adminData);
  return true;
}

// 8. Get All Orders
async function getOrders() {
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
      return rows.map(mapOrderRow);
    } catch (err) {
      console.error('MySQL getOrders failed, falling back to JSON file', err);
    }
  }

  const data = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  // Sort descending by date
  return data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// 8b. Get Order by ID
async function getOrderById(orderId) {
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
      if (!rows.length) return null;
      return mapOrderRow(rows[0]);
    } catch (err) {
      console.error('MySQL getOrderById failed, falling back to JSON file', err);
    }
  }

  const data = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  return data.find(o => o.id === orderId) || null;
}

// 9. Update Order Status
// The admin dashboard renders an order's status by exact string match against
// 'Paid' / 'Shipped' / 'ReadyForPickup' / 'Pending'. Both payment paths wrote
// 'paid' in lower case, so a genuinely paid SumUp order missed every branch and
// displayed as "En attente" — the shop owner sees a real payment reported as
// unpaid, and concludes the payment provider is broken. Normalising here fixes
// every writer at once instead of at each call site, and also repairs rows that
// were already stored in the wrong case the next time they are updated.
const ORDER_STATUSES = ['Pending', 'Paid', 'ReadyForPickup', 'Shipped', 'Cancelled', 'Refunded'];

function canonicalOrderStatus(status) {
  if (typeof status !== 'string') return status;
  const trimmed = status.trim();
  return ORDER_STATUSES.find(s => s.toLowerCase() === trimmed.toLowerCase()) || trimmed;
}

// Écrit quelques champs sur une commande sans toucher au reste — le numéro de
// facture, par exemple. En mode fichier on relit puis on réécrit : deux
// confirmations simultanées de la même commande sont improbables ici, et la
// garde d'idempotence en amont les empêche de toute façon d'écrire deux fois.
async function updateOrderFields(orderId, fields) {
  if (pool) {
    const colonnes = Object.keys(fields);
    if (colonnes.length === 0) return true;
    try {
      await pool.query(
        `UPDATE orders SET ${colonnes.map((c) => `\`${c}\` = ?`).join(', ')} WHERE id = ?`,
        [...colonnes.map((c) => fields[c]), orderId]
      );
      return true;
    } catch (err) {
      console.error('MySQL updateOrderFields failed, falling back to JSON file', err);
    }
  }
  const data = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  const order = data.find((o) => o.id === orderId);
  if (!order) return false;
  Object.assign(order, fields);
  ecrireJson(ORDERS_FILE, data);
  return true;
}

async function updateOrderStatus(orderId, status) {
  status = canonicalOrderStatus(status);
  if (pool) {
    try {
      await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
      return true;
    } catch (err) {
      console.error('MySQL updateOrderStatus failed, falling back to JSON file', err);
    }
  }

  const data = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  const order = data.find(o => o.id === orderId);
  if (order) {
    order.status = status;
    ecrireJson(ORDERS_FILE, data);
    return true;
  }
  return false;
}

// 10. Get All Bookings
async function getBookings() {
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM bookings ORDER BY created_at DESC');
      return rows;
    } catch (err) {
      console.error('MySQL getBookings failed, falling back to JSON file', err);
    }
  }

  const data = JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8'));
  return data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// 11. Get Unified Client List
async function getClients() {
  let ordersList = [];
  let bookingsList = [];

  if (pool) {
    try {
      const [oRows] = await pool.query('SELECT customer_name, customer_email, total FROM orders');
      ordersList = oRows.map(r => ({
        name: r.customer_name,
        email: r.customer_email,
        total: parseFloat(r.total)
      }));
      const [bRows] = await pool.query('SELECT customer_name, customer_email FROM bookings');
      bookingsList = bRows.map(r => ({
        name: r.customer_name,
        email: r.customer_email
      }));
    } catch (err) {
      console.error('MySQL getClients queries failed, fallback to JSON files', err);
      pool = null;
    }
  }

  if (!pool) {
    ordersList = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')).map(r => ({
      name: r.customer_name,
      email: r.customer_email,
      total: parseFloat(r.total)
    }));
    bookingsList = JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8')).map(r => ({
      name: r.customer_name,
      email: r.customer_email
    }));
  }

  // Aggregate in JS (guarantees identical logic everywhere)
  const clientMap = new Map();

  // Process orders
  ordersList.forEach(order => {
    const emailKey = order.email.toLowerCase().trim();
    if (clientMap.has(emailKey)) {
      const client = clientMap.get(emailKey);
      client.total_spent += order.total;
      client.order_count += 1;
      // Use the name if it is longer or capitalized better
      if (order.name && order.name.length > client.name.length) {
        client.name = order.name;
      }
    } else {
      clientMap.set(emailKey, {
        name: order.name,
        email: order.email,
        total_spent: order.total,
        order_count: 1,
        booking_count: 0
      });
    }
  });

  // Process bookings
  bookingsList.forEach(booking => {
    const emailKey = booking.email.toLowerCase().trim();
    if (clientMap.has(emailKey)) {
      const client = clientMap.get(emailKey);
      client.booking_count += 1;
      if (booking.name && booking.name.length > client.name.length) {
        client.name = booking.name;
      }
    } else {
      clientMap.set(emailKey, {
        name: booking.name,
        email: booking.email,
        total_spent: 0,
        order_count: 0,
        booking_count: 1
      });
    }
  });

  return Array.from(clientMap.values());
}

// ------------- Settings (admin-managed runtime config) -------------
// Réserve le prochain numéro de facture et l'incrémente aussitôt.
//
// Le compteur vit dans les réglages plutôt que d'être déduit du nombre de
// commandes : une commande supprimée ou une facture annulée ne doit jamais
// permettre de réattribuer un numéro déjà émis. Une numérotation qui recule est
// un problème comptable, pas un détail.
function nextInvoiceNumber() {
  const settings = getShopSettings();
  const numero = Number(settings.invoice.nextNumber) || 1;
  const annee = new Date().getFullYear();
  updateShopSettings({ invoice: { ...settings.invoice, nextNumber: numero + 1 } });
  return `${settings.invoice.prefix || 'SY'}-${annee}-${String(numero).padStart(4, '0')}`;
}

// Journal articles. She asked for "un accès administrateur me permettant de
// rédiger, modifier, annuler et publier moi-même mes articles" — so a draft is a
// first-class state, not a missing article: she can write over several sittings
// and publish when ready.
//
// One language per article rather than three. Writing every post three times is
// not sustainable for one person, and a half-translated post reads worse than an
// honestly monolingual one. The article carries its language so the site can say
// which it is.
function readArticles() {
  try {
    const parsed = JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeArticles(list) {
  ecrireJson(ARTICLES_FILE, list);
}

// A readable, stable URL. Built from the title once, at creation: regenerating
// it on every edit would break links she has already shared the moment she fixes
// a typo in the title.
function slugify(str) {
  return String(str || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'article';
}

function getArticles({ publishedOnly = false } = {}) {
  const list = readArticles();
  const filtered = publishedOnly ? list.filter((a) => a.published) : list;
  return filtered.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function getArticleBySlug(slug) {
  return readArticles().find((a) => a.slug === slug) || null;
}

function createArticle(input) {
  const list = readArticles();
  const base = slugify(input.title);
  let slug = base;
  let n = 2;
  while (list.some((a) => a.slug === slug)) slug = `${base}-${n++}`;
  const article = {
    id: 'art_' + Math.random().toString(36).slice(2, 11),
    slug,
    language: input.language || 'fr',
    title: input.title || '',
    excerpt: input.excerpt || '',
    body: input.body || '',
    image_url: input.image_url || '',
    published: Boolean(input.published),
    date: input.date || new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
  };
  list.push(article);
  writeArticles(list);
  return article;
}

function updateArticle(id, patch) {
  const list = readArticles();
  const i = list.findIndex((a) => a.id === id);
  if (i === -1) return null;
  // slug, id et created_at ne bougent pas : les liens déjà partagés doivent survivre.
  const { slug, id: _ignored, created_at, ...modifiable } = patch || {};
  list[i] = { ...list[i], ...modifiable };
  writeArticles(list);
  return list[i];
}

function deleteArticle(id) {
  const list = readArticles();
  const next = list.filter((a) => a.id !== id);
  if (next.length === list.length) return false;
  writeArticles(next);
  return true;
}

// Content overrides — what she has rewritten from the admin, keyed by language
// and then by the same dot-paths the site already uses ({ fr: { 'hero.titleLine1': '…' } }).
//
// This file is a *layer*, never a replacement: translations.js stays the source
// of truth in code and this sits in front of it. An empty, missing or corrupt
// file therefore has to leave the site exactly as it was — which is why every
// read here swallows its error and returns {} rather than throwing. There is no
// state in which the text disappears.
// Shop settings she controls herself: opening hours, an absence notice, and
// maintenance mode. They live in settings.json alongside the SumUp and inbox
// config, so they inherit the same protection — server/data/ is excluded from
// deployment, and nothing she saves is overwritten by our next release.
//
// The defaults reproduce what the site showed when these were hard-coded, so
// turning the feature on changes nothing until she edits something.
const SHOP_DEFAULTS = {
  hours: [
    { day: 'lundi',    closed: true,  hours: '' },
    { day: 'mardi',    closed: false, hours: '11:00–13:00 / 14:00–18:30' },
    { day: 'mercredi', closed: false, hours: '11:00–13:00 / 14:00–18:30' },
    { day: 'jeudi',    closed: false, hours: '11:00–13:00 / 14:00–18:30' },
    { day: 'vendredi', closed: false, hours: '11:00–13:00 / 14:00–18:30' },
    { day: 'samedi',   closed: false, hours: '11:00–16:30' },
  ],
  absence: { active: false, fr: '', en: '', de: '' },
  // Ses tarifs, repris tels quels de son document du 23 juin. Ils vivent dans
  // les réglages plutôt que dans le code : La Poste révise ses prix, et elle ne
  // devrait pas avoir besoin de nous pour suivre.
  //
  // « freeFrom » ne s'applique qu'à l'option marquée « economy » : offrir un
  // envoi Priority sur un panier à 150 peut effacer la marge, alors que
  // l'Economy est plafonné. Décision prise pour elle, réversible ici même.
  // Facturation. Le statut TVA de So You n'a jamais été communiqué : par défaut
  // la facture n'affiche aucune TVA, ce qui est le cas d'une entreprise non
  // assujettie — la situation de la plupart des petites structures suisses sous
  // le seuil de CHF 100'000 de chiffre d'affaires. Si elle est assujettie, il
  // suffit de renseigner le numéro et le taux ici : imprimer « TVA 0.00 » en
  // étant assujettie serait faux, ne rien imprimer ne l'est pas.
  // Où l'avertir, et à partir de quel niveau. Sans adresse renseignée, aucune
  // alerte n'est envoyée : mieux vaut ne rien envoyer que d'écrire dans le vide.
  // L'emballage cadeau. Son prix vit ici, pas dans le navigateur : c'est le
  // serveur qui le facture, sinon on reafficherait un total superieur au
  // montant reellement debite. Desactive tant qu'elle ne l'a pas ouvert.
  giftWrap: { enabled: false, price: 5 },
  alerts: { email: '', lowStockThreshold: 3, onLowStock: true, onNewOrder: true },
  invoice: {
    enabled: true,
    company: 'So You Cosmetics — Boutique Soap Opera',
    address: '3 av. Pictet-De-Rochemont, 1207 Genève',
    email: 'contact@soyoucosmetics.com',
    vatNumber: '',
    vatRate: 0,
    prefix: 'SY',
    nextNumber: 1,
  },
  shipping: {
    freeFrom: 150,
    options: [
      { id: 'pickup',      label: 'Retrait à la boutique',                          price: 0,     note: 'Gratuit' },
      { id: 'courrierB',   label: 'Courrier B (2–3 jours ouvrables)',               price: 1.00,  note: 'Bon cadeau uniquement' },
      { id: 'courrierBsig',label: 'Courrier B avec signature',                      price: 4.70,  note: 'Bon cadeau uniquement' },
      { id: 'courrierA',   label: 'Courrier A (distribution prioritaire)',          price: 1.20,  note: 'Bon cadeau uniquement' },
      { id: 'courrierAsig',label: 'Courrier A avec signature',                      price: 4.90,  note: 'Bon cadeau uniquement' },
      { id: 'economy',     label: 'Colis Economy (3–5 jours ouvrables)',            price: 11.00, note: 'Jusqu’à 2 kg', economy: true },
      { id: 'economysig',  label: 'Colis Economy avec signature',                   price: 13.00, note: 'Jusqu’à 2 kg' },
      { id: 'priority',    label: 'Colis Priority (2–3 jours ouvrables)',           price: 13.00, note: 'Jusqu’à 2 kg' },
      { id: 'prioritysig', label: 'Colis Priority avec signature',                  price: 15.00, note: 'Jusqu’à 2 kg' },
    ],
  },
  maintenance: { active: false, fr: '', en: '', de: '' },
};

function getShopSettings() {
  const saved = readSettings().shop;
  if (!saved || typeof saved !== 'object') return SHOP_DEFAULTS;
  return {
    hours: Array.isArray(saved.hours) && saved.hours.length ? saved.hours : SHOP_DEFAULTS.hours,
    absence: { ...SHOP_DEFAULTS.absence, ...(saved.absence || {}) },
    maintenance: { ...SHOP_DEFAULTS.maintenance, ...(saved.maintenance || {}) },
    giftWrap: { ...SHOP_DEFAULTS.giftWrap, ...(saved.giftWrap || {}) },
    alerts: { ...SHOP_DEFAULTS.alerts, ...(saved.alerts || {}) },
    invoice: { ...SHOP_DEFAULTS.invoice, ...(saved.invoice || {}) },
    shipping: {
      freeFrom: saved.shipping && saved.shipping.freeFrom !== undefined
        ? saved.shipping.freeFrom : SHOP_DEFAULTS.shipping.freeFrom,
      options: saved.shipping && Array.isArray(saved.shipping.options) && saved.shipping.options.length
        ? saved.shipping.options : SHOP_DEFAULTS.shipping.options,
    },
  };
}

function updateShopSettings(patch) {
  const current = getShopSettings();
  const next = {
    hours: Array.isArray(patch.hours) ? patch.hours : current.hours,
    absence: { ...current.absence, ...(patch.absence || {}) },
    maintenance: { ...current.maintenance, ...(patch.maintenance || {}) },
    giftWrap: { ...current.giftWrap, ...(patch.giftWrap || {}) },
    alerts: { ...current.alerts, ...(patch.alerts || {}) },
    invoice: { ...current.invoice, ...(patch.invoice || {}) },
    shipping: { ...current.shipping, ...(patch.shipping || {}) },
  };
  writeSettings({ ...readSettings(), shop: next });
  return next;
}

function readContent() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeContent(next) {
  ecrireJson(CONTENT_FILE, next);
}

// Applies a patch of { language: { path: value } }. A value of null or '' drops
// the override, so a field can be returned to its coded default one at a time
// without touching its neighbours — the reversibility the whole design rests on.
function updateContent(patch) {
  const next = { ...readContent() };
  for (const [lang, fields] of Object.entries(patch || {})) {
    if (!fields || typeof fields !== 'object') continue;
    const bucket = { ...(next[lang] || {}) };
    for (const [dotPath, value] of Object.entries(fields)) {
      if (value === null || value === '') delete bucket[dotPath];
      else bucket[dotPath] = value;
    }
    if (Object.keys(bucket).length === 0) delete next[lang];
    else next[lang] = bucket;
  }
  writeContent(next);
  return next;
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) || {};
  } catch (_) {
    return {};
  }
}

function writeSettings(next) {
  ecrireJson(SETTINGS_FILE, next);
}

function getSetting(key) {
  return readSettings()[key];
}

function updateSettings(patch) {
  const current = readSettings();
  const next = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === '') {
      delete next[k];
    } else {
      next[k] = v;
    }
  }
  writeSettings(next);
  return next;
}

// Read SumUp config from admin-saved settings first, fall back to env vars.
function getSumupConfig() {
  const s = readSettings();
  return {
    apiKey: s.SUMUP_API_KEY || process.env.SUMUP_API_KEY || '',
    merchantEmail: s.SUMUP_MERCHANT_EMAIL || process.env.SUMUP_MERCHANT_EMAIL || '',
    webhookSecret: s.SUMUP_WEBHOOK_SECRET || process.env.SUMUP_WEBHOOK_SECRET || ''
  };
}

// Read IMAP (inbox-read) config from admin-saved settings, fall back to env vars.
function getInboxConfig() {
  const s = readSettings();
  return {
    host: s.IMAP_HOST || process.env.IMAP_HOST || 'mail.infomaniak.com',
    port: s.IMAP_PORT || process.env.IMAP_PORT || '993',
    secure: s.IMAP_SECURE !== undefined ? s.IMAP_SECURE : (process.env.IMAP_SECURE !== 'false'),
    user: s.IMAP_USER || process.env.IMAP_USER || process.env.SMTP_USER || '',
    pass: s.IMAP_PASS || process.env.IMAP_PASS || process.env.SMTP_PASS || ''
  };
}

// 9b. Update order fulfillment info (pickup ready / shipped with tracking).
// patch may contain: { type: 'pickup'|'shipped', carrier, tracking_number,
// marked_ready_at, status }. We merge into the order's `fulfillment` field
// and also update top-level status if provided.
async function updateOrderFulfillment(orderId, patch) {
  if (pool) {
    // The `fulfillment` column is created/migrated in initProductionDatabase.
    // Note there is deliberately no JSON-file fallback here: when MySQL is the
    // active store, the orders.json file is not the source of truth, so writing
    // to it would report success while leaving the real order untouched. Better
    // to surface the failure so the admin knows the order was not updated.
    const existing = await getOrderById(orderId);
    if (!existing) return null;
    const merged = { ...(existing.fulfillment || {}), ...patch };
    const status = patch.status || existing.status;
    await pool.query('UPDATE orders SET fulfillment = ?, status = ? WHERE id = ?', [JSON.stringify(merged), status, orderId]);
    return { ...existing, fulfillment: merged, status };
  }

  const data = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  const order = data.find(o => o.id === orderId);
  if (!order) return null;
  order.fulfillment = { ...(order.fulfillment || {}), ...patch };
  if (patch.status) order.status = patch.status;
  ecrireJson(ORDERS_FILE, data);
  return order;
}

module.exports = {
  getProducts,
  importerMetadonnees,
  getProductById,
  createProduct,
  decrementStock,
  updateProduct,
  deleteProduct,
  getSetting,
  updateSettings,
  getArticles,
  getArticleBySlug,
  createArticle,
  updateArticle,
  deleteArticle,
  getShopSettings,
  updateShopSettings,
  nextInvoiceNumber,
  readContent,
  writeContent,
  updateContent,
  getSumupConfig,
  getInboxConfig,
  updateOrderFulfillment,
  createOrder,
  exigeAdresse,
  estBonCadeau,
  modeAutorise,
  poidsPanier,
  modeSupporteLePoids,
  createBooking,
  createContact,
  createNewsletterSubscriber,
  // Admin DB functions
  getAdmin,
  updateAdminPassword,
  createSession,
  getSession,
  deleteSession,
  getOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderFields,
  canonicalOrderStatus,
  getBookings,
  getClients,
  hashPassword,
  getWorkshops,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop
};

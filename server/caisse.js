// Les ventes de la boutique, relevées dans la caisse SumUp.
//
// L'offre marketing promet le « lien SumUp & stock » : que ce qui part au
// comptoir diminue le stock comme ce qui part en ligne, sans ressaisie. Elle
// parlait d'importer le rapport CSV de SumUp ; l'API de SumUp donne la même
// chose sans export à faire — la liste des transactions, et pour chacune les
// articles vendus avec leur quantité. C'est ce qu'on lit ici.
//
// Quatre règles :
//
// 1. RIEN SANS APERÇU. Le relevé montre d'abord ce qu'il ferait ; elle coche,
//    puis applique. Un stock décrémenté à tort se voit le jour où un produit
//    manque en rayon, pas avant.
//
// 2. JAMAIS DEUX FOIS. Chaque transaction appliquée est notée par son code
//    SumUp ; relever deux fois la même semaine ne retire rien de plus.
//
// 3. LES VENTES EN LIGNE SONT ÉCARTÉES. Elles passent aussi par SumUp (type
//    ECOM), mais le site a déjà retiré leur stock au paiement.
//
// 4. LE RAPPROCHEMENT SE FAIT PAR LE NOM, faute de référence dans l'API. Le
//    nom de la caisse est comparé au champ « Nom dans la caisse SumUp » de la
//    fiche, puis au nom de la fiche. Un article non reconnu se rattache une
//    fois dans l'aperçu, et la correspondance est retenue sur la fiche : les
//    relevés suivants le reconnaissent seuls.

const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');
const db = require('./db');

const FICHIER = path.join(__dirname, 'data', 'caisse.json');
const base = () => (process.env.SUMUP_API_BASE || 'https://api.sumup.com').replace(/\/+$/, '');

function lire() {
  try {
    const d = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
    return { traitees: d.traitees || {}, journal: Array.isArray(d.journal) ? d.journal : [], dernierReleve: d.dernierReleve || null };
  } catch (_) {
    return { traitees: {}, journal: [], dernierReleve: null };
  }
}

function ecrire(d) {
  d.journal = d.journal.slice(0, 500);
  const tmp = FICHIER + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, FICHIER);
}

// « Savon Lavande 100 g » et « savon lavande 100g » sont le même article.
function normaliser(nom) {
  return String(nom || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(\d)\s+(g|ml|kg|l|cl)\b/g, '$1$2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

let codeEnCache = null;
async function client() {
  const { apiKey } = db.getSumupConfig();
  if (!apiKey) throw new Error('SumUp n’est pas configuré (clé API).');
  const headers = { Authorization: `Bearer ${apiKey}` };
  if (!codeEnCache) {
    const { data } = await axios.get(`${base()}/v0.1/me`, { headers, timeout: 15000 });
    codeEnCache = data && data.merchant_profile && data.merchant_profile.merchant_code;
    if (!codeEnCache) throw new Error('Code marchand SumUp introuvable.');
  }
  return { headers, code: codeEnCache };
}

// Les transactions depuis une date, page après page, en suivant le lien
// « next » que SumUp renvoie plutôt qu'en le reconstruisant.
async function historique(depuis) {
  const { headers, code } = await client();
  const url = `${base()}/v2.1/merchants/${encodeURIComponent(code)}/transactions/history`;
  let params = new URLSearchParams({ oldest_time: depuis, limit: '100', order: 'ascending' }).toString();
  const items = [];
  for (let page = 0; page < 30 && params; page++) {
    const { data } = await axios.get(`${url}?${params}`, { headers, timeout: 20000 });
    items.push(...((data && data.items) || []));
    const suite = ((data && data.links) || []).find((l) => l.rel === 'next');
    params = suite && suite.href ? String(suite.href).replace(/^\?/, '') : '';
  }
  return { items, headers, code };
}

async function detail(headers, code, id) {
  const { data } = await axios.get(`${base()}/v2.1/merchants/${encodeURIComponent(code)}/transactions`, {
    params: { id }, headers, timeout: 15000,
  });
  return data || {};
}

// La référence d'un produit dans SumUp (le « SKU » de son import).
//
// Tirée de l'identifiant de la fiche, qui ne change jamais — pas du nom, qui
// change. Un format (15 ml, 30 ml…) ajoute son propre suffixe : dans la caisse,
// chaque format est un article distinct, même si le site les décompte d'un
// seul stock. La même règle est reprise dans l'administration
// (AdminDashboard.jsx, skuProduit) pour l'afficher sur la fiche.
function sku(produit, variante) {
  const court = String(produit.id || '').replace(/^product_/, '').replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
  const suffixe = variante ? '-' + String(variante.id || variante.libelle || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase() : '';
  return `SY-${court}${suffixe}`;
}

// Le nom sous lequel le produit apparaît dans la caisse.
const nomCaisse = (p) => p.sumupNom || p.name;

async function index() {
  const produits = await db.getProduitsTous();
  const parNom = new Map();
  const poser = (nom, p) => { const k = normaliser(nom); if (k && !parNom.has(k)) parNom.set(k, p); };
  // Le nom de caisse d'abord : il a été choisi exprès, il l'emporte.
  for (const p of produits) if (p.sumupNom) poser(p.sumupNom, p);
  for (const p of produits) poser(p.name, p);
  // Chaque format sous les deux formes que la caisse peut lui donner :
  // « Nom 30 ml » et « Nom - 30 ml » se normalisent de la même façon.
  for (const p of produits) for (const v of p.variantes || []) poser(`${nomCaisse(p)} ${v.libelle || ''}`, p);
  return { produits, parNom };
}

// Un nom de la caisse, rapproché d'une fiche : exact d'abord, puis le plus long
// nom de fiche par lequel il commence (« Huile d'argan bio - 50 ml » quand la
// fiche s'appelle « Huile d'argan bio »).
function trouver(parNom, nom) {
  const k = normaliser(nom);
  if (parNom.has(k)) return parNom.get(k);
  let meilleur = null;
  let longueur = 0;
  for (const [cle, p] of parNom) {
    if (cle.length > longueur && cle.length >= 6 && k.startsWith(cle + ' ')) { meilleur = p; longueur = cle.length; }
  }
  return meilleur;
}

function champCsv(v) {
  const t = String(v == null ? '' : v);
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

// Le catalogue au format d'import de SumUp (Articles → Importer, dans le
// tableau de bord SumUp) : en-têtes anglais, virgule, une ligne par produit,
// et pour un produit à formats, une ligne vide de prix suivie d'une ligne par
// format — c'est ainsi que SumUp décrit les variantes dans son modèle.
//
// « Track inventory? » est à « No » partout, et c'est voulu : le stock vit sur
// le site, qui le diminue pour les ventes en ligne ET pour celles de la caisse
// (voir apercu/appliquer). Un second stock tenu par SumUp, que les ventes en
// ligne ne toucheraient pas, divergerait dès la première commande.
//
// Les fiches « en attente » sont écartées par défaut : en octobre 2026, 103 des
// 190 fiches l'étaient, pour la plupart d'anciennes fiches absorbées par une
// fiche à formats. Les importer aurait ajouté à la caisse une centaine
// d'articles qui ne se vendent pas, dont des doublons des formats.
async function csvSumup({ avecEnAttente = false } = {}) {
  const produits = (await db.getProduitsTous())
    .filter((p) => avecEnAttente || p.enLigne !== false)
    .filter((p) => Number(p.price) > 0 || (p.variantes || []).length);
  const reglages = db.getShopSettings();
  const tva = Number((reglages.invoice || {}).vatRate) || 0;
  const seo = require('./seo');
  const base = (process.env.PUBLIC_BASE_URL || 'https://soyoucosmetics.com').replace(/\/+$/, '');
  const entetes = ['Item name', 'Variations', 'Price', 'Tax rate (%)', 'Track inventory?', 'SKU', 'Category', 'Description', 'Image 1'];
  const lignes = [];
  const prix = (n) => Number(n || 0).toFixed(2);
  for (const p of produits.slice().sort((a, b) => String(nomCaisse(a)).localeCompare(String(nomCaisse(b)), 'fr'))) {
    const rubrique = (p.collections || []).find((c) => c !== 'Coup de cœur') || '';
    // Le résumé HTML laisse une espace devant la virgule là où une balise fermait.
    const description = (seo.resumerTexte(p.description || '', 300) || '').replace(/\s+([,.])/g, '$1');
    const image = (p.images || [])[0] ? seo.absolutiser(p.images[0], base) : '';
    const variantes = p.variantes || [];
    if (!variantes.length) {
      lignes.push([nomCaisse(p), '', prix(p.price), tva, 'No', sku(p), rubrique, description, image]);
    } else {
      lignes.push([nomCaisse(p), '', '', '', '', '', '', '', '']);
      for (const v of variantes) lignes.push(['', v.libelle || v.id, prix(v.prix), tva, 'No', sku(p, v), rubrique, description, image]);
    }
  }
  return [entetes, ...lignes].map((l) => l.map(champCsv).join(',')).join('\r\n') + '\r\n';
}

// Ce que le relevé ferait, sans rien toucher.
async function apercu({ depuis }) {
  const { items, headers, code } = await historique(depuis);
  const etat = lire();
  const { produits, parNom } = await index();

  const enBoutique = items.filter((t) =>
    String(t.type || 'PAYMENT').toUpperCase() === 'PAYMENT'
    && String(t.payment_type || '').toUpperCase() !== 'ECOM'
    && ['SUCCESSFUL', 'REFUNDED'].includes(String(t.status || '').toUpperCase()));

  const ventes = [];
  for (const t of enBoutique) {
    const codeTx = t.transaction_code || t.id;
    const deja = etat.traitees[codeTx] ? etat.traitees[codeTx].etat : null;
    const statut = String(t.status).toUpperCase();
    let action;
    if (statut === 'SUCCESSFUL') action = deja ? 'deja' : 'deduire';
    else action = deja === 'vendu' ? 'restocker' : deja ? 'deja' : 'rien';

    // Le détail n'est demandé que s'il sert : une vente déjà traitée n'a plus
    // besoin de ses articles.
    let lignes = [];
    if (action === 'deduire' || action === 'restocker') {
      const d = await detail(headers, code, t.id);
      lignes = (d.products || []).map((a) => {
        const p = trouver(parNom, a.name);
        return { nom: a.name, qte: Math.max(1, Math.round(Number(a.quantity) || 1)), produitId: p ? p.id : null, produitNom: p ? p.name : null };
      });
    }
    ventes.push({
      code: codeTx, id: t.id, date: t.timestamp, montant: Number(t.amount) || 0,
      moyen: t.payment_type, statut, action, lignes,
      remboursePartiel: statut === 'SUCCESSFUL' && Number(t.refunded_amount) > 0,
    });
  }

  const nonReconnus = [...new Set(ventes.flatMap((v) => v.lignes.filter((l) => !l.produitId).map((l) => l.nom)))];
  return {
    depuis, ventes, nonReconnus,
    produits: produits.map((p) => ({ id: p.id, nom: p.name })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    dernierReleve: etat.dernierReleve,
  };
}

// Applique les ventes cochées. Les correspondances choisies dans l'aperçu
// (« Savon lav. » → telle fiche) sont d'abord retenues sur les fiches.
async function appliquer({ depuis, codes, correspondances = {} }) {
  for (const [nomCaisse, produitId] of Object.entries(correspondances)) {
    if (produitId) await db.updateProduct(produitId, { sumupNom: String(nomCaisse).slice(0, 120) });
  }

  const vue = await apercu({ depuis });
  const voulues = new Set(codes || []);
  const etat = lire();
  const seuil = Number((db.getShopSettings().alerts || {}).lowStockThreshold) || 3;
  const evenements = [];
  let appliquees = 0;

  for (const v of vue.ventes) {
    if (!voulues.has(v.code) || !['deduire', 'restocker'].includes(v.action)) continue;
    const lignes = v.lignes.filter((l) => l.produitId).map((l) => ({ id: l.produitId, qty: l.qte }));
    const ignorees = v.lignes.filter((l) => !l.produitId).map((l) => l.nom);
    if (v.action === 'deduire') evenements.push(...db.decrementStock(lignes, seuil));
    else db.incrementStock(lignes);
    etat.traitees[v.code] = { etat: v.action === 'deduire' ? 'vendu' : 'rembourse', date: v.date, quand: new Date().toISOString() };
    etat.journal.unshift({
      quand: new Date().toISOString(), code: v.code, date: v.date, montant: v.montant,
      action: v.action === 'deduire' ? 'Vente : stock diminué' : 'Remboursement : stock remis',
      lignes: v.lignes.filter((l) => l.produitId).map((l) => `${l.qte} × ${l.produitNom}`),
      ignorees,
    });
    appliquees += 1;
  }
  etat.dernierReleve = new Date().toISOString();
  ecrire(etat);
  return { appliquees, evenements, seuil };
}

function journal() {
  const d = lire();
  return { journal: d.journal.slice(0, 100), dernierReleve: d.dernierReleve };
}

module.exports = { apercu, appliquer, journal, normaliser, sku, csvSumup, index, trouver };

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('./db');
const emailService = require('./email');
const imapService = require('./imap');

// Directory for admin-uploaded product images (served at /uploads by index.js).
const { UPLOADS_DIR, ensureUploadsDir } = require('./uploads');

// Compare two strings in constant time; tolerates length mismatch
function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

// Verify the SumUp webhook signature header against HMAC-SHA256(rawBody, secret).
// SumUp sends the header as either `x-payload-signature` or `x-sumup-signature`
// (depending on product/version), sometimes prefixed with "sha256=". If
// SUMUP_WEBHOOK_SECRET is unset we skip verification (development mode).
// The webhook is subscribed per-checkout, via return_url — SumUp has no
// dashboard where an endpoint is registered once. Everything downstream depends
// on this URL being correct and publicly reachable.
// Overridable so the payment path can be exercised end to end against a stub.
// A real payment cannot be driven from a test — a card has to be entered — so
// without this the happy path could only ever be verified in production, by
// spending money. Defaults to the real API; production sets nothing.
function sumupApiBase() {
  return (process.env.SUMUP_API_BASE || 'https://api.sumup.com').replace(/\/+$/, '');
}

function publicBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || 'https://soyoucosmetics.com').replace(/\/+$/, '');
}

// Ask SumUp directly whether a checkout was really paid, and for how much.
// SumUp's own guidance is that an application must always confirm an event by
// calling their API rather than trusting the delivered payload: the webhook is
// an unauthenticated public endpoint, so its body proves nothing on its own.
// Looking the checkout up by our order id avoids having to store SumUp's id.
//
// Returns { paid, amount, currency } or null when the answer is unknown — the
// caller must treat null as "do not confirm", never as "assume paid".
async function fetchCheckoutFromSumup(orderId) {
  const { apiKey } = db.getSumupConfig();
  if (!apiKey) return null;
  try {
    const axios = require('axios');
    const { data } = await axios.get(`${sumupApiBase()}/v0.1/checkouts`, {
      params: { checkout_reference: orderId },
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 10000
    });
    const list = Array.isArray(data) ? data : [data];
    // A reference can carry more than one attempt (a failed card, then a
    // successful retry). Any PAID attempt means the order is paid.
    const paidOne = list.find(c => c && String(c.status).toUpperCase() === 'PAID');
    const chosen = paidOne || list[0];
    if (!chosen) return null;
    return {
      paid: Boolean(paidOne),
      amount: Number(chosen.amount),
      currency: chosen.currency
    };
  } catch (err) {
    console.error('SumUp checkout lookup failed:', err.response ? err.response.data : err.message);
    return null;
  }
}

function verifySumupSignature(req) {
  const { webhookSecret: secret } = db.getSumupConfig();
  // No secret configured: SumUp signs nothing we can check, so this stage
  // simply passes. It is not the gate — the caller confirms with SumUp's API.
  if (!secret) return true;
  if (!req.rawBody) return false;
  const provided = (req.headers['x-payload-signature']
    || req.headers['x-sumup-signature']
    || req.headers['x-sumup-event-signature']
    || '').replace(/^sha256=/i, '').trim();
  if (!provided) return false;
  const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  return timingSafeEqualStr(provided.toLowerCase(), expected.toLowerCase());
}

// Helper to generate the next 4 Saturdays dynamically for local UI slots
function getUpcomingSaturdays() {
  const dates = [];
  const current = new Date();
  
  const day = current.getDay();
  const diff = day === 6 ? 7 : (6 - day + 7) % 7;
  const nextSat = new Date(current.getTime() + diff * 24 * 60 * 60 * 1000);
  
  for (let i = 0; i < 4; i++) {
    const d = new Date(nextSat.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    d.setHours(14, 0, 0, 0);
    
    const formatted = d.toLocaleDateString('fr-CH', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }) + ' à 14:00';
    
    dates.push({
      id: `slot_${d.getTime()}`,
      date: formatted,
      capacity: 2,
      booked: 0
    });
  }
  return dates;
}

// Authentication Middleware — validates a real server-side session token.
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing admin token' });
  }
  const token = authHeader.split(' ')[1];
  const session = db.getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized: Session invalide ou expirée' });
  }
  req.adminUser = session.username; // trust this, never the request body
  next();
};

// ==========================================
// client routes
// ==========================================

// 0. Get Workshops
router.get('/workshops', async (req, res) => {
  try {
    const workshops = await db.getWorkshops();
    res.json(workshops);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve workshops' });
  }
});

// The storefront only needs to know *whether* an item is available, never how
// many are left — the admin UI labels the count "interne, non affiché".
function stripInternalFields(product) {
  const { stock, ...pub } = product;
  return pub;
}

// 1. Get Products
router.get('/products', async (req, res) => {
  try {
    const products = await db.getProducts();
    res.json(products.map(stripInternalFields));
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve products' });
  }
});

// 2. Get Product By ID
router.get('/products/:id', async (req, res) => {
  try {
    const product = await db.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(stripInternalFields(product));
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve product details' });
  }
});

// Email body for the "payment received / order confirmed" message.
// Orders are stored with `customer_name` / `customer_email` (both in MySQL and
// in orders.json), but the create-order request body uses `name` / `email`.
// Read them through this helper so a stored order is never addressed with the
// request-body field names — that silently produced `to: undefined`.
function orderContact(order) {
  return {
    name: order.customer_name || order.name || 'cher client',
    email: order.customer_email || order.email || ''
  };
}

// Used both by the order-create flow (when SumUp is mocked) and by the
// SumUp webhook (in production), so the customer's purchase email is identical.
// La facture jointe à la confirmation de paiement. Elle a signalé le manque :
// « selon les tests ok mais pas de facture ».
//
// Envoyée en HTML dans le corps du message plutôt qu'en PDF : elle est lisible
// depuis un téléphone sans rien télécharger, imprimable en PDF par le lecteur
// s'il le souhaite, et n'ajoute aucune dépendance de génération de document au
// serveur. Le numéro, lui, est réservé une seule fois et ne recule jamais.
function buildInvoiceHtml({ invoiceNumber, order, settings }) {
  const inv = settings.invoice;
  const lignes = (order.items || []).map((it) => {
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    const prix = Number(it.price) || 0;
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeForEmail(it.name || it.id || '')}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">${qty}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">CHF ${(prix * qty).toFixed(2)}</td>
    </tr>`;
  }).join('');

  const livraison = order.shipping && Number(order.shipping.cost) > 0
    ? `<tr><td style="padding:8px 0;">${escapeForEmail(order.shipping.label || 'Livraison')}</td>
         <td></td><td style="padding:8px 0;text-align:right;">CHF ${Number(order.shipping.cost).toFixed(2)}</td></tr>`
    : (order.shipping ? `<tr><td style="padding:8px 0;">${escapeForEmail(order.shipping.label || 'Livraison')}</td>
         <td></td><td style="padding:8px 0;text-align:right;">Offerte</td></tr>` : '');

  const tva = Number(inv.vatRate) > 0 && inv.vatNumber
    ? `<p style="margin:4px 0;color:#888;font-size:12px;">TVA ${inv.vatRate}% incluse — ${escapeForEmail(inv.vatNumber)}</p>`
    : `<p style="margin:4px 0;color:#888;font-size:12px;">TVA non applicable</p>`;

  return `
    <div style="font-family:sans-serif;color:#3A332B;max-width:600px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:12px;">
      <table style="width:100%;margin-bottom:24px;"><tr>
        <td><strong style="font-size:18px;">${escapeForEmail(inv.company)}</strong><br>
          <span style="color:#6A6157;font-size:12px;">${escapeForEmail(inv.address)}<br>${escapeForEmail(inv.email)}</span></td>
        <td style="text-align:right;vertical-align:top;">
          <strong>Facture ${escapeForEmail(invoiceNumber)}</strong><br>
          <span style="color:#6A6157;font-size:12px;">${new Date(order.created_at || Date.now()).toLocaleDateString('fr-CH')}</span></td>
      </tr></table>
      <p style="margin:0 0 4px;"><strong>${escapeForEmail(order.customer_name || '')}</strong></p>
      <p style="margin:0 0 20px;color:#6A6157;font-size:13px;">Commande ${escapeForEmail(order.id)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead><tr>
          <th style="text-align:left;padding-bottom:6px;border-bottom:2px solid #3A332B;">Article</th>
          <th style="text-align:center;padding-bottom:6px;border-bottom:2px solid #3A332B;">Qté</th>
          <th style="text-align:right;padding-bottom:6px;border-bottom:2px solid #3A332B;">Montant</th>
        </tr></thead>
        <tbody>${lignes}${livraison}</tbody>
      </table>
      <p style="text-align:right;font-size:18px;margin:18px 0 0;"><strong>Total : CHF ${Number(order.total).toFixed(2)}</strong></p>
      ${tva}
      <p style="color:#888;font-size:12px;margin-top:18px;">Payé par carte via SumUp. Ce document tient lieu de facture acquittée.</p>
    </div>`;
}

function escapeForEmail(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildPaymentConfirmedEmail({ name, orderId, total }) {
  return `
      <div style="font-family: sans-serif; color: #444; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
        <h2 style="color: #2c3e50; font-family: serif; border-bottom: 1px solid #eee; padding-bottom: 10px;">Merci pour votre achat !</h2>
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Nous avons bien reçu votre paiement. Votre commande chez So You Cosmetics Genève est confirmée et nous préparons vos produits artisanaux.</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Référence de commande :</strong> ${orderId}</p>
          <p style="margin: 0 0 10px 0;"><strong>Statut :</strong> Paiement reçu</p>
          <p style="margin: 0;"><strong>Total :</strong> CHF ${parseFloat(total).toFixed(2)}</p>
        </div>
        <p>Vous recevrez un nouveau message dès l'expédition.</p>
        <p style="font-style: italic; color: #888;">So You Cosmetics Genève - Faits main en Suisse</p>
      </div>
    `;
}

// Email body for "ready for pickup at the store" notifications.
function buildPickupReadyEmail({ name, orderId }) {
  return `
      <div style="font-family: sans-serif; color: #444; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
        <h2 style="color: #2c3e50; font-family: serif; border-bottom: 1px solid #eee; padding-bottom: 10px;">Votre commande est prête !</h2>
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Bonne nouvelle : votre commande <strong>${orderId}</strong> est prête à être retirée en boutique.</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 6px 0;"><strong>Adresse de retrait :</strong></p>
          <p style="margin: 0 0 6px 0;">Boutique Soap Opera by So You Cosmetics<br />3 av. Pictet-De-Rochemont, 1207 Genève</p>
          <p style="margin: 6px 0 0 0;"><strong>Téléphone :</strong> 022 556 69 92</p>
        </div>
        <p>Nous nous réjouissons de vous accueillir prochainement.</p>
        <p style="font-style: italic; color: #888;">L'équipe So You Cosmetics Genève</p>
      </div>
    `;
}

// Email body for "shipped — here is your tracking number" notifications.
function buildShippedEmail({ name, orderId, carrier, trackingNumber }) {
  // Build a "track your package" link for the major Swiss carriers if recognized.
  const carrierLower = (carrier || '').toLowerCase();
  let trackUrl = '';
  if (carrierLower.includes('post')) {
    trackUrl = `https://service.post.ch/EasyTrack/submitParcelData.do?formattedParcelCodes=${encodeURIComponent(trackingNumber)}`;
  } else if (carrierLower.includes('dhl')) {
    trackUrl = `https://www.dhl.com/ch-fr/home/tracking/tracking-parcel.html?submit=1&tracking-id=${encodeURIComponent(trackingNumber)}`;
  } else if (carrierLower.includes('dpd')) {
    trackUrl = `https://tracking.dpd.de/status/fr_CH/parcel/${encodeURIComponent(trackingNumber)}`;
  } else if (carrierLower.includes('ups')) {
    trackUrl = `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
  } else if (carrierLower.includes('fedex')) {
    trackUrl = `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
  }
  return `
      <div style="font-family: sans-serif; color: #444; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
        <h2 style="color: #2c3e50; font-family: serif; border-bottom: 1px solid #eee; padding-bottom: 10px;">Votre commande est en route !</h2>
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Votre commande <strong>${orderId}</strong> a quitté nos ateliers et est désormais en route vers vous.</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 6px 0;"><strong>Transporteur :</strong> ${carrier}</p>
          <p style="margin: 0;"><strong>Numéro de suivi :</strong> <span style="font-family: monospace;">${trackingNumber}</span></p>
        </div>
        ${trackUrl ? `<p><a href="${trackUrl}" style="display:inline-block;padding:10px 20px;background:#2c3e50;color:#fff;text-decoration:none;border-radius:6px;">Suivre mon colis →</a></p>` : ''}
        <p>Merci pour votre confiance.</p>
        <p style="font-style: italic; color: #888;">L'équipe So You Cosmetics Genève</p>
      </div>
    `;
}

// 3. Create Order / Checkout
// Recomputes what an order is worth from the catalogue and the shipping table,
// rather than believing the figure the browser sent.
//
// The total used to come straight from req.body and go straight to SumUp, so a
// crafted request could have paid one franc for a full basket. Prices are read
// from the catalogue by product id and shipping from her settings; the client
// chooses *which* delivery option, never what it costs.
async function computeOrderTotal(items, shippingId, options = {}) {
  const catalogue = await db.getProducts();
  const byId = new Map(catalogue.map((p) => [String(p.id), p]));

  let goods = 0;
  let nbRecharges = 0;
  // Ce que la commande contient réellement, pour vérifier ensuite qu'elle a le
  // droit du mode d'expédition demandé.
  const produitsCommandes = [];
  for (const line of items || []) {
    const product = byId.get(String(line.id));
    if (!product) continue;                       // ligne inconnue : ignorée, jamais facturée
    // Une fiche sans prix ne s'achète pas : c'est un « sur devis », pas un
    // article à zéro franc. Quatre existent au catalogue, et sans cette garde
    // un panier n'en contenant qu'elles passait pour le seul prix du port.
    if (!(Number(product.price) > 0)) continue;
    produitsCommandes.push({ produit: product, qty: Math.max(1, parseInt(line.qty, 10) || 1) });

    // La variante de recharge. Le navigateur DEMANDE une recharge ; c'est le
    // catalogue qui en donne le prix, et seulement si la fiche en propose une.
    // Une demande de recharge sur un produit qui n'en a pas retombe sur le
    // prix plein — jamais sur un montant que le navigateur aurait choisi.
    const recharge = line.recharge && Number(product.rechargePrix) > 0;
    const price = recharge ? Number(product.rechargePrix) : (Number(product.price) || 0);
    const qty = Math.max(1, parseInt(line.qty, 10) || 1);
    goods += price * qty;
    if (recharge) nbRecharges += qty;
  }

  const { shipping } = db.getShopSettings();
  const option = (shipping.options || []).find((o) => o.id === shippingId);

  // Un mode d'expédition inconnu ne doit pas coûter zéro. C'était le cas :
  // `option` valait undefined et les frais tombaient à 0, si bien qu'une requête
  // forgée — ou simplement un onglet resté ouvert après qu'elle a modifié ses
  // tarifs — obtenait le port gratuit sans que rien ne le signale. On refuse,
  // et l'appelant reçoit une raison plutôt qu'une remise silencieuse.
  if (!option) {
    const e = new Error('shipping-inconnu');
    e.code = 'SHIPPING_INCONNU';
    throw e;
  }

  // Ses quatre tarifs Courrier portent la mention « Bon cadeau uniquement ».
  // Elle était affichée, jamais appliquée : on pouvait expédier deux kilos de
  // savon pour un franc. La différence sortait de sa poche.
  if (!db.modeAutorise(shippingId, produitsCommandes.map((l) => l.produit))) {
    const e = new Error('mode-reserve');
    e.code = 'SHIPPING_RESERVE';
    throw e;
  }

  // « Jusqu'à 2 kg » figurait sur ses quatre tarifs colis sans être vérifié.
  // La règle ne mord que sur un panier dont TOUS les poids sont connus : tant
  // que son export n'est pas versé, rien ne change.
  if (!db.modeSupporteLePoids(shippingId, produitsCommandes)) {
    const e = new Error('poids-depasse');
    e.code = 'SHIPPING_POIDS';
    e.poids = db.poidsPanier(produitsCommandes).grammes;
    throw e;
  }

  let shippingCost = Number(option.price) || 0;

  // La franchise ne vaut que pour l'Economy : offrir un envoi Priority sur un
  // panier à 150 peut effacer la marge.
  const seuil = Number(shipping.freeFrom);
  if (option && option.economy && Number.isFinite(seuil) && seuil > 0 && goods >= seuil) {
    shippingCost = 0;
  }

  // L'emballage cadeau est une ligne d'argent : elle est calculee ICI, avec le
  // reste, et jamais ajoutee au seul recapitulatif du tiroir. Un supplement
  // affiche mais non facture — ou l'inverse — est exactement le defaut corrige
  // sur les frais de port : le client voyait un total et en payait un autre.
  const { giftWrap } = db.getShopSettings();
  const emballage = options.emballageCadeau && giftWrap && giftWrap.enabled
    ? Number(giftWrap.price) || 0
    : 0;

  return {
    goods: Math.round(goods * 100) / 100,
    shippingCost: Math.round(shippingCost * 100) / 100,
    giftWrapCost: Math.round(emballage * 100) / 100,
    nbRecharges,
    total: Math.round((goods + shippingCost + emballage) * 100) / 100,
    shippingLabel: option ? option.label : '',
  };
}

// Combien de flacons ont été remplis, en tout.
//
// La route n'expose QUE ce nombre. Elle lit les commandes payées et ne renvoie
// ni les noms, ni les adresses, ni les montants : server/data/orders.json ne
// doit jamais transiter par une route publique, et un compteur n'a pas besoin
// de son contenu pour compter.
router.get('/refill-count', async (req, res) => {
  try {
    const commandes = await db.getOrders();
    const total = (commandes || [])
      .filter((c) => db.canonicalOrderStatus(c.status) !== 'Pending')
      .reduce((n, c) => n + (c.items || []).reduce(
        (m, l) => m + (l.recharge ? Math.max(1, parseInt(l.qty, 10) || 1) : 0), 0), 0);
    res.json({ count: total });
  } catch {
    // Un compteur indisponible n'est pas une panne : on renvoie zéro et la
    // page n'affiche simplement rien.
    res.json({ count: 0 });
  }
});

router.post('/orders', async (req, res) => {
  const { name, email, items, shippingId, address, cadeau } = req.body;
  if (!name || !email || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required order details' });
  }

  try {
    let calcul;
    try {
      calcul = await computeOrderTotal(items, shippingId, { emballageCadeau: cadeau && cadeau.emballage });
    } catch (err) {
      if (err && err.code === 'SHIPPING_POIDS') {
        const kg = (Number(err.poids) / 1000).toFixed(1).replace('.', ',');
        return res.status(400).json({ error: `Ce panier pèse ${kg} kg : au-delà de 2 kg, ce tarif ne s'applique plus. Écrivez-nous et nous organiserons l'envoi.` });
      }
      if (err && err.code === 'SHIPPING_RESERVE') {
        return res.status(400).json({ error: "Ce tarif est réservé aux bons cadeaux. Choisissez un envoi colis ou le retrait à la boutique." });
      }
      if (err && err.code === 'SHIPPING_INCONNU') {
        return res.status(400).json({ error: "Ce mode d'expédition n'est plus proposé. Rechargez la page et choisissez à nouveau." });
      }
      throw err;
    }
    // On contrôle la MARCHANDISE, pas le total : avec des frais de port, un
    // panier ne contenant que des fiches sans prix afficherait un total positif
    // tout en ne vendant rien.
    if (!(calcul.goods > 0)) {
      return res.status(400).json({ error: 'Panier vide ou produits introuvables' });
    }

    // Une recharge suppose que la cliente apporte son flacon : elle se retire
    // forcément en boutique. L'interface l'impose déjà, le serveur le vérifie —
    // sinon une requête forgée obtiendrait un prix de recharge pour un colis.
    if (calcul.nbRecharges > 0 && db.exigeAdresse(shippingId)) {
      return res.status(400).json({
        error: 'Une recharge se retire à la boutique : choisissez « Retrait à la boutique ».',
      });
    }

    // Une commande postale sans adresse ne peut pas être expédiée. La condition
    // est écrite à l'envers de ce qu'on lirait spontanément — on n'exempte QUE
    // le retrait en boutique — parce qu'une condition trop large refuserait
    // toutes les commandes, y compris celles qu'on peut honorer.
    if (db.exigeAdresse(shippingId)) {
      const a = address || {};
      const manquants = ['line1', 'zip', 'city'].filter((c) => !String(a[c] || '').trim());
      if (manquants.length > 0) {
        return res.status(400).json({
          error: "Merci d'indiquer l'adresse de livraison : rue, code postal et localité.",
          champs: manquants,
        });
      }
    }
    const total = calcul.total;
    const newOrder = await db.createOrder({
      name, email, items, total,
      shipping: { id: shippingId || '', label: calcul.shippingLabel, cost: calcul.shippingCost },
      // Nulle pour un retrait en boutique : il n'y a rien à expédier.
      address: db.exigeAdresse(shippingId) ? address : null,
      // L'emballage retenu est celui que le serveur a FACTURE, pas celui que le
      // navigateur a demande : si le reglage est desactive, rien n'a ete debite
      // et la commande ne doit pas pretendre le contraire.
      cadeau: cadeau ? { ...cadeau, emballage: calcul.giftWrapCost > 0 } : null,
    });

    let checkoutId = `mock_session_${newOrder.id}`;
    let sumupActive = false;

    // Read SumUp creds from admin-saved settings first, env as fallback
    const sumup = db.getSumupConfig();
    if (sumup.apiKey && sumup.merchantEmail) {
      sumupActive = true;
      try {
        const axios = require('axios');
        const sumupRes = await axios.post(`${sumupApiBase()}/v0.1/checkouts`, {
          checkout_reference: newOrder.id,
          amount: parseFloat(total),
          currency: "CHF",
          pay_to_email: sumup.merchantEmail,
          description: `Commande ${newOrder.id} - So You Cosmetics`,
          // Without this, SumUp has nowhere to notify: the payment succeeds on
          // their side and the shop never learns of it, so the order sits at
          // "Pending" for ever and no confirmation email is ever sent.
          return_url: `${publicBaseUrl()}/api/sumup/webhook`
        }, {
          headers: {
            'Authorization': `Bearer ${sumup.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        checkoutId = sumupRes.data.id;
      } catch (sumupErr) {
        console.error('SumUp API Error:', sumupErr.response ? sumupErr.response.data : sumupErr.message);
        return res.status(500).json({ error: 'Erreur lors de la création de la session de paiement SumUp.' });
      }
    } else {
      console.warn("SumUp non configuré (clé API + email vendeur manquants). Utilisation d'un checkout_id simulé.");
    }

    // When SumUp is not yet configured we cannot wait for a real webhook, so
    // treat order-creation itself as the purchase event and send the confirmation
    // email now. Once SUMUP_API_KEY is set in env, this email moves to the
    // /api/sumup/webhook path below (real payment.successful), no other change.
    if (!sumupActive) {
      try {
        await db.updateOrderStatus(newOrder.id, 'Paid');
        await emailService.sendMail({
          to: email,
          subject: `Merci pour votre achat ${newOrder.id} - So You Cosmetics`,
          html: buildPaymentConfirmedEmail({ name, orderId: newOrder.id, total })
        });
      } catch (mailErr) {
        console.error('Failed to send order confirmation email:', mailErr);
      }
    }

    res.status(201).json({
      message: sumupActive ? 'Order created (Pending Payment)' : 'Order created (Mocked Payment)',
      orderId: newOrder.id,
      checkoutId: checkoutId
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process order' });
  }
});

// Confirms an order as paid — shared by SumUp's webhook and by the customer's
// browser once the card widget reports success. Neither caller is trusted: both
// only say *which* order to look at, and SumUp is asked whether it was really
// paid. That is what makes it safe to expose this to a browser at all.
//
// Two independent triggers because one of them will eventually fail. A webhook
// that is never delivered used to mean an order stayed Pending for ever and the
// customer heard nothing; now the browser confirms it a moment later, and if
// the customer closes the tab first, the webhook still does.
async function confirmOrderPaid(orderId, source) {
  const order = await db.getOrderById(orderId);
  if (!order) {
    console.warn(`SumUp confirmation (${source}): order ${orderId} not found`);
    return { confirmed: false, status: null };
  }
  // Case-insensitive: orders written before the status vocabulary was
  // normalised still hold 'paid', and must not be confirmed twice — that would
  // send the customer a second confirmation email.
  if (String(order.status || '').toLowerCase() === 'paid') {
    return { confirmed: true, status: 'Paid' };
  }

  const checkout = await fetchCheckoutFromSumup(order.id);
  if (!checkout) {
    console.error(`SumUp confirmation (${source}): could not reach SumUp for order ${order.id} — left unconfirmed rather than assumed paid.`);
    return { confirmed: false, status: order.status };
  }
  if (!checkout.paid) {
    console.warn(`SumUp confirmation (${source}): order ${order.id} announced but SumUp does not report it paid — ignored.`);
    return { confirmed: false, status: order.status };
  }
  // Guard the amount too: confirming an order for less than it is worth is as
  // damaging as confirming an unpaid one. Compared with a tolerance because the
  // two sides are floating-point currency values.
  const expected = Number(order.total);
  if (Number.isFinite(expected) && Math.abs(checkout.amount - expected) > 0.01) {
    console.error(`SumUp confirmation (${source}): order ${order.id} paid ${checkout.amount} ${checkout.currency} but is worth ${expected} — not confirmed, needs review.`);
    return { confirmed: false, status: order.status };
  }

  await db.updateOrderStatus(order.id, 'Paid');
  const { name, email } = orderContact(order);
  if (!email) {
    console.error(`SumUp confirmation (${source}): order ${order.id} is marked paid but has no customer email — confirmation not sent.`);
    return { confirmed: true, status: 'Paid' };
  }
  try {
    await emailService.sendMail({
      to: email,
      subject: `Merci pour votre achat ${order.id} - So You Cosmetics`,
      html: buildPaymentConfirmedEmail({ name, orderId: order.id, total: order.total })
    });
    await sendInvoiceIfEnabled(order, email);
    await avertirNouvelleCommande(order);
    await appliquerStockEtAlerter(order);
  } catch (mailErr) {
    // The payment is real either way — never fail the confirmation over email.
    console.error(`SumUp confirmation (${source}): order ${order.id} confirmed but the email failed:`, mailErr);
  }
  return { confirmed: true, status: 'Paid' };
}

// L'avertit qu'une commande est payée. « M'avertir automatiquement lorsqu'une
// nouvelle commande est passée et lorsqu'un paiement est reçu ? » — jusqu'ici
// tous les messages partaient au client, aucun à elle.
//
// Envoyé au paiement confirmé plutôt qu'à la création : une commande non payée
// n'est pas encore une commande, et la prévenir de paniers abandonnés lui
// apprendrait vite à ignorer ces messages.
// L'adresse de livraison, mise en forme pour un e-mail.
//
// C'est le renseignement dont elle a besoin pour préparer le colis : il doit
// figurer dans l'avis de commande, pas seulement dans l'administration. Sans
// lui, elle devait écrire à la cliente pour le réclamer, après paiement.
function blocAdresseEmail(order) {
  const a = order && order.address;
  if (!a || !a.line1) return '';
  const lignes = [
    escapeForEmail(order.customer_name || ''),
    escapeForEmail(a.line1),
    a.line2 ? escapeForEmail(a.line2) : '',
    `${escapeForEmail(a.zip || '')} ${escapeForEmail(a.city || '')}`.trim(),
    a.country && a.country !== 'CH' ? escapeForEmail(a.country) : '',
  ].filter(Boolean);
  return `
    <p style="margin:16px 0 4px;"><strong>Adresse de livraison</strong></p>
    <p style="margin:0;line-height:1.5;">${lignes.join('<br>')}</p>`;
}

async function avertirNouvelleCommande(order) {
  const { alerts } = db.getShopSettings();
  if (!alerts.onNewOrder || !alerts.email) return;

  const lignes = (order.items || []).map((it) => {
    const qte = Math.max(1, parseInt(it.qty, 10) || 1);
    return `<li>${qte} × ${escapeForEmail(it.name || it.id || '')}</li>`;
  }).join('');

  const livraison = order.shipping
    ? `<p><strong>Expédition :</strong> ${escapeForEmail(order.shipping.label || '')}${
        Number(order.shipping.cost) > 0 ? ` (CHF ${Number(order.shipping.cost).toFixed(2)})` : ' — offerte'}</p>`
    : '';

  try {
    await emailService.sendMail({
      to: alerts.email,
      subject: `Nouvelle commande payée — CHF ${Number(order.total).toFixed(2)}`,
      html: `
        <div style="font-family:sans-serif;color:#3A332B;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="font-family:serif;font-weight:400;">Commande ${escapeForEmail(order.id)}</h2>
          <p><strong>${escapeForEmail(order.customer_name || '')}</strong> — ${escapeForEmail(order.customer_email || '')}</p>
          <ul>${lignes}</ul>
          ${livraison}
          ${blocAdresseEmail(order)}
          <p style="font-size:17px;"><strong>Total encaissé : CHF ${Number(order.total).toFixed(2)}</strong></p>
        </div>`,
    });
  } catch (err) {
    console.error(`New-order alert for ${order.id} could not be sent:`, err.message);
  }
}

// Retire le stock vendu et l'avertit de ce qui manque.
//
// Elle posait trois questions dans son document : le stock est-il décrémenté
// automatiquement, est-elle prévenue d'une rupture, peut-on définir un seuil.
// Les trois tiennent ici.
//
// L'alerte part vers l'adresse qu'elle a renseignée dans l'administration. Sans
// adresse, rien n'est envoyé — écrire dans le vide donnerait l'illusion d'être
// prévenue.
async function appliquerStockEtAlerter(order) {
  const { alerts } = db.getShopSettings();
  const seuil = Number(alerts.lowStockThreshold) || 3;

  let evenements = [];
  try {
    evenements = db.decrementStock(order.items || [], seuil);
  } catch (err) {
    // Un stock qu'on n'a pas pu mettre à jour ne doit pas annuler un paiement
    // encaissé : on le signale et on continue.
    console.error(`Stock could not be updated for order ${order.id}:`, err.message);
    return;
  }

  if (evenements.length === 0) return;
  if (!alerts.onLowStock || !alerts.email) return;

  const ruptures = evenements.filter((e) => e.type === 'rupture');
  const bas = evenements.filter((e) => e.type === 'bas');
  const ligne = (e) => `<li><strong>${escapeForEmail(e.nom)}</strong> — ${e.restant === 0 ? 'épuisé' : `${e.restant} restant(s)`}</li>`;

  try {
    await emailService.sendMail({
      to: alerts.email,
      subject: ruptures.length
        ? `Rupture de stock — ${ruptures.length} produit(s)`
        : `Stock bas — ${bas.length} produit(s)`,
      html: `
        <div style="font-family:sans-serif;color:#3A332B;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="font-family:serif;font-weight:400;">Après la commande ${escapeForEmail(order.id)}</h2>
          ${ruptures.length ? `<p><strong>Épuisé :</strong></p><ul>${ruptures.map(ligne).join('')}</ul>` : ''}
          ${bas.length ? `<p><strong>Il en reste peu (seuil : ${seuil}) :</strong></p><ul>${bas.map(ligne).join('')}</ul>` : ''}
          <p style="color:#6A6157;font-size:13px;">Les quantités ont déjà été mises à jour dans votre administration.
          Un produit épuisé est automatiquement retiré de la vente.</p>
        </div>`,
    });
  } catch (err) {
    console.error(`Stock alert for order ${order.id} could not be sent:`, err.message);
  }
}

// Émet la facture une seule fois par commande. Le numéro est réservé au moment
// de l'envoi : une commande confirmée deux fois (webhook puis navigateur) ne
// doit pas consommer deux numéros ni envoyer deux factures.
async function sendInvoiceIfEnabled(order, email) {
  const settings = db.getShopSettings();
  if (!settings.invoice || !settings.invoice.enabled) return;
  if (order.invoice_number) return;             // déjà facturée
  if (!email) return;

  try {
    const invoiceNumber = db.nextInvoiceNumber();
    await db.updateOrderFields(order.id, { invoice_number: invoiceNumber });
    await emailService.sendMail({
      to: email,
      subject: `Facture ${invoiceNumber} - So You Cosmetics`,
      html: buildInvoiceHtml({ invoiceNumber, order, settings }),
    });
  } catch (err) {
    // Une facture qui échoue ne doit pas remettre en cause un paiement encaissé.
    console.error(`Invoice for order ${order.id} could not be sent:`, err.message);
  }
}

// 3b. SumUp Webhook — fired by SumUp once a checkout completes.
// Reference: https://developer.sumup.com/docs/online-payments/introduction/webhooks/
// Subscribed per-checkout through return_url; there is no dashboard where an
// endpoint is registered once.
router.post('/sumup/webhook', async (req, res) => {
  // Enforced strictly when a secret is configured. When none is, the signature
  // cannot be checked and the request is simply unproven — harmless, because
  // confirmation rests on SumUp's API rather than on this body.
  if (!verifySumupSignature(req)) {
    console.warn('SumUp webhook rejected: signature mismatch');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body || {};
  const payload = event.payload || event.data || event;
  const checkoutRef = payload.checkout_reference || payload.reference || payload.checkout_id;

  // Always ack quickly so SumUp doesn't retry
  res.status(200).json({ received: true });

  if (!checkoutRef) {
    console.warn('SumUp webhook missing checkout_reference', event);
    return;
  }
  try {
    await confirmOrderPaid(checkoutRef, 'webhook');
  } catch (err) {
    console.error('SumUp webhook handler error:', err);
  }
});

// 3c. Confirmation from the customer's browser, once the card widget reports
// success. Safe to expose: the caller only names an order, and SumUp decides.
router.post('/orders/:id/confirm', async (req, res) => {
  try {
    const result = await confirmOrderPaid(req.params.id, 'browser');
    res.json({ paid: result.confirmed, status: result.status });
  } catch (err) {
    console.error('Order confirmation error:', err);
    res.status(500).json({ error: 'Confirmation failed' });
  }
});

// 3d. Content overrides — the texts she has rewritten from the admin.
//
// Both routes require admin. The public site never calls them: the server
// injects the overrides into index.html before sending it, so there is no
// second request to make and nothing to expose. Only the editor reads this.
router.get('/content', requireAdmin, (req, res) => {
  try {
    res.json(db.readContent());
  } catch (err) {
    console.error('Failed to read content overrides:', err);
    res.status(500).json({ error: 'Lecture des textes impossible' });
  }
});

// Accepts { fr: { 'hero.titleLine1': '…' }, en: { … } } and merges it in.
// A value of null or '' removes that one override, so a field returns to its
// coded default without disturbing its neighbours.
router.put('/content', requireAdmin, (req, res) => {
  const patch = req.body;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return res.status(400).json({ error: 'Format attendu : { langue: { chemin: texte } }' });
  }
  // Guard the shape before writing: a malformed body must not be able to turn
  // the store into something readContent() will refuse, which would silently
  // drop every text she has already saved.
  for (const [lang, fields] of Object.entries(patch)) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return res.status(400).json({ error: `Champs invalides pour la langue « ${lang} »` });
    }
    for (const [dotPath, value] of Object.entries(fields)) {
      if (value !== null && typeof value !== 'string' && !Array.isArray(value)) {
        return res.status(400).json({ error: `Valeur invalide pour « ${dotPath} »` });
      }
    }
  }
  try {
    res.json(db.updateContent(patch));
  } catch (err) {
    console.error('Failed to write content overrides:', err);
    res.status(500).json({ error: 'Enregistrement des textes impossible' });
  }
});

// 3e. Shop settings — opening hours, absence notice, maintenance mode.
// Read by the admin only; the public site receives them injected into the page
// (server/index.js), like the content overrides.
// Verser son export dans les trois champs vides.
//
// Elle envoie un CSV : c'est ce que Wix exporte et ce qui s'ouvre dans Excel.
// On accepte le point-virgule comme la virgule — Excel en Suisse romande écrit
// des points-virgules, et un fichier séparé par des virgules recollé à la main
// est le cas le plus fréquent.
//
// SIMULE PAR DÉFAUT. Il faut `appliquer: true` pour écrire, et la réponse dit
// toujours ce qui serait fait, dans les deux cas.
function lireCsv(texte) {
  const brut = String(texte || '').replace(/^﻿/, '').trim();
  if (!brut) return [];
  const lignes = brut.split(/\r?\n/).filter((l) => l.trim());
  if (lignes.length < 2) return [];

  // Le séparateur est celui qui apparaît le plus dans l'en-tête.
  const entete = lignes[0];
  const sep = (entete.split(';').length > entete.split(',').length) ? ';' : ',';

  const decouper = (ligne) => {
    const cases = [];
    let courant = '', dansGuillemets = false;
    for (let i = 0; i < ligne.length; i++) {
      const c = ligne[i];
      if (c === '"') {
        if (dansGuillemets && ligne[i + 1] === '"') { courant += '"'; i++; }
        else dansGuillemets = !dansGuillemets;
      } else if (c === sep && !dansGuillemets) {
        cases.push(courant); courant = '';
      } else {
        courant += c;
      }
    }
    cases.push(courant);
    return cases.map((v) => v.trim());
  };

  const clefs = decouper(entete).map((t) =>
    t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
  );

  return lignes.slice(1).map((l) => {
    const cases = decouper(l);
    const ligne = {};
    clefs.forEach((k, i) => {
      // On ne retient que les quatre colonnes attendues ; le reste de son
      // export Wix passe sans être lu.
      if (k === 'reference' || k === 'ref' || k === 'nom' || k === 'name') ligne.reference = cases[i];
      else if (k === 'inci' || k === 'composition') ligne.inci = cases[i];
      else if (k === 'contenance' || k === 'volume') ligne.contenance = cases[i];
      else if (k === 'poids' || k === 'weight') ligne.poids = cases[i];
    });
    return ligne;
  });
}

router.post('/admin/products/import-metadata', requireAdmin, (req, res) => {
  try {
    const { csv, lignes, appliquer } = req.body || {};
    const rangs = Array.isArray(lignes) ? lignes : lireCsv(csv);
    if (rangs.length === 0) {
      return res.status(400).json({ error: 'Aucune ligne lisible. Attendu : un CSV avec une colonne « reference », plus « inci », « contenance » ou « poids ».' });
    }
    const rapport = db.importerMetadonnees(rangs, { appliquer: appliquer === true });
    res.json(rapport);
  } catch (err) {
    console.error('Import des métadonnées produits :', err.message);
    res.status(500).json({ error: "L'import n'a pas pu être traité." });
  }
});

router.get('/admin/settings/shop', requireAdmin, (req, res) => {
  try {
    res.json(db.getShopSettings());
  } catch (err) {
    console.error('Failed to read shop settings:', err);
    res.status(500).json({ error: 'Lecture des réglages impossible' });
  }
});

router.put('/admin/settings/shop', requireAdmin, (req, res) => {
  const patch = req.body;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return res.status(400).json({ error: 'Format invalide' });
  }
  if (patch.hours !== undefined && !Array.isArray(patch.hours)) {
    return res.status(400).json({ error: 'Les horaires doivent être une liste' });
  }
  try {
    res.json(db.updateShopSettings(patch));
  } catch (err) {
    console.error('Failed to write shop settings:', err);
    res.status(500).json({ error: 'Enregistrement impossible' });
  }
});

// 3f. Journal — public reading, admin writing.
//
// The public route returns published articles only. A draft she is still working
// on must not be reachable by guessing its address: unlisted is not private.
router.get('/articles', (req, res) => {
  try {
    res.json(db.getArticles({ publishedOnly: true }));
  } catch (err) {
    console.error('Failed to read articles:', err);
    res.status(500).json({ error: 'Lecture impossible' });
  }
});

router.get('/articles/:slug', (req, res) => {
  try {
    const article = db.getArticleBySlug(req.params.slug);
    if (!article || !article.published) return res.status(404).json({ error: 'Article introuvable' });
    res.json(article);
  } catch (err) {
    console.error('Failed to read article:', err);
    res.status(500).json({ error: 'Lecture impossible' });
  }
});

router.get('/admin/articles', requireAdmin, (req, res) => {
  try {
    res.json(db.getArticles());
  } catch (err) {
    res.status(500).json({ error: 'Lecture impossible' });
  }
});

router.post('/admin/articles', requireAdmin, (req, res) => {
  if (!req.body || !String(req.body.title || '').trim()) {
    return res.status(400).json({ error: 'Un titre est requis' });
  }
  try {
    res.status(201).json(db.createArticle(req.body));
  } catch (err) {
    console.error('Failed to create article:', err);
    res.status(500).json({ error: 'Création impossible' });
  }
});

router.put('/admin/articles/:id', requireAdmin, (req, res) => {
  try {
    const updated = db.updateArticle(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Article introuvable' });
    res.json(updated);
  } catch (err) {
    console.error('Failed to update article:', err);
    res.status(500).json({ error: 'Enregistrement impossible' });
  }
});

router.delete('/admin/articles/:id', requireAdmin, (req, res) => {
  try {
    if (!db.deleteArticle(req.params.id)) return res.status(404).json({ error: 'Article introuvable' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Failed to delete article:', err);
    res.status(500).json({ error: 'Suppression impossible' });
  }
});

// 3g. Export des ventes — « sortir un tableau chaque fin d'année regroupant
// toutes les ventes effectuées pour ma compta ».
//
// CSV plutôt que PDF : c'est ce qui s'ouvre dans Excel et se transmet à un
// comptable sans retaper une ligne. Séparateur point-virgule et BOM UTF-8,
// faute de quoi Excel en français découpe mal les colonnes et mange les accents.
function champCsv(valeur) {
  const t = String(valeur === null || valeur === undefined ? '' : valeur);
  // Un point-virgule, un guillemet ou un retour a la ligne dans un nom de
  // produit casserait la colonne suivante s'il n'etait pas protege.
  return /[";\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

router.get('/admin/orders/export', requireAdmin, async (req, res) => {
  try {
    const annee = String(req.query.year || new Date().getFullYear());
    const toutes = await db.getOrders();

    // Seules les commandes encaissées intéressent la comptabilité : un panier
    // abandonné n'est pas une vente.
    const ventes = (toutes || []).filter((o) => {
      const payee = ['paid', 'readyforpickup', 'shipped'].includes(String(o.status || '').toLowerCase());
      return payee && String(o.created_at || '').startsWith(annee);
    });

    const entetes = ['Date', 'Commande', 'Facture', 'Client', 'E-mail', 'Articles',
                     'Expedition', 'Frais de port', 'Total encaisse', 'Statut'];
    const lignes = ventes.map((o) => {
      const articles = (o.items || [])
        .map((it) => `${Math.max(1, parseInt(it.qty, 10) || 1)} x ${it.name || it.id || ''}`)
        .join(' | ');
      return [
        String(o.created_at || '').slice(0, 10),
        o.id,
        o.invoice_number || '',
        o.customer_name || '',
        o.customer_email || '',
        articles,
        (o.shipping && o.shipping.label) || '',
        o.shipping ? Number(o.shipping.cost || 0).toFixed(2) : '',
        Number(o.total || 0).toFixed(2),
        o.status || '',
      ].map(champCsv).join(';');
    });

    const total = ventes.reduce((s, o) => s + (Number(o.total) || 0), 0);
    lignes.push('');
    lignes.push([champCsv(`Total ${annee}`), '', '', '', '', '', '', '',
                 champCsv(total.toFixed(2)), champCsv(`${ventes.length} vente(s)`)].join(';'));

    const csv = '\ufeff' + [entetes.join(';'), ...lignes].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ventes-so-you-${annee}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Sales export failed:', err);
    res.status(500).json({ error: 'Export impossible' });
  }
});

// 4. Get Booking Slots
router.get('/workshops/slots', (req, res) => {
  try {
    const slots = getUpcomingSaturdays();
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve booking slots' });
  }
});

// 5. Book Workshop
router.post('/workshops/book', async (req, res) => {
  const { name, email, workshopId, date, seats } = req.body;
  if (!name || !email || !workshopId || !date) {
    return res.status(400).json({ error: 'Missing booking details' });
  }
  
  try {
    const booking = await db.createBooking({ name, email, workshop_id: workshopId, date, seats });
    
    // Auto-send booking confirmation email to client
    const emailHtml = `
      <div style="font-family: sans-serif; color: #444; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
        <h2 style="color: #2c3e50; font-family: serif; border-b: 1px solid #eee; padding-bottom: 10px;">Réservation d'atelier confirmée</h2>
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Nous avons le plaisir de vous confirmer votre réservation pour l'atelier cosmétique :</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Date de l'atelier :</strong> ${date}</p>
          <p style="margin: 0 0 10px 0;"><strong>Places réservées :</strong> ${seats || 1}</p>
          <p style="margin: 0;"><strong>Lieu :</strong> Boutique Soap Opera, 3 av. Pictet-De-Rochemont, 1207 Genève</p>
        </div>
        <p>Vous repartirez avec votre propre création cosmétique naturelle faite main !</p>
        <p>À très bientôt,</p>
        <p style="font-style: italic; color: #888;">L'équipe So You Cosmetics Genève</p>
      </div>
    `;
    await emailService.sendMail({
      to: email,
      subject: `Votre réservation d'atelier So You Cosmetics est confirmée !`,
      html: emailHtml
    });

    res.status(201).json({
      message: 'Booking confirmed successfully!',
      bookingId: booking.id
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

// 6. Submit Contact Inquiry
router.post('/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing contact message fields' });
  }
  
  try {
    await db.createContact({ name, email, subject, message });
    
    // Auto-send auto-response email to client
    const emailHtml = `
      <div style="font-family: sans-serif; color: #444; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Merci pour votre message. Nous avons bien reçu votre demande concernant <strong>"${subject || 'Inquiry'}"</strong>.</p>
        <p>Notre équipe vous répondra dans les plus brefs délais.</p>
        <p>Meilleures salutations,</p>
        <p style="font-style: italic; color: #888;">L'équipe So You Cosmetics Genève</p>
      </div>
    `;
    await emailService.sendMail({
      to: email,
      subject: `Nous avons bien reçu votre message - So You Cosmetics`,
      html: emailHtml
    });

    res.status(200).json({ message: 'Message logged and sent successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process contact submission' });
  }
});

// 6b. Newsletter Signup — stores the email (deduped). Independent of SMTP,
// so it works even before the mailbox/SMTP credentials are configured.
router.post('/newsletter', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Adresse e-mail invalide' });
  }

  try {
    await db.createNewsletterSubscriber(email);
    res.status(201).json({ message: 'Inscription à la newsletter réussie' });
  } catch (err) {
    console.error('Newsletter signup failed:', err);
    res.status(500).json({ error: 'Failed to subscribe to newsletter' });
  }
});

// ==========================================
// admin routes
// ==========================================

// 7. Admin Login
router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const admin = await db.getAdmin(username);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const hash = db.hashPassword(password, admin.salt);
    if (hash === admin.password_hash) {
      const token = db.createSession(username);
      res.json({ token, username });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Login process encountered an error' });
  }
});

// 7b. Admin Logout — invalidate the current session token
router.post('/admin/logout', requireAdmin, (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  db.deleteSession(token);
  res.json({ message: 'Logged out' });
});

// 8. Admin Change Password
router.post('/admin/change-password', requireAdmin, async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  if (!username || !oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Missing password verification fields' });
  }

  try {
    const admin = await db.getAdmin(username);
    if (!admin) {
      return res.status(404).json({ error: 'Admin account not found' });
    }

    const hash = db.hashPassword(oldPassword, admin.salt);
    if (hash !== admin.password_hash) {
      return res.status(401).json({ error: 'Incorrect current password' });
    }

    await db.updateAdminPassword(username, newPassword);
    res.json({ message: 'Password updated successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update admin password' });
  }
});

// 9. Admin Get Orders
router.get('/admin/orders', requireAdmin, async (req, res) => {
  try {
    const orders = await db.getOrders();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve admin orders list' });
  }
});

// 10. Admin Update Order Status
router.put('/admin/orders/:id', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Order status required' });
  }

  try {
    const success = await db.updateOrderStatus(req.params.id, status);
    if (success) {
      res.json({ message: `Order status updated to "${status}"` });
    } else {
      res.status(404).json({ error: 'Order not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// 11. Admin Get Bookings
router.get('/admin/bookings', requireAdmin, async (req, res) => {
  try {
    const bookings = await db.getBookings();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve bookings roster' });
  }
});

// 12. Admin Get Clients
router.get('/admin/clients', requireAdmin, async (req, res) => {
  try {
    const clients = await db.getClients();
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: 'Failed to compile unique client metrics' });
  }
});

// 13. Admin Send Email
router.post('/admin/send-email', requireAdmin, async (req, res) => {
  const { to, subject, message } = req.body;
  if (!to || !subject || !message) {
    return res.status(400).json({ error: 'Email recipient, subject, and message body required' });
  }

  try {
    // Generate full-page styled email for the client
    const emailHtml = `
      <div style="font-family: sans-serif; color: #444; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
        <h2 style="color: #2c3e50; font-family: serif; border-bottom: 2px solid #2c3e50; padding-bottom: 10px; margin-top: 0;">So You Cosmetics Genève</h2>
        <div style="font-size: 15px; line-height: 1.6; margin: 20px 0; color: #333;">
          ${message.replace(/\n/g, '<br />')}
        </div>
        <div style="border-top: 1px solid #eee; padding-top: 15px; margin-top: 30px; font-size: 12px; color: #888;">
          <p style="margin: 0 0 5px 0;"><strong>Boutique Soap Opera by So You Cosmetics</strong></p>
          <p style="margin: 0 0 5px 0;">3 av. Pictet-De-Rochemont, 1207 Genève</p>
          <p style="margin: 0;">Téléphone : <a href="tel:+41225566992" style="color: #888; text-decoration: none;">022 556 69 92</a> | Email : <a href="mailto:contact@soyoucosmetics.com" style="color: #888; text-decoration: none;">contact@soyoucosmetics.com</a></p>
        </div>
      </div>
    `;
    
    const result = await emailService.sendMail({
      to,
      subject,
      html: emailHtml
    });
    
    res.json({ message: 'Email sent successfully!', result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send client email' });
  }
});

// 13b. Admin Get SumUp Settings (safe view — API key is never returned, only last4)
router.get('/admin/settings/sumup', requireAdmin, (req, res) => {
  try {
    const cfg = db.getSumupConfig();
    const apiKey = cfg.apiKey || '';
    res.json({
      apiKeyConfigured: !!apiKey,
      apiKeyLast4: apiKey ? apiKey.slice(-4) : null,
      merchantEmail: cfg.merchantEmail || '',
      webhookSecretConfigured: !!cfg.webhookSecret
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read SumUp settings' });
  }
});

// 13c. Admin Update SumUp Settings
// Body may include any subset of: apiKey, merchantEmail, webhookSecret.
// Empty string clears that setting. Missing keys are left unchanged.
router.put('/admin/settings/sumup', requireAdmin, (req, res) => {
  try {
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(req.body, 'apiKey')) {
      patch.SUMUP_API_KEY = req.body.apiKey;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'merchantEmail')) {
      patch.SUMUP_MERCHANT_EMAIL = req.body.merchantEmail;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'webhookSecret')) {
      patch.SUMUP_WEBHOOK_SECRET = req.body.webhookSecret;
    }
    db.updateSettings(patch);
    const cfg = db.getSumupConfig();
    res.json({
      message: 'SumUp settings updated',
      apiKeyConfigured: !!cfg.apiKey,
      apiKeyLast4: cfg.apiKey ? cfg.apiKey.slice(-4) : null,
      merchantEmail: cfg.merchantEmail || '',
      webhookSecretConfigured: !!cfg.webhookSecret
    });
  } catch (err) {
    console.error('SumUp settings update failed:', err);
    res.status(500).json({ error: 'Failed to update SumUp settings' });
  }
});

// 13d. Admin Get Inbox Settings (status only — password never returned)
router.get('/admin/settings/inbox', requireAdmin, (req, res) => {
  try {
    const cfg = db.getInboxConfig();
    res.json({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure !== false && cfg.secure !== 'false',
      user: cfg.user,
      passConfigured: !!cfg.pass
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read inbox settings' });
  }
});

// 13e. Admin Update Inbox Settings — any subset; empty string clears.
router.put('/admin/settings/inbox', requireAdmin, (req, res) => {
  try {
    const patch = {};
    const map = { host: 'IMAP_HOST', port: 'IMAP_PORT', secure: 'IMAP_SECURE', user: 'IMAP_USER', pass: 'IMAP_PASS' };
    for (const [k, dbKey] of Object.entries(map)) {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) {
        const val = req.body[k];
        patch[dbKey] = typeof val === 'boolean' ? String(val) : val;
      }
    }
    db.updateSettings(patch);
    const cfg = db.getInboxConfig();
    res.json({
      message: 'Paramètres boîte de réception mis à jour',
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure !== false && cfg.secure !== 'false',
      user: cfg.user,
      passConfigured: !!cfg.pass
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update inbox settings' });
  }
});

// 13f. Admin Inbox — list recent messages
router.get('/admin/inbox', requireAdmin, async (req, res) => {
  try {
    if (!imapService.isConfigured()) {
      return res.status(503).json({ error: 'Boîte de réception non configurée. Renseignez les paramètres IMAP.' });
    }
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const messages = await imapService.listMessages({ limit });
    res.json(messages);
  } catch (err) {
    console.error('Inbox list error:', err);
    res.status(500).json({ error: err.message || 'Failed to read inbox' });
  }
});

// 13g. Admin Inbox — single message body
router.get('/admin/inbox/:uid', requireAdmin, async (req, res) => {
  try {
    if (!imapService.isConfigured()) {
      return res.status(503).json({ error: 'Boîte de réception non configurée' });
    }
    const msg = await imapService.getMessage(req.params.uid);
    if (!msg) return res.status(404).json({ error: 'Message introuvable' });
    res.json(msg);
  } catch (err) {
    console.error('Inbox fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch message' });
  }
});

// 13h. Mark order ready — sends "ready for pickup" or "shipped with tracking" email.
// Body: { type: 'pickup' | 'shipped', carrier?, tracking_number? }
router.post('/admin/orders/:id/fulfill', requireAdmin, async (req, res) => {
  const { type, carrier, tracking_number } = req.body || {};
  if (type !== 'pickup' && type !== 'shipped') {
    return res.status(400).json({ error: "type doit être 'pickup' ou 'shipped'" });
  }
  if (type === 'shipped' && (!carrier || !tracking_number)) {
    return res.status(400).json({ error: 'Transporteur et numéro de suivi requis pour un envoi' });
  }

  try {
    const order = await db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Commande introuvable' });

    const fulfillment = {
      type,
      carrier: type === 'shipped' ? carrier : null,
      tracking_number: type === 'shipped' ? tracking_number : null,
      marked_ready_at: new Date().toISOString()
    };
    const newStatus = type === 'pickup' ? 'ReadyForPickup' : 'Shipped';
    const updated = await db.updateOrderFulfillment(order.id, { ...fulfillment, status: newStatus });
    // Never tell the customer their order shipped if we failed to record it.
    if (!updated) {
      return res.status(500).json({ error: "La commande n'a pas pu être mise à jour ; aucun email n'a été envoyé." });
    }

    const { name: customerName, email: customerEmail } = orderContact(order);
    let subject, html;
    if (type === 'pickup') {
      subject = `Votre commande ${order.id} est prête à être retirée !`;
      html = buildPickupReadyEmail({ name: customerName, orderId: order.id });
    } else {
      subject = `Votre commande ${order.id} est en route ! 📦`;
      html = buildShippedEmail({ name: customerName, orderId: order.id, carrier, trackingNumber: tracking_number });
    }

    let emailSent = false;
    if (customerEmail) {
      try {
        await emailService.sendMail({ to: customerEmail, subject, html });
        emailSent = true;
      } catch (mailErr) {
        console.error('Failed to send fulfillment email:', mailErr);
      }
    } else {
      console.error(`Order ${order.id} has no customer email — fulfillment notification not sent.`);
    }

    res.json({
      message: emailSent ? 'Commande mise à jour et email envoyé' : "Commande mise à jour, mais l'email n'a pas pu être envoyé.",
      emailSent,
      order: updated
    });
  } catch (err) {
    console.error('Fulfillment error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la commande' });
  }
});

// 14. Admin Get Workshops
router.get('/admin/workshops', requireAdmin, async (req, res) => {
  try {
    const workshops = await db.getWorkshops();
    res.json(workshops);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve workshops' });
  }
});

// 15. Admin Create Workshop
router.post('/admin/workshops', requireAdmin, async (req, res) => {
  try {
    const workshop = await db.createWorkshop(req.body);
    res.status(201).json(workshop);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create workshop' });
  }
});

// 16. Admin Update Workshop
router.put('/admin/workshops/:id', requireAdmin, async (req, res) => {
  try {
    const workshop = await db.updateWorkshop(req.params.id, req.body);
    res.json(workshop);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update workshop' });
  }
});

// 17. Admin Delete Workshop
router.delete('/admin/workshops/:id', requireAdmin, async (req, res) => {
  try {
    await db.deleteWorkshop(req.params.id);
    res.json({ message: 'Workshop deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete workshop' });
  }
});

// 18. Admin List Products
router.get('/admin/products', requireAdmin, async (req, res) => {
  try {
    const products = await db.getProducts();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve products' });
  }
});

// 19. Admin Create Product
router.post('/admin/products', requireAdmin, async (req, res) => {
  try {
    if (!req.body || !req.body.name) {
      return res.status(400).json({ error: 'Le nom du produit est requis' });
    }
    const product = await db.createProduct(req.body);
    res.status(201).json(product);
  } catch (err) {
    console.error('createProduct error', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// 20. Admin Update Product
router.put('/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const product = await db.updateProduct(req.params.id, req.body);
    res.json(product);
  } catch (err) {
    if (err && err.message === 'Product not found') {
      return res.status(404).json({ error: 'Produit introuvable' });
    }
    console.error('updateProduct error', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// 21. Admin Delete Product
router.delete('/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    await db.deleteProduct(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('deleteProduct error', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// 22. Admin Upload Product Image
// Accepts { data: <base64 data-URL or raw base64>, filename } and saves it as a
// file under server/data/uploads, returning its public /uploads/<name> URL.
const UPLOAD_MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
router.post('/admin/products/upload-image', requireAdmin, async (req, res) => {
  try {
    const { data, filename } = req.body || {};
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'Aucune image reçue' });
    }
    // Accept "data:image/png;base64,XXXX" or raw base64.
    let mime = 'image/png';
    let b64 = data;
    const m = data.match(/^data:([^;]+);base64,(.*)$/s);
    if (m) { mime = m[1].toLowerCase(); b64 = m[2]; }
    const ext = UPLOAD_MIME_EXT[mime];
    if (!ext) {
      return res.status(400).json({ error: 'Format non supporté (PNG, JPG, WEBP ou GIF uniquement)' });
    }
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length) return res.status(400).json({ error: 'Image vide ou invalide' });
    if (buf.length > 12 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image trop volumineuse (max 12 Mo)' });
    }
    ensureUploadsDir();
    const safeBase = String(filename || 'image').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'image';
    const name = `${safeBase}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, name), buf);
    res.status(201).json({ url: `/uploads/${name}` });
  } catch (err) {
    console.error('upload-image error', err);
    res.status(500).json({ error: "Échec du téléversement de l'image" });
  }
});

module.exports = router;

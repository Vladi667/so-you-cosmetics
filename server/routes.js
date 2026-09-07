const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('./db');
const emailService = require('./email');
const imapService = require('./imap');

// Directory for admin-uploaded product images (served at /uploads by index.js).
const { UPLOADS_DIR, ensureUploadsDir, empreinteContenu, fichierExistant } = require('./uploads');
const comptes = require('./comptes');
const infolettre = require('./infolettre');
const rebonds = require('./rebonds');

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
// L'adresse de livraison sur la facture.
//
// Elle figurait dans l'administration et dans l'avis qu'elle reçoit, mais pas
// sur le document que la cliente reçoit — celui qui « tient lieu de facture
// acquittée ». Une facture d'envoi qui ne dit pas où le colis est parti est
// incomplète, et c'est la pièce qu'on garde.
//
// Rien pour un retrait en boutique : il n'y a pas eu d'expédition.
function adresseFacture(order) {
  const a = order && order.address;
  if (!a || !a.line1) return '';
  const lignes = [
    escapeForEmail(a.line1),
    a.line2 ? escapeForEmail(a.line2) : '',
    `${escapeForEmail(a.zip || '')} ${escapeForEmail(a.city || '')}`.trim(),
    a.country && a.country !== 'CH' ? escapeForEmail(a.country) : '',
  ].filter(Boolean);
  return `<p style="margin:0 0 4px;color:#6A6157;font-size:13px;line-height:1.5;">${lignes.join('<br>')}</p>`;
}

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
      ${adresseFacture(order)}
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

function buildPaymentConfirmedEmail({ name, orderId, total, retrait }) {
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
        <p>${retrait
          ? 'Vous recevrez un nouveau message dès que votre commande sera prête pour le retrait.'
          : "Vous recevrez un nouveau message dès l'expédition."}</p>
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
          <p style="margin: 0 0 6px 0;">Boutique Soap Opera by So You Cosmetics<br />3 av. Pictet-de-Rochemont, 1207 Genève</p>
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
  const lignes = [];

  for (const line of items || []) {
    const product = byId.get(String(line.id));
    if (!product) continue;                       // ligne inconnue : ignorée, jamais facturée
    // Une fiche sans prix ne s'achète pas : c'est un « sur devis », pas un
    // article à zéro franc. Quatre existent au catalogue, et sans cette garde
    // un panier n'en contenant qu'elles passait pour le seul prix du port.
    // Une fiche qui propose des contenances porte son prix sur chacune, et le
    // prix de tête n'est qu'un repère. La garde du « sur devis » ne doit donc
    // s'appliquer qu'aux fiches sans contenance, sinon un produit décliné et
    // sans prix nu ne s'achèterait plus du tout.
    const aDesVariantes = Array.isArray(product.variantes) && product.variantes.length > 0;
    if (!aDesVariantes && !(Number(product.price) > 0)) continue;

    // La variante de recharge. Le navigateur DEMANDE une recharge ; c'est le
    // catalogue qui en donne le prix, et seulement si la fiche en propose une.
    // Une demande de recharge sur un produit qui n'en a pas retombe sur le
    // prix plein — jamais sur un montant que le navigateur aurait choisi.
    // Booléen explicite : `line.recharge && …` rend *undefined* quand le champ
    // manque, et JSON.stringify efface une clé undefined. La commande partait
    // donc sans drapeau, et le compteur de flacons remplis lit ce drapeau.
    const recharge = Boolean(line.recharge) && Number(product.rechargePrix) > 0;

    // La contenance choisie, si la fiche en propose. Même règle que la
    // recharge, et pour la même raison : le navigateur DEMANDE « 50 ml », le
    // catalogue en donne le prix. Un identifiant inconnu — onglet resté ouvert
    // après qu'elle a modifié ses contenances, ou requête forgée — retombe sur
    // une variante réelle, jamais sur un montant venu du navigateur.
    const variantes = Array.isArray(product.variantes) ? product.variantes : [];
    const demandee = line.varianteId
      ? variantes.find((v) => String(v.id) === String(line.varianteId))
      : null;
    // Une fiche qui propose des contenances n'a plus de prix « nu » : commander
    // sans en choisir une facturerait un montant ne correspondant à aucun
    // article réel. On retient alors la première, celle qu'elle a saisie en
    // tête.
    const variante = demandee || (variantes.length > 0 ? variantes[0] : null);

    const price = recharge
      ? Number(product.rechargePrix)
      : (variante ? Number(variante.prix) : (Number(product.price) || 0));
    const qty = Math.max(1, parseInt(line.qty, 10) || 1);

    // La ligne commandée porte le poids de la contenance retenue, pas celui de
    // la fiche. C'est ce poids qui décide de la limite des 2 kg, donc des modes
    // d'expédition proposés : facturer un envoi de 15 ml au poids d'un pot de
    // 200 ml refuserait des tarifs auxquels la commande a droit — ou pire,
    // accepterait un colis trop lourd que La Poste renverrait.
    produitsCommandes.push({
      produit: variante && variante.poids ? { ...product, poids: variante.poids } : product,
      qty,
    });

    // La ligne telle qu'elle sera ENREGISTREE. Jusqu'ici la commande gardait
    // les lignes envoyées par le navigateur : le total était juste, mais le nom
    // et le prix inscrits au dossier étaient ceux qu'on avait bien voulu
    // envoyer. Avec des contenances, le défaut devient concret — « Absolute Gel
    // Crème » sans format, et elle ne sait pas quel pot mettre dans le colis.
    lignes.push({
      id: product.id,
      // Le nom dit ce qu'il y a à préparer. Une recharge se remplit, elle ne
      // se vend pas neuve : jusqu'ici rien ne la distinguait dans le tableau
      // des commandes, sinon un prix plus bas qu'il fallait reconnaître.
      name: recharge
        ? `${product.name} — recharge`
        : (variante ? `${product.name} — ${variante.libelle}` : product.name),
      qty,
      price,
      recharge,
      varianteId: variante ? variante.id : null,
    });

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
    lignes,
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
      // Ni les paniers abandonnés, ni les commandes écartées : une commande
      // d'essai annulée ne doit pas continuer de compter des flacons remplis
      // sur la page d'accueil.
      .filter((c) => !['Pending', 'Cancelled', 'Refunded'].includes(db.canonicalOrderStatus(c.status)))
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
  const { name, email, phone, company, items, shippingId, address, cadeau, cgvAcceptees } = req.body;
  if (!name || !email || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required order details' });
  }

  // Accepter les conditions générales conditionne la vente, pas seulement le
  // bouton. La case bloquait l'envoi dans le navigateur et rien d'autre : le
  // serveur acceptait une commande sans savoir si elle avait été cochée, et
  // n'en gardait aucune trace. Vérifié ici, et daté dans la commande — c'est
  // ce qu'on présente si une commande est contestée.
  if (cgvAcceptees !== true) {
    return res.status(400).json({
      error: "Merci d'accepter les conditions générales de vente pour valider la commande.",
      champs: ['cgv'],
    });
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
      // Les lignes du CATALOGUE, pas celles du navigateur : mêmes noms, mêmes
      // prix et mêmes formats que ceux qui viennent d'être facturés.
      name, email, items: calcul.lignes, total,
      // Facultatifs tous les deux. Coupés à une longueur raisonnable plutôt que
      // refusés : une commande ne doit pas échouer sur un champ qu'on n'exige
      // pas. Le téléphone sert au transporteur, la société à la facture.
      phone: String(phone || '').trim().slice(0, 40),
      company: String(company || '').trim().slice(0, 120),
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

        // Les trois mêmes suites qu'un vrai paiement. Ce chemin n'envoyait que
        // la confirmation : ni facture, ni avis à la boutique, ni mouvement de
        // stock. Tant que SumUp est configuré cela ne se voit pas — mais le
        // jour où la clé expire ou est retirée, le site continuerait d'encaisser
        // en apparence tout en cessant silencieusement de facturer, de la
        // prévenir et de décompter ce qui part.
        await envoyerConfirmationEtFacture(newOrder, email, name);
        await avertirNouvelleCommande(newOrder);
        await appliquerStockEtAlerter(newOrder);
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
    await envoyerConfirmationEtFacture(order, email, name);
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

// La photo de chaque article, à côté de son nom.
//
// Sa demande : « sur les alertes commandes reçues en interne — tableau de bord
// et courriel — les images des produits à côté des noms. » Une commande de six
// lignes se lit d'un coup d'œil quand elle est illustrée ; en liste de noms,
// il faut la déchiffrer.
//
// L'image N'EST PAS prise dans la commande : le navigateur n'envoie que
// l'identifiant, le nom, la quantité et le prix. Elle est cherchée dans le
// catalogue par identifiant, comme le serveur le fait déjà pour recalculer les
// prix — le navigateur ne décide pas de ce qui s'affiche dans son courrier.
//
// Conséquence utile : les commandes déjà enregistrées s'illustrent aussi,
// sans migration.
// Le catalogue indexe par identifiant. Sorti a part pour qu'une LISTE de
// commandes le lise une seule fois : le relire par commande faisait cinquante
// lectures de fichier pour afficher un tableau de bord.
async function catalogueParId() {
  try {
    // Tout le catalogue : une commande passée sur une fiche depuis retirée doit
    // garder sa vignette.
    const catalogue = await db.getProduitsTous();
    return new Map((catalogue || []).map((p) => [String(p.id), p]));
  } catch (err) {
    // Un catalogue illisible ne doit pas empêcher l'alerte de partir : mieux
    // vaut une commande sans vignette qu'une commande dont on n'est pas averti.
    console.error('Vignettes de commande : catalogue illisible —', err.message);
    return new Map();
  }
}

async function vignettesParArticle(order, indexFourni) {
  const lignes = Array.isArray(order && order.items) ? order.items : [];
  if (lignes.length === 0) return new Map();

  const parId = indexFourni || await catalogueParId();
  const sortie = new Map();
  for (const ligne of lignes) {
    const p = parId.get(String(ligne && ligne.id));
    if (!p) continue;
    const brut = (Array.isArray(p.images) && p.images[0]) || p.image || '';
    if (!brut) continue;
    // Une messagerie n'a pas de page de référence : un « /uploads/… » n'y
    // résout pas. Même règle que pour les aperçus de partage.
    sortie.set(String(ligne.id), /^https?:\/\//i.test(brut)
      ? brut
      : publicBaseUrl() + (brut.startsWith('/') ? brut : '/' + brut));
  }
  return sortie;
}

// Une ligne d'article pour un courriel.
//
// En tableau et non en flex : Outlook ne connaît pas la mise en page moderne,
// et c'est encore la messagerie de bien des commerçants.
//
// La vignette est décorative — alt vide, le nom est juste à côté en texte. La
// plupart des messageries bloquent les images distantes par défaut : la ligne
// doit rester lisible sans elles, et elle l'est.
function ligneArticleEmail(ligne, urlImage) {
  const qte = Math.max(1, parseInt(ligne.qty, 10) || 1);
  const nom = escapeForEmail(ligne.name || ligne.id || '');
  const vignette = urlImage
    ? `<img src="${escapeForEmail(urlImage)}" alt="" width="44" height="44"
           style="display:block;width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid #DED3C4;">`
    : `<div style="width:44px;height:44px;border-radius:6px;background:#F7F3EC;border:1px solid #DED3C4;"></div>`;

  return `
    <tr>
      <td width="44" style="padding:6px 12px 6px 0;vertical-align:middle;">${vignette}</td>
      <td style="padding:6px 0;vertical-align:middle;font-size:14px;color:#3A332B;">
        <strong>${qte} ×</strong> ${nom}
      </td>
    </tr>`;
}

async function avertirNouvelleCommande(order) {
  const { alerts } = db.getShopSettings();
  const destinataire = db.adresseAlerte();
  if (!alerts.onNewOrder || !destinataire) return;

  const vignettes = await vignettesParArticle(order);
  const lignes = (order.items || [])
    .map((it) => ligneArticleEmail(it, vignettes.get(String(it.id))))
    .join('');

  const livraison = order.shipping
    ? `<p><strong>Expédition :</strong> ${escapeForEmail(order.shipping.label || '')}${
        Number(order.shipping.cost) > 0 ? ` (CHF ${Number(order.shipping.cost).toFixed(2)})` : ' — offerte'}</p>`
    : '';

  try {
    await emailService.sendMail({
      to: destinataire,
      subject: `Nouvelle commande payée — CHF ${Number(order.total).toFixed(2)}`,
      html: `
        <div style="font-family:sans-serif;color:#3A332B;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="font-family:serif;font-weight:400;">Commande ${escapeForEmail(order.id)}</h2>
          <p><strong>${escapeForEmail(order.customer_name || '')}</strong> — ${escapeForEmail(order.customer_email || '')}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"
                 style="width:100%;border-collapse:collapse;margin:16px 0;">${lignes}</table>
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
  const destinataire = db.adresseAlerte();
  if (!alerts.onLowStock || !destinataire) return;

  const ruptures = evenements.filter((e) => e.type === 'rupture');
  const bas = evenements.filter((e) => e.type === 'bas');
  const ligne = (e) => `<li><strong>${escapeForEmail(e.nom)}</strong> — ${e.restant === 0 ? 'épuisé' : `${e.restant} restant(s)`}</li>`;

  try {
    await emailService.sendMail({
      to: destinataire,
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
async function envoyerConfirmationEtFacture(order, email, name) {
  if (!email) return;

  const settings = db.getShopSettings();
  const facture = settings.invoice && settings.invoice.enabled;
  // Le numéro est réservé au moment de l'envoi : une commande confirmée deux
  // fois — le webhook puis le retour du navigateur — ne doit pas consommer deux
  // numéros ni envoyer deux fois la même facture.
  let invoiceNumber = order.invoice_number || null;

  try {
    if (facture && !invoiceNumber) {
      invoiceNumber = db.nextInvoiceNumber();
      await db.updateOrderFields(order.id, { invoice_number: invoiceNumber });
      order.invoice_number = invoiceNumber;
    }
  } catch (err) {
    // Une facture qui échoue ne doit pas remettre en cause un paiement encaissé,
    // ni priver la cliente de sa confirmation : on envoie l'un sans l'autre.
    console.error(`Invoice number for order ${order.id} could not be reserved:`, err.message);
    invoiceNumber = null;
  }

  // Un retrait en boutique ne s'expédie pas : la phrase de fin doit le dire.
  const retrait = !db.exigeAdresse(order.shipping && order.shipping.id);

  const corps = buildPaymentConfirmedEmail({
    name, orderId: order.id, total: order.total, retrait,
  }) + (invoiceNumber
    ? `<div style="height:28px"></div>${buildInvoiceHtml({ invoiceNumber, order, settings })}`
    : '');

  try {
    await emailService.sendMail({
      to: email,
      // Deux e-mails arrivaient à la suite : la confirmation, puis la facture.
      // « Je trouve ça plus simple pour le client » — et c'est vrai : une
      // commande, un message, qu'on retrouve d'une seule recherche.
      subject: invoiceNumber
        ? `Votre commande ${order.id} et sa facture ${invoiceNumber} - So You Cosmetics`
        : `Merci pour votre achat ${order.id} - So You Cosmetics`,
      html: corps,
    });
  } catch (err) {
    console.error(`Confirmation for order ${order.id} could not be sent:`, err.message);
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

// Traduire l'allemand depuis l'anglais.
//
// Elle écrit le français et l'anglais ; l'allemand se déduit du second. Trois
// langues à rédiger pour chaque texte, c'est un tiers du travail passé dans une
// langue qu'elle ne parle pas — et c'est ainsi qu'on obtient de l'allemand qu'il
// faut ensuite faire relire.
//
// DeepL plutôt qu'un autre : c'est le meilleur sur l'allemand, et c'est une
// entreprise européenne, ce qui compte pour les textes d'une boutique suisse.
// La clé gratuite couvre 500 000 caractères par mois — les 21 sections du site
// en font quelques dizaines de milliers.
//
// Rien n'est enregistré ici : la route renvoie les traductions, l'interface les
// pose dans le formulaire, et c'est elle qui décide d'enregistrer. Une machine
// ne publie pas toute seule dans une langue que personne ne relit.
const LIMITE_TEXTES = 60;
const LIMITE_CARACTERES = 20000;

// Les chiffres d'un texte doivent survivre à sa traduction.
//
// Éprouvé sur un service gratuit sans clé : « Free delivery on orders over
// CHF 150 » est revenu en « Portofrei ab CHF 20 ». Trois phrases sur quatre
// étaient justes ; la quatrième avait changé le montant, parce que ce service
// renvoie la correspondance mémorisée la plus proche plutôt qu'une traduction.
// L'allemand se lisait parfaitement — seul le prix était faux, et invisible.
//
// Aucun traducteur n'est à l'abri de ce genre d'écart. On compare donc les
// nombres avant et après, et on signale ce qui ne correspond pas plutôt que de
// le publier. Un prix faux dans les CGV allemandes engage la vendeuse.
function chiffresDe(texte) {
  return (String(texte || '').match(/\d[\d'.,\s]*\d|\d/g) || [])
    .map((n) => n.replace(/[^\d]/g, ''))
    .filter(Boolean)
    .sort();
}

function chiffresPreserves(source, traduction) {
  const a = chiffresDe(source);
  const b = chiffresDe(traduction);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

router.post('/admin/traduire', requireAdmin, async (req, res) => {
  const cle = process.env.DEEPL_API_KEY;
  if (!cle) {
    return res.status(503).json({
      error: "La traduction automatique n'est pas configurée.",
      détail: "Il manque une clé DeepL (DEEPL_API_KEY) dans les réglages du serveur. "
        + "Un compte gratuit sur deepl.com/pro-api suffit : 500 000 caractères par mois, "
        + "soit bien plus que les textes du site.",
    });
  }

  const textes = Array.isArray(req.body && req.body.textes) ? req.body.textes : [];
  const source = String((req.body && req.body.source) || 'EN').toUpperCase();
  const cible = String((req.body && req.body.cible) || 'DE').toUpperCase();

  // On ne traduit que ce qui a du contenu, et on garde la position d'origine
  // pour reposer chaque réponse en face de sa demande.
  const aTraduire = [];
  textes.forEach((t, i) => {
    const v = String(t == null ? '' : t).trim();
    if (v) aTraduire.push({ i, v });
  });

  if (aTraduire.length === 0) return res.json({ traductions: textes.map(() => '') });
  if (aTraduire.length > LIMITE_TEXTES) {
    return res.status(400).json({ error: `Trop de textes d'un coup (${aTraduire.length}, maximum ${LIMITE_TEXTES}).` });
  }
  const total = aTraduire.reduce((n, x) => n + x.v.length, 0);
  if (total > LIMITE_CARACTERES) {
    return res.status(400).json({ error: `Trop de caractères d'un coup (${total}, maximum ${LIMITE_CARACTERES}).` });
  }

  try {
    const axios = require('axios');
    const params = new URLSearchParams();
    params.append('source_lang', source);
    params.append('target_lang', cible);
    // « more » plutôt que « less » : le vouvoiement, qui est le registre du site.
    params.append('formality', 'prefer_more');
    aTraduire.forEach((x) => params.append('text', x.v));

    // Une clé gratuite se termine par « :fx » et vit sur un autre domaine.
    const base = cle.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
    const reponse = await axios.post(`${base}/v2/translate`, params, {
      headers: {
        Authorization: `DeepL-Auth-Key ${cle}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 20000,
    });

    const rendus = (reponse.data && reponse.data.translations) || [];
    const sortie = textes.map(() => '');
    const suspects = [];
    aTraduire.forEach((x, k) => {
      if (!rendus[k] || typeof rendus[k].text !== 'string') return;
      const t = rendus[k].text;
      if (!chiffresPreserves(x.v, t)) {
        // On le rend quand même, mais on le nomme : elle doit savoir lequel
        // relire, pas découvrir un prix faux dans six mois.
        suspects.push({ source: x.v.slice(0, 80), traduction: t.slice(0, 80) });
      }
      sortie[x.i] = t;
    });
    res.json({ traductions: sortie, traduits: rendus.length, suspects });
  } catch (err) {
    const code = err.response && err.response.status;
    // 456 : le quota du mois est épuisé. 403 : la clé est refusée. Les nommer
    // évite de chercher dans les journaux ce que DeepL dit déjà.
    if (code === 456) {
      return res.status(503).json({ error: "Le quota DeepL du mois est épuisé. La traduction reprendra le mois prochain." });
    }
    if (code === 403) {
      return res.status(503).json({ error: "La clé DeepL est refusée. Vérifiez qu'elle est correcte et toujours active." });
    }
    console.error('Traduction impossible :', err.message);
    res.status(502).json({ error: "Le service de traduction n'a pas répondu. Réessayez dans un instant." });
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

  // Les tarifs postaux sont sur le chemin de l'argent : un prix illisible
  // enregistré, et toute commande part au mauvais montant. On refuse plutôt que
  // de laisser passer une valeur qu'on devrait ensuite interpréter.
  //
  // Les identifiants ne se modifient pas : trois règles s'y appuient — l'adresse
  // exigée hors retrait, les tarifs réservés aux bons cadeaux, et la limite des
  // deux kilos. Renommer « priority » romprait les trois en silence.
  if (patch.shipping !== undefined) {
    const exp = patch.shipping;
    if (!exp || typeof exp !== 'object') {
      return res.status(400).json({ error: "Format des frais de port invalide" });
    }
    if (exp.freeFrom !== undefined && exp.freeFrom !== null) {
      const seuil = Number(exp.freeFrom);
      if (!Number.isFinite(seuil) || seuil < 0) {
        return res.status(400).json({ error: "Le seuil de livraison offerte doit être un montant." });
      }
    }
    if (exp.options !== undefined) {
      if (!Array.isArray(exp.options) || exp.options.length === 0) {
        return res.status(400).json({ error: "La liste des modes d'expédition ne peut pas être vide." });
      }
      const connus = new Set((db.getShopSettings().shipping.options || []).map((o) => String(o.id)));
      for (const o of exp.options) {
        if (!o || !connus.has(String(o.id))) {
          return res.status(400).json({ error: "Un mode d'expédition inconnu a été envoyé. Rechargez la page." });
        }
        const prix = Number(o.price);
        if (!Number.isFinite(prix) || prix < 0) {
          return res.status(400).json({ error: `Le prix de « ${String(o.label || o.id)} » doit être un montant.` });
        }
      }
    }
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

// Les inscrites à l'infolettre.
//
// Le formulaire du pied de page les enregistrait depuis le début, et rien ne
// permettait de les relire : ni route, ni écran. Elle collectait des adresses
// personnelles qu'elle ne pouvait ni consulter ni utiliser — une inscription
// promise, jamais honorée, et des données gardées sans usage.
router.get('/admin/newsletter', requireAdmin, async (req, res) => {
  try {
    const liste = await db.getNewsletterSubscribers();
    res.json(Array.isArray(liste) ? liste : []);
  } catch (err) {
    console.error('Lecture des inscriptions impossible :', err.message);
    res.status(500).json({ error: "La liste n'a pas pu être lue." });
  }
});

// Retirer une inscription. C'est ce qui rend tenable le droit d'effacement que
// la politique de confidentialité annonce.
router.delete('/admin/newsletter', requireAdmin, async (req, res) => {
  try {
    const email = String((req.body && req.body.email) || req.query.email || '').trim();
    if (!email) return res.status(400).json({ error: 'Adresse manquante.' });
    const retire = await db.removeNewsletterSubscriber(email);
    if (!retire) return res.status(404).json({ error: 'Cette adresse ne figure pas dans la liste.' });
    res.json({ retire: true, email });
  } catch (err) {
    console.error('Retrait impossible :', err.message);
    res.status(500).json({ error: "Le retrait n'a pas pu être effectué." });
  }
});

// Le même fichier, dans la forme qui se colle dans un outil d'envoi.
router.get('/admin/newsletter/export', requireAdmin, async (req, res) => {
  try {
    const liste = await db.getNewsletterSubscribers();
    const lignes = (Array.isArray(liste) ? liste : []).map((n) => [
      champCsv(typeof n === 'string' ? n : (n.email || '')),
      champCsv(String((n && n.created_at) || '').slice(0, 10)),
    ].join(';'));
    const csv = '\ufeff' + [['E-mail', 'Inscrite le'].join(';'), ...lignes].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="infolettre-so-you.csv"');
    res.send(csv);
  } catch (err) {
    console.error("Export des inscriptions impossible :", err.message);
    res.status(500).json({ error: "L'export n'a pas pu être produit." });
  }
});

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

    // Les accents passent : le fichier porte un BOM, qu'Excel lit comme la
    // marque d'un contenu UTF-8. Sans lui il faudrait les retirer.
    const entetes = ['Date', 'Commande', 'Facture', 'Client', 'E-mail', 'Articles',
                     'Expédition', 'Frais de port', 'Total encaissé', 'Statut'];
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

// L'avis qu'elle reçoit quand quelqu'un réserve un atelier.
//
// La cliente lit « Nous avons le plaisir de vous confirmer votre réservation »
// et note la date. Sans cet avis, personne côté boutique ne l'apprend : on
// pouvait se présenter un samedi matin pour un atelier dont Catherine ignorait
// tout. Le nom de l'atelier est résolu ici, parce qu'un identifiant ne lui dit
// rien.
async function avertirNouvelleReservation({ name, email, workshopId, date, seats, bookingId }) {
  const destinataire = db.adresseAlerte();
  if (!destinataire) return;
  let titre = String(workshopId || '');
  try {
    const ateliers = await db.getWorkshops();
    const trouve = (ateliers || []).find((w) => String(w.id) === String(workshopId));
    if (trouve && trouve.title) titre = trouve.title;
  } catch { /* le titre reste l'identifiant : mieux que rien */ }

  try {
    await emailService.sendMail({
      to: destinataire,
      replyTo: email,
      subject: `Réservation d'atelier — ${date}`,
      html: `
        <div style="font-family:sans-serif;color:#3A332B;max-width:600px;margin:0 auto;padding:24px;">
          <p style="margin:0 0 4px;"><strong>${escapeForEmail(name)}</strong></p>
          <p style="margin:0 0 16px;color:#6A6157;font-size:13px;">${escapeForEmail(email)}</p>
          <p style="margin:0 0 6px;"><strong>${escapeForEmail(titre)}</strong></p>
          <p style="margin:0 0 4px;">Date : ${escapeForEmail(String(date))}</p>
          <p style="margin:0 0 16px;">Places : ${Math.max(1, parseInt(seats, 10) || 1)}</p>
          <p style="color:#888;font-size:12px;">Réservation ${escapeForEmail(String(bookingId || ''))}. Répondre à ce message écrit directement à ${escapeForEmail(email)}.</p>
        </div>`,
    });
  } catch (err) {
    // Une réservation enregistrée et confirmée ne doit pas échouer parce que
    // l'avis n'est pas parti.
    console.error("Avis de réservation non envoyé :", err.message);
  }
}

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
        <h2 style="color: #2c3e50; font-family: serif; border-bottom: 1px solid #eee; padding-bottom: 10px;">Réservation d'atelier confirmée</h2>
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Nous avons le plaisir de vous confirmer votre réservation pour l'atelier cosmétique :</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Date de l'atelier :</strong> ${date}</p>
          <p style="margin: 0 0 10px 0;"><strong>Places réservées :</strong> ${seats || 1}</p>
          <p style="margin: 0;"><strong>Lieu :</strong> Boutique Soap Opera, 3 av. Pictet-de-Rochemont, 1207 Genève</p>
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

    await avertirNouvelleReservation({ name, email, workshopId, date, seats, bookingId: booking.id });

    res.status(201).json({
      message: 'Booking confirmed successfully!',
      bookingId: booking.id
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

// 6. Submit Contact Inquiry
// L'avis qu'elle reçoit quand quelqu'un écrit par le formulaire.
//
// `replyTo` porte l'adresse de la cliente : répondre depuis sa boîte lui écrit
// directement, sans recopier quoi que ce soit. Sans alerte configurée, rien
// n'est envoyé — comme pour les commandes et le stock.
async function avertirNouveauMessage({ name, email, subject, message }) {
  const destinataire = db.adresseAlerte();
  if (!destinataire) return;
  try {
    await emailService.sendMail({
      to: destinataire,
      replyTo: email,
      subject: `Message du site — ${subject || 'sans objet'}`,
      html: `
        <div style="font-family:sans-serif;color:#3A332B;max-width:600px;margin:0 auto;padding:24px;">
          <p style="margin:0 0 4px;"><strong>${escapeForEmail(name)}</strong></p>
          <p style="margin:0 0 16px;color:#6A6157;font-size:13px;">${escapeForEmail(email)}</p>
          <p style="margin:0 0 6px;"><strong>${escapeForEmail(subject || 'Sans objet')}</strong></p>
          <p style="white-space:pre-wrap;line-height:1.6;">${escapeForEmail(message)}</p>
          <p style="color:#888;font-size:12px;margin-top:20px;">Répondre à ce message écrit directement à ${escapeForEmail(email)}.</p>
        </div>`,
    });
  } catch (err) {
    // Un avis qui échoue ne doit pas faire perdre le message : il est déjà
    // enregistré, et la cliente a déjà son accusé de réception.
    console.error('Avis de nouveau message non envoyé :', err.message);
  }
}

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

    // Et la prévenir, elle.
    //
    // Le formulaire enregistrait le message et accusait réception à la cliente
    // — puis s'arrêtait là. Personne n'avertissait la boutique. La cliente
    // lisait « Notre équipe vous répondra dans les plus brefs délais » pendant
    // que sa demande dormait dans un fichier, visible seulement si Catherine
    // pensait à ouvrir l'onglet Messages. C'est la même adresse d'alerte que
    // pour les commandes et les ruptures de stock.
    await avertirNouveauMessage({ name, email, subject, message });

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
    // Chaque ligne recoit la photo de son produit, cherchee au catalogue par
    // identifiant. Le tableau de bord et le courriel d'alerte lisent ainsi la
    // meme source : une commande illustree se lit d'un coup d'oeil, une liste
    // de noms se dechiffre.
    //
    // Les commandes deja enregistrees en profitent aussi : rien n'est stocke,
    // tout est resolu a la lecture.
    const index = await catalogueParId();
    const illustrees = [];
    for (const order of orders || []) {
      const vignettes = await vignettesParArticle(order, index);
      illustrees.push(vignettes.size === 0 ? order : {
        ...order,
        items: (order.items || []).map((it) => ({
          ...it,
          image: vignettes.get(String(it.id)) || null,
        })),
      });
    }
    res.json(illustrees);
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

// Supprimer une commande.
//
// Réservée à celles qui ont d'abord été annulées ou remboursées. Ce n'est pas
// une formalité : c'est ce qui rend impossible d'effacer une vraie commande
// d'un seul geste. Il faut l'écarter, la voir écartée, puis décider de
// l'effacer — deux décisions séparées par un rechargement de la liste.
router.delete('/admin/orders/:id', requireAdmin, async (req, res) => {
  try {
    const commande = await db.getOrderById(req.params.id);
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });

    const statut = db.canonicalOrderStatus(commande.status);
    if (!['Cancelled', 'Refunded'].includes(statut)) {
      return res.status(409).json({
        error: "Cette commande n'est ni annulée ni remboursée. Changez d'abord son statut : "
             + 'on ne supprime que ce qui a déjà été écarté.',
      });
    }

    const fait = await db.deleteOrder(req.params.id);
    if (!fait) return res.status(500).json({ error: 'La suppression a échoué ; rien n\'a été retiré.' });
    res.json({ message: 'Commande supprimée.' });
  } catch (err) {
    console.error('deleteOrder error', err);
    res.status(500).json({ error: 'La suppression a échoué' });
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
          <p style="margin: 0 0 5px 0;">3 av. Pictet-de-Rochemont, 1207 Genève</p>
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
    // Tout, y compris les fiches en attente : c'est justement là qu'elle les
    // retrouve pour les remettre en ligne.
    const products = await db.getProduitsTous();
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

    // Renvoyer le fichier déjà là, plutôt qu'en écrire un second identique.
    //
    // Réenvoyer la même photo est un geste banal : on ne l'a pas vue paraître,
    // on recommence. Tant que le nom portait l'heure, ce geste créait un
    // doublon que la galerie affichait deux fois — et que personne ne pouvait
    // distinguer à l'œil, les deux vignettes étant la même image.
    const empreinte = empreinteContenu(buf);
    const deja = fichierExistant(empreinte, ext);
    if (deja) {
      return res.status(200).json({ url: `/uploads/${deja}`, deduplique: true });
    }

    const name = `${safeBase}-${empreinte}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, name), buf);
    res.status(201).json({ url: `/uploads/${name}` });
  } catch (err) {
    console.error('upload-image error', err);
    res.status(500).json({ error: "Échec du téléversement de l'image" });
  }
});

// Les paniers abandonnés.
//
// « Est-ce qu'on peut avoir un suivi des paniers abandonnés ? Même simplement
// pouvoir les voir serait déjà utile. »
//
// Rien de nouveau n'est collecté pour cela, et c'est le point important. Suivre
// ce que des visiteuses anonymes mettent dans leur panier aurait demandé de
// l'enregistrer côté serveur avant qu'elles n'aient rien validé — donc de
// changer la nature des données recueillies, et la politique de
// confidentialité avec.
//
// Ce n'est pas nécessaire : la donnée existe déjà. Une commande naît en
// « Pending » et ne passe en « Paid » qu'au paiement confirmé. Une commande
// restée en attente est donc exactement cela — quelqu'un qui a rempli le
// formulaire, accepté les conditions, été envoyé vers le paiement, et n'est
// jamais revenu. Avec son nom, son adresse et son panier, qu'elle a donnés
// elle-même.
//
// Le délai écarte celles qui sont peut-être en train de payer : une commande
// d'il y a trois minutes n'est pas abandonnée, elle est en cours.
const DELAI_PANIER_ABANDONNE_MS = 60 * 60 * 1000;

router.get('/admin/paniers-abandonnes', requireAdmin, async (req, res) => {
  try {
    const limite = Date.now() - DELAI_PANIER_ABANDONNE_MS;
    const commandes = await db.getOrders();
    const paniers = (commandes || [])
      .filter((c) => db.canonicalOrderStatus(c.status) === 'Pending')
      .filter((c) => new Date(c.created_at).getTime() < limite)
      .map((c) => ({
        id: c.id,
        date: c.created_at,
        nom: c.customer_name,
        email: c.customer_email,
        telephone: c.customer_phone || '',
        total: c.total,
        expedition: c.shipping || null,
        articles: (c.items || []).map((a) => ({ nom: a.name, qty: a.qty, prix: a.price })),
      }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    res.json({ paniers, delaiHeures: DELAI_PANIER_ABANDONNE_MS / 3600000 });
  } catch (err) {
    console.error('Lecture des paniers abandonnés impossible :', err);
    res.status(500).json({ error: 'Les paniers abandonnés n’ont pas pu être lus.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// L'infolettre : rédiger, essayer, envoyer.
//
// L'onglet ne faisait que collecter des adresses ; il n'y avait ni rédaction
// ni envoi. Le travail se fait ici, dans la boutique, plutôt que chez un
// prestataire — avec les précautions que cela impose, décrites en tête de
// server/infolettre.js.
// ─────────────────────────────────────────────────────────────────────────

router.get('/admin/infolettres', requireAdmin, async (req, res) => {
  try {
    res.json({
      lettres: infolettre.lire(),
      inscrites: (await infolettre.destinataires()).length,
    });
  } catch (err) {
    console.error('Lecture des infolettres impossible :', err);
    res.status(500).json({ error: 'Les infolettres n’ont pas pu être lues.' });
  }
});

router.get('/admin/infolettres/:id', requireAdmin, (req, res) => {
  const lettre = infolettre.parId(req.params.id);
  if (!lettre) return res.status(404).json({ error: 'Infolettre introuvable.' });
  res.json(lettre);
});

router.post('/admin/infolettres', requireAdmin, (req, res) => {
  const { sujet, html } = req.body || {};
  res.status(201).json(infolettre.creer({ sujet, html }));
});

router.put('/admin/infolettres/:id', requireAdmin, (req, res) => {
  const r = infolettre.modifier(req.params.id, req.body || {});
  if (!r) return res.status(404).json({ error: 'Infolettre introuvable.' });
  if (r.verrouillee) {
    return res.status(409).json({
      error: 'Cette infolettre est déjà partie : son texte ne peut plus être modifié. Dupliquez-la pour en écrire une nouvelle.',
    });
  }
  res.json(r.lettre);
});

router.delete('/admin/infolettres/:id', requireAdmin, (req, res) => {
  if (!infolettre.supprimer(req.params.id)) {
    return res.status(409).json({ error: 'Impossible de supprimer une infolettre en cours d’envoi.' });
  }
  res.json({ message: 'Infolettre supprimée.' });
});

// Un essai. Une seule adresse, rien n'est verrouillé : on relit son message
// dans une vraie boîte avant de l'envoyer à trois cents personnes.
router.post('/admin/infolettres/:id/essai', requireAdmin, async (req, res) => {
  const { adresse } = req.body || {};
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(String(adresse || '').trim())) {
    return res.status(400).json({ error: 'Indiquez une adresse valide pour l’essai.' });
  }
  const r = await infolettre.envoyer(req.params.id, { base: publicBaseUrl(), essaiVers: adresse.trim() });
  if (r.erreur) return res.status(400).json({ error: r.erreur });
  res.json({ message: 'Essai envoyé à ' + r.vers + '.' });
});

router.post('/admin/infolettres/:id/envoyer', requireAdmin, async (req, res) => {
  const r = await infolettre.envoyer(req.params.id, { base: publicBaseUrl() });
  if (r.erreur) return res.status(400).json({ error: r.erreur });
  // On répond tout de suite : l'envoi continue en arrière-plan, et
  // l'administration suit la progression en relisant la lettre.
  res.status(202).json({
    message: r.dejaFaits > 0
      ? `Reprise de l’envoi : ${r.total - r.dejaFaits} adresse(s) restante(s).`
      : `Envoi lancé vers ${r.total} adresse(s).`,
    total: r.total,
  });
});

router.post('/admin/infolettres/:id/arreter', requireAdmin, (req, res) => {
  if (!infolettre.arreter(req.params.id)) {
    return res.status(409).json({ error: 'Cette infolettre n’est pas en cours d’envoi.' });
  }
  res.json({ message: 'Envoi interrompu. Il pourra être repris là où il s’est arrêté.' });
});

// ── Les rebonds ──────────────────────────────────────────────────────────
//
// Deux moitiés, et il fallait les deux.
//
// La première se règle à l'envoi : quand le serveur refuse tout de suite,
// server/rebonds.js décide si l'adresse est morte ou si c'est le nôtre qui
// tousse — voir ce fichier, la distinction est ce qui fait tout.
//
// La seconde est ici. Un serveur accepte souvent le message, puis renonce et
// renvoie un avis de non-remise quelques minutes plus tard : l'envoi a donc
// « réussi » alors que personne ne l'a lu, et seule la boîte de réception le
// sait. La relève est déclenchée à la main plutôt qu'en tâche de fond : elle
// lit la boîte de la boutique, et ce n'est pas une chose à faire dans le dos
// de quelqu'un.

router.get('/admin/rebonds', requireAdmin, (req, res) => {
  res.json({
    ecartees: rebonds.ecartees(),
    suivies: rebonds.lire().filter((a) => !a.ecartee && a.echecs > 0),
    seuil: rebonds.SEUIL_PASSAGERS,
    boiteConfiguree: imapService.isConfigured(),
  });
});

router.post('/admin/rebonds/relever', requireAdmin, async (req, res) => {
  if (!imapService.isConfigured()) {
    return res.status(400).json({
      error: 'La boîte de réception n’est pas configurée : impossible de relever les avis de non-remise.',
    });
  }
  try {
    const messages = await imapService.listMessages({ limit: 100 });
    const avis = (messages || []).filter((m) => rebonds.estUnAvisDeNonRemise(m));

    const nosDomaines = ['soyoucosmetics.com'];
    const traites = [];
    for (const m of avis) {
      let corps = '';
      try {
        const complet = await imapService.getMessage(m.uid);
        corps = `${complet.text || ''}\n${complet.html || ''}\n${complet.raw || ''}`;
      } catch (_) {
        continue;                       // un message illisible n'arrête pas la relève
      }
      const adresse = rebonds.adresseEnCause(corps, nosDomaines);
      if (!adresse) continue;

      // Le doute profite à l'adresse : sans code d'état lisible, l'avis est
      // traité comme passager. Écarter une cliente réelle sur une devinette
      // coûterait plus cher qu'un rebond détecté un envoi plus tard.
      const code = rebonds.codeDeLAvis(corps);
      const verdict = rebonds.noterEchec(adresse, {
        code,
        message: m.subject || 'Avis de non-remise',
      }, 'boîte de réception');
      traites.push({ adresse, ecartee: verdict.ecartee, definitif: verdict.definitif });
    }

    res.json({
      message: avis.length === 0
        ? 'Aucun avis de non-remise dans les 100 derniers messages.'
        : `${traites.length} adresse(s) relevée(s) sur ${avis.length} avis.`,
      lus: messages.length,
      avis: avis.length,
      traites,
    });
  } catch (err) {
    console.error('Relève des rebonds impossible :', err);
    res.status(500).json({ error: 'La boîte n’a pas pu être lue : ' + err.message });
  }
});

router.post('/admin/rebonds/reintegrer', requireAdmin, (req, res) => {
  const { adresse } = req.body || {};
  if (!rebonds.reintegrer(adresse)) return res.status(404).json({ error: 'Adresse inconnue.' });
  res.json({ message: adresse + ' recevra de nouveau les infolettres.' });
});

router.post('/admin/rebonds/oublier', requireAdmin, async (req, res) => {
  const { adresse } = req.body || {};
  try {
    // Retirée de la liste de diffusion ET de la table des rebonds : c'est le
    // geste « cette adresse n'existe plus, qu'on n'en parle plus ».
    await db.removeNewsletterSubscriber(adresse);
    rebonds.oublier(adresse);
    res.json({ message: adresse + ' a été retirée de la liste.' });
  } catch (err) {
    console.error('Retrait impossible :', err);
    res.status(500).json({ error: 'Le retrait a échoué.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Le désabonnement de la newsletter.
//
// La politique de confidentialité promet depuis le premier jour que « chaque
// newsletter contient un lien de désabonnement ». Ce lien n'existait pas.
// Aucune newsletter n'étant encore partie, personne n'a été lésé — mais il doit
// exister avant le premier envoi, pas après.
//
// Deux chemins, et le second existe parce que le premier ne suffit pas : celle
// qui a supprimé le message ne peut plus cliquer nulle part.
// ─────────────────────────────────────────────────────────────────────────

// Le lien à glisser dans une newsletter. Signé, pour qu'on ne puisse pas
// désabonner une inconnue en devinant son adresse.
function lienDesabonnement(email) {
  const e = encodeURIComponent(String(email || '').trim().toLowerCase());
  return `${publicBaseUrl()}/desabonnement?e=${e}&s=${db.signerEmailNewsletter(email)}`;
}

// Le désabonnement lui-même. En POST, jamais en GET : certains logiciels de
// messagerie visitent les liens d'un message pour les prévisualiser, et un
// désabonnement en GET partirait tout seul, sans que personne l'ait demandé.
router.post('/newsletter/desabonnement', async (req, res) => {
  const { email, signature } = req.body || {};
  if (!db.signatureNewsletterValide(email, signature)) {
    return res.status(400).json({ error: 'Ce lien de désabonnement n’est pas valable. Demandez-en un nouveau.' });
  }
  try {
    await db.removeNewsletterSubscriber(email);
    // On répond la même chose que l'adresse ait été inscrite ou non : sinon la
    // page dit qui est abonnée ici.
    res.json({ message: 'C’est fait : vous ne recevrez plus la newsletter.' });
  } catch (err) {
    console.error('Désabonnement impossible :', err);
    res.status(500).json({ error: 'Le désabonnement a échoué. Écrivez-nous à contact@soyoucosmetics.com.' });
  }
});

// Pour celle qui n'a plus le message : elle donne son adresse, on lui envoie le
// lien signé. Réponse identique dans tous les cas.
router.post('/newsletter/desabonnement/demande', async (req, res) => {
  const { email } = req.body || {};
  const reponse = { message: 'Si cette adresse est inscrite, un message vient de lui être envoyé.' };
  try {
    const inscrites = await db.getNewsletterSubscribers();
    const cible = comptes.normaliserEmail(email);
    const inscrite = (inscrites || []).some((n) => {
      const e = typeof n === 'string' ? n : (n && n.email);
      return comptes.normaliserEmail(e) === cible;
    });
    if (inscrite) {
      await emailService.sendMail({
        to: cible,
        subject: 'Vous désabonner de la newsletter — So You Cosmetics',
        html: gabaritCompte({
          titre: 'Se désabonner',
          bonjour: '',
          texte: 'Voici le lien qui vous retire de notre liste de diffusion.',
          lien: lienDesabonnement(cible),
          libelleLien: 'Me désabonner',
          apres: 'Si vous n’avez rien demandé, ignorez ce message : rien ne change tant que le lien n’est pas ouvert.',
        }),
      });
    }
    res.json(reponse);
  } catch (err) {
    console.error('Demande de désabonnement impossible :', err);
    res.json(reponse);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Les comptes clientes.
//
// Elles peuvent toujours commander sans compte : exiger une inscription avant
// d'acheter fait perdre des ventes, et ce n'est pas ce qu'on cherche ici. Le
// compte sert à RELIRE ce qu'on a déjà commandé.
//
// Une règle traverse toutes ces routes : les commandes ne sont jamais cherchées
// par un identifiant venu du navigateur, mais par l'adresse VÉRIFIÉE du compte
// ouvert. Une cliente ne peut donc demander que ce qui lui appartient, même en
// forgeant la requête.
// ─────────────────────────────────────────────────────────────────────────

// La session cliente, quand il y en a une. N'échoue jamais : les routes qui
// l'exigent le disent elles-mêmes.
function clienteConnectee(req) {
  const entete = String(req.headers.authorization || '');
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7) : null;
  return comptes.compteDeLaSession(jeton);
}

const exigeCompte = (req, res, next) => {
  const compte = clienteConnectee(req);
  if (!compte) return res.status(401).json({ error: 'Connectez-vous pour accéder à votre compte.' });
  req.compte = compte;
  next();
};

// Une adresse plausible et un mot de passe qui vaut la peine d'être haché.
// Douze caractères plutôt qu'une exigence de majuscules et de chiffres : la
// longueur protège, les règles compliquées font écrire « Motdepasse1! ».
function refusInscription({ email, motDePasse }) {
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(String(email || '').trim())) {
    return 'Cette adresse e-mail ne semble pas valide.';
  }
  if (String(motDePasse || '').length < 12) {
    return 'Choisissez un mot de passe d’au moins 12 caractères. Une phrase dont vous vous souvenez fait un très bon mot de passe.';
  }
  return null;
}

function gabaritCompte({ titre, bonjour, texte, lien, libelleLien, apres }) {
  return `
    <div style="font-family:sans-serif;color:#3A332B;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="font-family:serif;font-weight:400;color:#3A332B;">${titre}</h2>
      <p>Bonjour${bonjour ? ' <strong>' + escapeForEmail(bonjour) + '</strong>' : ''},</p>
      <p>${texte}</p>
      <p style="margin:26px 0;">
        <a href="${lien}" style="display:inline-block;padding:12px 24px;background:#3A332B;color:#FDFBF7;text-decoration:none;border-radius:999px;">${libelleLien}</a>
      </p>
      <p style="color:#6A6157;font-size:13px;">${apres}</p>
      <p style="color:#6A6157;font-size:12px;">Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :<br />${lien}</p>
      <p style="font-style:italic;color:#8C8178;font-size:13px;">So You Cosmetics Genève — faits main en Suisse</p>
    </div>`;
}

// Inscription. La réponse est la même que l'adresse soit déjà connue ou non :
// autrement, ce formulaire dirait qui est cliente ici.
router.post('/compte/inscription', async (req, res) => {
  const { email, motDePasse, nom } = req.body || {};
  const refus = refusInscription({ email, motDePasse });
  if (refus) return res.status(400).json({ error: refus });

  try {
    const { deja, compte } = await comptes.creerCompte({ email, motDePasse, nom });
    if (!deja) {
      // Vers l'API, pas vers une page : le lien doit fonctionner depuis
      // n'importe quelle boîte mail, même là où le JavaScript ne tourne pas.
      // La route vérifie, puis renvoie vers la page du compte.
      const lien = `${publicBaseUrl()}/api/compte/verifier/${compte.verif_jeton}`;
      await emailService.sendMail({
        to: compte.email,
        subject: 'Confirmez votre adresse — So You Cosmetics',
        html: gabaritCompte({
          titre: 'Bienvenue',
          bonjour: compte.nom,
          texte: 'Il ne reste qu’à confirmer votre adresse pour ouvrir votre compte et retrouver vos commandes.',
          lien,
          libelleLien: 'Confirmer mon adresse',
          apres: 'Ce lien est valable 24 heures. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : aucun compte ne sera ouvert.',
        }),
      });
    }
    res.status(201).json({
      message: 'Si cette adresse peut recevoir du courrier, un message vient de lui être envoyé. Ouvrez-le pour confirmer votre compte.',
    });
  } catch (err) {
    console.error('Inscription impossible :', err);
    res.status(500).json({ error: 'L’inscription a échoué. Réessayez dans un instant.' });
  }
});

// Le lien reçu par courrier. Répond en HTML : c'est une adresse qu'on ouvre
// depuis sa boîte, pas un appel de l'application.
router.get('/compte/verifier/:jeton', (req, res) => {
  const r = comptes.verifierAdresse(req.params.jeton);
  const vers = (etat) => res.redirect(302, `/compte?verification=${etat}`);
  if (!r) return vers('inconnu');
  if (r.expire) return vers('expire');
  return vers('ok');
});

router.post('/compte/connexion', async (req, res) => {
  const { email, motDePasse } = req.body || {};
  const cle = comptes.normaliserEmail(email) + '|' + (req.ip || '');

  if (comptes.tropDeTentatives(cle)) {
    return res.status(429).json({
      error: 'Trop de tentatives. Patientez un quart d’heure, ou passez par « mot de passe oublié ».',
    });
  }

  try {
    const compte = await comptes.motDePasseValide(email, motDePasse);
    if (!compte) {
      comptes.noterTentative(cle);
      // Une seule phrase pour « adresse inconnue » et « mot de passe faux » :
      // les distinguer dirait à un inconnu quelles adresses sont inscrites.
      return res.status(401).json({ error: 'Adresse ou mot de passe incorrect.' });
    }
    if (!compte.verifie) {
      return res.status(403).json({
        error: 'Votre adresse n’est pas encore confirmée. Ouvrez le message que nous vous avons envoyé.',
        codeNonVerifie: true,
      });
    }
    comptes.oublierTentatives(cle);
    res.json({ jeton: comptes.ouvrirSession(compte.id), cliente: comptes.vueCliente(compte) });
  } catch (err) {
    console.error('Connexion impossible :', err);
    res.status(500).json({ error: 'La connexion a échoué. Réessayez dans un instant.' });
  }
});

router.post('/compte/deconnexion', (req, res) => {
  const entete = String(req.headers.authorization || '');
  if (entete.startsWith('Bearer ')) comptes.fermerSession(entete.slice(7));
  res.json({ message: 'Vous êtes déconnectée.' });
});

router.post('/compte/mot-de-passe-oublie', async (req, res) => {
  const { email } = req.body || {};
  const reponse = {
    message: 'Si un compte existe pour cette adresse, un message vient de lui être envoyé.',
  };
  try {
    const compte = comptes.compteParEmail(email);
    if (compte) {
      const j = comptes.poserJetonReinitialisation(compte);
      await emailService.sendMail({
        to: compte.email,
        subject: 'Réinitialiser votre mot de passe — So You Cosmetics',
        html: gabaritCompte({
          titre: 'Nouveau mot de passe',
          bonjour: compte.nom,
          texte: 'Vous avez demandé à changer le mot de passe de votre compte.',
          lien: `${publicBaseUrl()}/compte/reinitialiser?jeton=${j}`,
          libelleLien: 'Choisir un nouveau mot de passe',
          apres: 'Ce lien est valable une heure et ne peut servir qu’une fois. Si vous n’avez rien demandé, ignorez ce message : votre mot de passe actuel reste valable.',
        }),
      });
    }
    res.json(reponse);
  } catch (err) {
    console.error('Réinitialisation impossible :', err);
    res.json(reponse);   // même réponse : une panne ne doit pas révéler l'existence du compte
  }
});

router.post('/compte/reinitialiser', async (req, res) => {
  const { jeton, motDePasse } = req.body || {};
  if (String(motDePasse || '').length < 12) {
    return res.status(400).json({ error: 'Choisissez un mot de passe d’au moins 12 caractères.' });
  }
  const compte = comptes.compteParJetonReinitialisation(jeton);
  if (!compte) {
    return res.status(400).json({ error: 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.' });
  }
  try {
    await comptes.changerMotDePasse(compte, motDePasse);
    res.json({ message: 'Mot de passe changé. Vous pouvez vous connecter.' });
  } catch (err) {
    console.error('Changement de mot de passe impossible :', err);
    res.status(500).json({ error: 'Le changement a échoué. Réessayez dans un instant.' });
  }
});

// Le compte : les coordonnées, les commandes, les ateliers.
//
// Tout est cherché par l'adresse VÉRIFIÉE de la session — jamais par un
// identifiant fourni par le navigateur.
router.get('/compte', exigeCompte, async (req, res) => {
  try {
    const email = req.compte.email;
    const [commandes, reservations] = await Promise.all([db.getOrders(), db.getBookings()]);

    const siennes = (commandes || [])
      .filter((c) => comptes.normaliserEmail(c.customer_email) === email)
      .map((c) => ({
        id: c.id,
        date: c.created_at,
        statut: db.canonicalOrderStatus(c.status),
        total: c.total,
        facture: c.invoice_number || null,
        expedition: c.shipping || null,
        adresse: c.address || null,
        articles: (c.items || []).map((a) => ({
          nom: a.name, qty: a.qty, prix: a.price, recharge: Boolean(a.recharge),
        })),
      }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    const ateliers = (reservations || [])
      .filter((r) => comptes.normaliserEmail(r.customer_email) === email)
      .map((r) => ({
        id: r.id, atelier: r.workshop_id, date: r.slot_date,
        places: r.seats, statut: r.status,
      }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    res.json({ cliente: comptes.vueCliente(req.compte), commandes: siennes, ateliers });
  } catch (err) {
    console.error('Lecture du compte impossible :', err);
    res.status(500).json({ error: 'Votre compte n’a pas pu être lu. Réessayez dans un instant.' });
  }
});

router.put('/compte', exigeCompte, (req, res) => {
  try {
    const { nom, telephone, adresse } = req.body || {};
    const compte = comptes.majCoordonnees(req.compte, { nom, telephone, adresse });
    res.json({ cliente: comptes.vueCliente(compte) });
  } catch (err) {
    console.error('Mise à jour des coordonnées impossible :', err);
    res.status(500).json({ error: 'L’enregistrement a échoué.' });
  }
});

// Supprimer son compte.
//
// Le mot de passe est redemandé : un onglet resté ouvert sur un ordinateur
// partagé ne doit pas suffire à effacer un compte. C'est le même geste que
// pour se connecter, et il vaut ici comme preuve que c'est bien elle.
//
// Ce qui part : l'adresse, le mot de passe, le téléphone, l'adresse de
// livraison, les sessions. Ce qui reste : les commandes, que la boutique est
// tenue de conserver dix ans — sa politique de confidentialité l'annonce déjà.
router.delete('/compte', exigeCompte, async (req, res) => {
  const { motDePasse } = req.body || {};
  try {
    const verifie = await comptes.motDePasseValide(req.compte.email, motDePasse);
    if (!verifie) {
      return res.status(403).json({ error: 'Mot de passe incorrect. Le compte n’a pas été supprimé.' });
    }
    comptes.supprimerCompte(req.compte.id);
    res.json({
      message: 'Votre compte est supprimé. Vos commandes restent enregistrées : la boutique doit les conserver dix ans.',
    });
  } catch (err) {
    console.error('Suppression de compte impossible :', err);
    res.status(500).json({ error: 'La suppression a échoué. Réessayez dans un instant.' });
  }
});

// Une facture, en page imprimable.
//
// Pas de bibliothèque PDF sur le serveur : le navigateur en fabrique un
// meilleur que ce qu'on écrirait ici, avec « Imprimer → Enregistrer en PDF ».
// C'est une dépendance de moins à installer et à tenir à jour sur l'hôte.
router.get('/compte/facture/:orderId', exigeCompte, async (req, res) => {
  try {
    const commande = await db.getOrderById(req.params.orderId);
    // La commande doit exister ET appartenir à la session. Sans cette seconde
    // condition, changer le numéro dans l'adresse suffirait à lire la facture
    // d'une autre.
    if (!commande || comptes.normaliserEmail(commande.customer_email) !== req.compte.email) {
      return res.status(404).send('Facture introuvable.');
    }
    if (!commande.invoice_number) {
      return res.status(404).send('Cette commande n’a pas encore de facture.');
    }
    const settings = db.getShopSettings();
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html lang="fr"><head><meta charset="utf-8" />
      <title>Facture ${escapeForEmail(commande.invoice_number)} — So You Cosmetics</title>
      <style>body{margin:0;background:#F7F3EC;font-family:sans-serif}
        .barre{padding:16px;text-align:center}
        button{font:inherit;padding:10px 22px;border:0;border-radius:999px;background:#3A332B;color:#FDFBF7;cursor:pointer}
        @media print{.barre{display:none}body{background:#fff}}</style></head>
      <body><div class="barre"><button onclick="window.print()">Imprimer ou enregistrer en PDF</button></div>
      ${buildInvoiceHtml({ invoiceNumber: commande.invoice_number, order: commande, settings })}
      </body></html>`);
  } catch (err) {
    console.error('Facture illisible :', err);
    res.status(500).send('La facture n’a pas pu être produite.');
  }
});

module.exports = router;

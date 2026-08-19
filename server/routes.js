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
function buildPaymentConfirmedEmail({ name, orderId, total }) {
  return `
      <div style="font-family: sans-serif; color: #444; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
        <h2 style="color: #2c3e50; font-family: serif; border-bottom: 1px solid #eee; padding-bottom: 10px;">Merci pour votre achat !</h2>
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Nous avons bien reçu votre paiement. Votre commande chez SoYou Cosmetics Geneva est confirmée et nous préparons vos produits artisanaux.</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Référence de commande :</strong> ${orderId}</p>
          <p style="margin: 0 0 10px 0;"><strong>Statut :</strong> Paiement reçu</p>
          <p style="margin: 0;"><strong>Total :</strong> CHF ${parseFloat(total).toFixed(2)}</p>
        </div>
        <p>Vous recevrez un nouveau message dès l'expédition.</p>
        <p style="font-style: italic; color: #888;">SoYou Cosmetics Geneva - Faits main en Suisse</p>
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
          <p style="margin: 0 0 6px 0;">Boutique Soap Opera by SoYou Cosmetics<br />3 ave. Pictet-De-Rochemont, 1207 Genève</p>
          <p style="margin: 6px 0 0 0;"><strong>Téléphone :</strong> 022 556 69 92</p>
        </div>
        <p>Nous nous réjouissons de vous accueillir prochainement.</p>
        <p style="font-style: italic; color: #888;">L'équipe SoYou Cosmetics Geneva</p>
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
        <p style="font-style: italic; color: #888;">L'équipe SoYou Cosmetics Geneva</p>
      </div>
    `;
}

// 3. Create Order / Checkout
router.post('/orders', async (req, res) => {
  const { name, email, items, total } = req.body;
  if (!name || !email || !items || !total) {
    return res.status(400).json({ error: 'Missing required order details' });
  }

  try {
    const newOrder = await db.createOrder({ name, email, items, total });

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
          description: `Commande ${newOrder.id} - SoYou Cosmetics`,
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
          subject: `Merci pour votre achat ${newOrder.id} - SoYou Cosmetics`,
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
      subject: `Merci pour votre achat ${order.id} - SoYou Cosmetics`,
      html: buildPaymentConfirmedEmail({ name, orderId: order.id, total: order.total })
    });
  } catch (mailErr) {
    // The payment is real either way — never fail the confirmation over email.
    console.error(`SumUp confirmation (${source}): order ${order.id} confirmed but the email failed:`, mailErr);
  }
  return { confirmed: true, status: 'Paid' };
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
          <p style="margin: 0;"><strong>Lieu :</strong> Boutique Soap Opera, 3 ave. Pictet-De-Rochemont, 1207 Genève</p>
        </div>
        <p>Vous repartirez avec votre propre création cosmétique naturelle faite main !</p>
        <p>À très bientôt,</p>
        <p style="font-style: italic; color: #888;">L'équipe SoYou Cosmetics Geneva</p>
      </div>
    `;
    await emailService.sendMail({
      to: email,
      subject: `Votre réservation d'atelier SoYou Cosmetics est confirmée !`,
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
        <p style="font-style: italic; color: #888;">L'équipe SoYou Cosmetics Geneva</p>
      </div>
    `;
    await emailService.sendMail({
      to: email,
      subject: `Nous avons bien reçu votre message - SoYou Cosmetics`,
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
        <h2 style="color: #2c3e50; font-family: serif; border-bottom: 2px solid #2c3e50; padding-bottom: 10px; margin-top: 0;">SoYou Cosmetics Geneva</h2>
        <div style="font-size: 15px; line-height: 1.6; margin: 20px 0; color: #333;">
          ${message.replace(/\n/g, '<br />')}
        </div>
        <div style="border-top: 1px solid #eee; padding-top: 15px; margin-top: 30px; font-size: 12px; color: #888;">
          <p style="margin: 0 0 5px 0;"><strong>Boutique Soap Opera by SoYou Cosmetics</strong></p>
          <p style="margin: 0 0 5px 0;">3 ave. Pictet-De-Rochemont, 1207 Genève</p>
          <p style="margin: 0;">Téléphone : <a href="tel:+41225566992" style="color: #888; text-decoration: none;">022 556 69 92</a> | Email : <a href="mailto:contact@soyou.ch" style="color: #888; text-decoration: none;">contact@soyou.ch</a></p>
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

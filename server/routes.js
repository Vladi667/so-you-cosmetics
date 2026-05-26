const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('./db');
const emailService = require('./email');

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
function verifySumupSignature(req) {
  const secret = process.env.SUMUP_WEBHOOK_SECRET;
  if (!secret) return true; // dev mode
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

// Authentication Middleware
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing admin token' });
  }
  const token = authHeader.split(' ')[1];
  if (token.startsWith('token_admin_')) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
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

// 1. Get Products
router.get('/products', async (req, res) => {
  try {
    const products = await db.getProducts();
    res.json(products);
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
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve product details' });
  }
});

// Email body for the "payment received / order confirmed" message.
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

    // Appeler l'API SumUp pour créer un checkout_id
    if (process.env.SUMUP_API_KEY && process.env.SUMUP_MERCHANT_EMAIL) {
      sumupActive = true;
      try {
        const axios = require('axios');
        const sumupRes = await axios.post('https://api.sumup.com/v0.1/checkouts', {
          checkout_reference: newOrder.id,
          amount: parseFloat(total),
          currency: "CHF",
          pay_to_email: process.env.SUMUP_MERCHANT_EMAIL,
          description: `Commande ${newOrder.id} - SoYou Cosmetics`
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.SUMUP_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        checkoutId = sumupRes.data.id;
      } catch (sumupErr) {
        console.error('SumUp API Error:', sumupErr.response ? sumupErr.response.data : sumupErr.message);
        return res.status(500).json({ error: 'Erreur lors de la création de la session de paiement SumUp.' });
      }
    } else {
      console.warn("SUMUP_API_KEY ou SUMUP_MERCHANT_EMAIL manquant. Utilisation d'un checkout_id simulé.");
    }

    // When SumUp is not yet configured we cannot wait for a real webhook, so
    // treat order-creation itself as the purchase event and send the confirmation
    // email now. Once SUMUP_API_KEY is set in env, this email moves to the
    // /api/sumup/webhook path below (real payment.successful), no other change.
    if (!sumupActive) {
      try {
        await db.updateOrderStatus(newOrder.id, 'paid');
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

// 3b. SumUp Webhook — fired by SumUp once a checkout completes.
// Reference: https://developer.sumup.com/api/webhooks
// We accept POST with JSON body. Configure SUMUP_WEBHOOK_SECRET in env if SumUp
// signs requests; if unset, this endpoint accepts any well-formed payload.
router.post('/sumup/webhook', async (req, res) => {
  if (!verifySumupSignature(req)) {
    console.warn('SumUp webhook rejected: signature mismatch');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body || {};
  const eventType = event.event_type || event.type;
  const payload = event.payload || event.data || event;
  const checkoutRef = payload.checkout_reference || payload.reference || payload.checkout_id;
  const status = (payload.status || '').toLowerCase();

  // Always ack quickly so SumUp doesn't retry
  res.status(200).json({ received: true });

  if (status && status !== 'paid' && status !== 'successful' && eventType !== 'checkout.completed') {
    return; // Not a success event
  }
  if (!checkoutRef) {
    console.warn('SumUp webhook missing checkout_reference', event);
    return;
  }

  try {
    const order = await db.getOrderById(checkoutRef);
    if (!order) {
      console.warn(`SumUp webhook: order ${checkoutRef} not found`);
      return;
    }
    if (order.status === 'paid') {
      // Idempotent: already processed
      return;
    }

    await db.updateOrderStatus(order.id, 'paid');
    await emailService.sendMail({
      to: order.email,
      subject: `Merci pour votre achat ${order.id} - SoYou Cosmetics`,
      html: buildPaymentConfirmedEmail({ name: order.name, orderId: order.id, total: order.total })
    });
  } catch (err) {
    console.error('SumUp webhook handler error:', err);
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
      const token = `token_admin_${username}_${Date.now()}`;
      res.json({ token, username });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Login process encountered an error' });
  }
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

module.exports = router;

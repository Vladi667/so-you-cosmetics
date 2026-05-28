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

const initJsonFile = (filePath, defaultData = []) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
  }
};

initJsonFile(ORDERS_FILE);
initJsonFile(BOOKINGS_FILE);
initJsonFile(CONTACTS_FILE);
initJsonFile(WORKSHOPS_FILE);
initJsonFile(SETTINGS_FILE, {});

// Seed admin in JSON file if it doesn't exist
if (!fs.existsSync(ADMIN_FILE)) {
  const salt = generateSalt();
  const hash = hashPassword('soyoucosmetics', salt);
  const defaultAdmin = {
    username: 'admin',
    password_hash: hash,
    salt: salt
  };
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(defaultAdmin, null, 2), 'utf8');
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
        images TEXT
      )
    `);

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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
        await conn.query(
          'INSERT INTO products (id, name, description, price, ribbon, collections, images) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            prod.id,
            prod.name,
            prod.description,
            prod.price,
            prod.ribbon || null,
            JSON.stringify(prod.collections),
            JSON.stringify(prod.images)
          ]
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

// 1. Get Products
async function getProducts() {
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM products');
      return rows.map(r => ({
        ...r,
        price: parseFloat(r.price),
        collections: typeof r.collections === 'string' ? JSON.parse(r.collections) : r.collections,
        images: typeof r.images === 'string' ? JSON.parse(r.images) : r.images
      }));
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
      if (rows.length > 0) {
        const r = rows[0];
        return {
          ...r,
          price: parseFloat(r.price),
          collections: typeof r.collections === 'string' ? JSON.parse(r.collections) : r.collections,
          images: typeof r.images === 'string' ? JSON.parse(r.images) : r.images
        };
      }
      return null;
    } catch (err) {
      console.error('MySQL getProductById failed, falling back to JSON file', err);
    }
  }
  return productsData.products.find(p => p.id === id) || null;
}

// 3. Create Order
async function createOrder(order) {
  const orderId = 'order_' + Math.random().toString(36).substr(2, 9);
  const newOrder = {
    id: orderId,
    customer_name: order.name,
    customer_email: order.email,
    total: order.total,
    items: order.items,
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
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2), 'utf8');
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
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
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
  fs.writeFileSync(CONTACTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  return newContact;
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
  fs.writeFileSync(WORKSHOPS_FILE, JSON.stringify(workshops, null, 2), 'utf8');
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
    fs.writeFileSync(WORKSHOPS_FILE, JSON.stringify(workshops, null, 2), 'utf8');
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
  fs.writeFileSync(WORKSHOPS_FILE, JSON.stringify(workshops, null, 2), 'utf8');
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
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(adminData, null, 2), 'utf8');
  return true;
}

// 8. Get All Orders
async function getOrders() {
  if (pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
      return rows.map(r => ({
        ...r,
        total: parseFloat(r.total),
        items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items
      }));
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
      const r = rows[0];
      return {
        ...r,
        total: parseFloat(r.total),
        items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
        fulfillment: r.fulfillment ? (typeof r.fulfillment === 'string' ? JSON.parse(r.fulfillment) : r.fulfillment) : null
      };
    } catch (err) {
      console.error('MySQL getOrderById failed, falling back to JSON file', err);
    }
  }

  const data = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  return data.find(o => o.id === orderId) || null;
}

// 9. Update Order Status
async function updateOrderStatus(orderId, status) {
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
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2), 'utf8');
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
function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) || {};
  } catch (_) {
    return {};
  }
}

function writeSettings(next) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf8');
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
    try {
      // We piggy-back on the existing `items` JSON column? No — safer: store as
      // an extra TEXT column added on the fly. For now, the MySQL path stores
      // fulfillment as a JSON-encoded string in a new column we create lazily.
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment TEXT NULL");
      const existing = await getOrderById(orderId);
      if (!existing) return null;
      const merged = { ...(existing.fulfillment || {}), ...patch };
      const status = patch.status || existing.status;
      await pool.query('UPDATE orders SET fulfillment = ?, status = ? WHERE id = ?', [JSON.stringify(merged), status, orderId]);
      return { ...existing, fulfillment: merged, status };
    } catch (err) {
      console.error('MySQL updateOrderFulfillment failed, falling back to JSON file', err);
    }
  }

  const data = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  const order = data.find(o => o.id === orderId);
  if (!order) return null;
  order.fulfillment = { ...(order.fulfillment || {}), ...patch };
  if (patch.status) order.status = patch.status;
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2), 'utf8');
  return order;
}

module.exports = {
  getProducts,
  getProductById,
  getSetting,
  updateSettings,
  getSumupConfig,
  getInboxConfig,
  updateOrderFulfillment,
  createOrder,
  createBooking,
  createContact,
  // Admin DB functions
  getAdmin,
  updateAdminPassword,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getBookings,
  getClients,
  hashPassword,
  getWorkshops,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop
};

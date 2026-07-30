import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('[SECURITY] JWT_SECRET no configurado. Define la variable de entorno JWT_SECRET.');
    process.exit(1);
  }
  return 'reinos-ancestrales-dev-secret';
})();
const DATA_DIR = join(__dirname, 'data');
const DB_FILE = join(DATA_DIR, 'game.db');
const FRONTEND_DIR = join(__dirname, '..', 'dist');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    phone TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    phone TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (phone) REFERENCES users(phone) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    short_description TEXT NOT NULL DEFAULT '',
    banner_url TEXT NOT NULL DEFAULT '',
    lat REAL NOT NULL DEFAULT 0,
    lng REAL NOT NULL DEFAULT 0,
    hours TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS promotions (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    banner_url TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_promotions_store_id ON promotions(store_id);
  CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active);
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    reward_type TEXT NOT NULL DEFAULT 'item',
    reward_id TEXT NOT NULL DEFAULT '',
    reward_name TEXT NOT NULL DEFAULT '',
    reward_rarity TEXT NOT NULL DEFAULT 'comun',
    reward_qty INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
  CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
  CREATE TABLE IF NOT EXISTS promotion_products (
    promotion_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    PRIMARY KEY (promotion_id, product_id),
    FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_promotion_products_promo ON promotion_products(promotion_id);
  CREATE TABLE IF NOT EXISTS invoice_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    product_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE','REDEEMED','CANCELLED','EXPIRED')),
    campaign_id TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    redeemed_at INTEGER,
    redeemed_by TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_invoice_codes_code ON invoice_codes(code);
  CREATE INDEX IF NOT EXISTS idx_invoice_codes_status ON invoice_codes(status);
  CREATE INDEX IF NOT EXISTS idx_invoice_codes_redeemed_by ON invoice_codes(redeemed_by);
  CREATE TABLE IF NOT EXISTS reward_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_phone TEXT NOT NULL,
    invoice_code TEXT NOT NULL,
    reward_type TEXT NOT NULL,
    reward_id TEXT NOT NULL DEFAULT '',
    reward_name TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_reward_history_user ON reward_history(user_phone);
  CREATE INDEX IF NOT EXISTS idx_reward_history_created ON reward_history(created_at);
`);

function seedStores() {
  const existing = db.prepare('SELECT COUNT(*) AS cnt FROM stores').get();
  if (existing && existing.cnt > 0) return;

  const insertStore = db.prepare(`INSERT INTO stores (id, name, logo_url, category, city, description, short_description, banner_url, lat, lng, hours, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertPromotion = db.prepare(`INSERT INTO promotions (id, store_id, name, description, banner_url, start_date, end_date, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertProduct = db.prepare(`INSERT INTO products (id, store_id, name, description, image_url, price, currency, reward_type, reward_id, reward_name, reward_rarity, reward_qty, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertPP = db.prepare(`INSERT INTO promotion_products (promotion_id, product_id) VALUES (?, ?)`);

  const stores = [
    { id: 'hamburguesas-reino', name: 'Hamburguesas del Reino', logo_url: '/icons/store-hamburguesa.svg', category: 'comida_rapida', city: 'Madrid', description: 'Las mejores hamburguesas artesanales del reino. Ingredientes frescos y sabor ancestral.', short_description: 'Hamburguesas artesanales', banner_url: '', lat: 40.4168, lng: -3.7038, hours: '12:00-23:00' },
    { id: 'pizzeria-imperial', name: 'Pizzería Imperial', logo_url: '/icons/store-pizza.svg', category: 'restaurante', city: 'Barcelona', description: 'Pizzas al horno de leña con ingredientes importados directamente del imperio.', short_description: 'Pizzas al horno de leña', banner_url: '', lat: 41.3874, lng: 2.1686, hours: '13:00-23:30' },
    { id: 'heladeria-dragon', name: 'Heladería Dragón Azul', logo_url: '/icons/store-helado.svg', category: 'postres', city: 'Valencia', description: 'Helados artesanales de sabores exóticos. El dragón azul te espera.', short_description: 'Helados artesanales', banner_url: '', lat: 39.4699, lng: -0.3763, hours: '11:00-22:00' },
    { id: 'cafe-medieval', name: 'Café Medieval', logo_url: '/icons/store-cafe.svg', category: 'cafeteria', city: 'Sevilla', description: 'Cafés de especialidad y repostería medieval en un ambiente único.', short_description: 'Café de especialidad', banner_url: '', lat: 37.3891, lng: -5.9845, hours: '08:00-21:00' },
    { id: 'panaderia-bosque', name: 'Panadería del Bosque', logo_url: '/icons/store-pan.svg', category: 'panaderia', city: 'Granada', description: 'Pan artesano horneado con leña del bosque. Recetas tradicionales con un toque mágico.', short_description: 'Pan artesano', banner_url: '', lat: 37.1773, lng: -3.5986, hours: '07:00-20:00' },
  ];
  for (const s of stores) {
    insertStore.run(s.id, s.name, s.logo_url, s.category, s.city, s.description, s.short_description, s.banner_url, s.lat, s.lng, s.hours, 1);
  }

  const now = new Date();
  const future = new Date(now); future.setMonth(future.getMonth() + 2);
  const past = new Date(now); past.setMonth(past.getMonth() - 1);

  const promotions = [
    { id: 'promo-hamburguesa-combo', store_id: 'hamburguesas-reino', name: 'Combo Ancestral', description: 'Hamburguesa + Patatas + Bebida + Personaje exclusivo "Caballero Burger"', banner_url: '', start_date: now.toISOString(), end_date: future.toISOString(), products: ['prod-burger-combo'] },
    { id: 'promo-pizza-familiar', store_id: 'pizzeria-imperial', name: 'Pizza Familiar + Recompensa', description: 'Pizza familiar grande más una bebida y obtén la Espada Legendaria de Fuego', banner_url: '', start_date: now.toISOString(), end_date: future.toISOString(), products: ['prod-pizza-familiar'] },
    { id: 'promo-helado-duo', store_id: 'heladeria-dragon', name: 'Dúo de Helados', description: 'Dos bolas de helado + Cristales de Dragón como regalo', banner_url: '', start_date: past.toISOString(), end_date: future.toISOString(), products: ['prod-helado-duo'] },
    { id: 'promo-cafe-especial', store_id: 'cafe-medieval', name: 'Café Premium', description: 'Café de especialidad + pastelería + 500 monedas de oro', banner_url: '', start_date: now.toISOString(), end_date: future.toISOString(), products: ['prod-cafe-premium'] },
    { id: 'promo-pan-artesano', store_id: 'panaderia-bosque', name: 'Pan del Bosque', description: 'Pan artesano + bollería variada + personaje "Duende Panadero"', banner_url: '', start_date: past.toISOString(), end_date: future.toISOString(), products: ['prod-pan-artesano'] },
  ];
  for (const p of promotions) {
    insertPromotion.run(p.id, p.store_id, p.name, p.description, p.banner_url, p.start_date, p.end_date, 1);
  }

  const products = [
    { id: 'prod-burger-combo', store_id: 'hamburguesas-reino', name: 'Combo Ancestral', description: 'Hamburguesa 200g + patatas + bebida', image_url: '', price: 14.99, currency: 'EUR', reward_type: 'character', reward_id: 'caballero-solar', reward_name: 'Caballero Solar', reward_rarity: 'raro', reward_qty: 1 },
    { id: 'prod-pizza-familiar', store_id: 'pizzeria-imperial', name: 'Pizza Familiar', description: 'Pizza familiar 4 quesos + bebida 2L', image_url: '', price: 22.99, currency: 'EUR', reward_type: 'item', reward_id: 'espada-legendaria-fuego', reward_name: 'Espada Legendaria de Fuego', reward_rarity: 'legendario', reward_qty: 1 },
    { id: 'prod-helado-duo', store_id: 'heladeria-dragon', name: 'Dúo de Helados', description: 'Dos bolas de helado a tu elección', image_url: '', price: 6.99, currency: 'EUR', reward_type: 'crystals', reward_id: 'cristales-dragon', reward_name: 'Cristales de Dragón', reward_rarity: 'epico', reward_qty: 100 },
    { id: 'prod-cafe-premium', store_id: 'cafe-medieval', name: 'Café Premium + Pastelería', description: 'Café de especialidad + pastel artesano', image_url: '', price: 9.99, currency: 'EUR', reward_type: 'currency', reward_id: 'monedas-oro', reward_name: 'Monedas de Oro', reward_rarity: 'comun', reward_qty: 500 },
    { id: 'prod-pan-artesano', store_id: 'panaderia-bosque', name: 'Pan Artesano + Bollería', description: 'Pan de masa madre + 3 piezas de bollería', image_url: '', price: 8.99, currency: 'EUR', reward_type: 'character', reward_id: 'duende-panadero', reward_name: 'Duende Panadero', reward_rarity: 'raro', reward_qty: 1 },
  ];
  for (const p of products) {
    insertProduct.run(p.id, p.store_id, p.name, p.description, p.image_url, p.price, p.currency, p.reward_type, p.reward_id, p.reward_name, p.reward_rarity, p.reward_qty, 1);
  }

  for (const promo of promotions) {
    for (const pid of promo.products) {
      insertPP.run(promo.id, pid);
    }
  }
}

seedStores();

function generateInvoiceCodes() {
  const existing = db.prepare('SELECT COUNT(*) AS cnt FROM invoice_codes').get();
  if (existing && existing.cnt > 0) return;

  const insert = db.prepare('INSERT INTO invoice_codes (code, product_id, status, campaign_id, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)');
  const now = Date.now();
  const codes = [
    { code: 'RA-2026-000001', product_id: 'prod-burger-combo', campaign_id: 'CAMPAIGN-2026-01' },
    { code: 'RA-2026-000002', product_id: 'prod-pizza-familiar', campaign_id: 'CAMPAIGN-2026-01' },
    { code: 'RA-2026-000003', product_id: 'prod-helado-duo', campaign_id: 'CAMPAIGN-2026-01' },
    { code: 'RA-2026-000004', product_id: 'prod-cafe-premium', campaign_id: 'CAMPAIGN-2026-01' },
    { code: 'RA-2026-000005', product_id: 'prod-pan-artesano', campaign_id: 'CAMPAIGN-2026-01' },
    { code: 'RA-2026-000006', product_id: 'prod-burger-combo', campaign_id: 'CAMPAIGN-2026-02' },
    { code: 'RA-2026-000007', product_id: 'prod-pizza-familiar', campaign_id: 'CAMPAIGN-2026-02' },
    { code: 'RA-2026-000008', product_id: 'prod-helado-duo', campaign_id: 'CAMPAIGN-2026-02' },
    { code: 'RA-2026-000009', product_id: 'prod-cafe-premium', campaign_id: 'CAMPAIGN-2026-02' },
    { code: 'RA-2026-000010', product_id: 'prod-pan-artesano', campaign_id: 'CAMPAIGN-2026-02' },
    { code: 'RA-EXP-000001', product_id: 'prod-burger-combo', campaign_id: 'CAMPAIGN-EXPIRED' },
  ];

  const expireTime = now - 365 * 24 * 60 * 60 * 1000;
  const insertMany = db.transaction(() => {
    for (const c of codes) {
      const metadata = JSON.stringify({});
      if (c.code === 'RA-EXP-000001') {
        insert.run(c.code, c.product_id, 'EXPIRED', c.campaign_id, expireTime, metadata);
      } else {
        insert.run(c.code, c.product_id, 'AVAILABLE', c.campaign_id, now, metadata);
      }
    }
  });
  insertMany();
}

generateInvoiceCodes();

// --- Code Generator Service ---

function generateCodes({ campaignId, productId, count, prefix }) {
  const now = Date.now();
  const prefix_ = prefix || 'RA';
  const insert = db.prepare('INSERT INTO invoice_codes (code, product_id, status, campaign_id, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)');
  const batchInsert = db.transaction(() => {
    const results = [];
    for (let i = 0; i < count; i++) {
      const year = new Date().getFullYear();
      const seq = String(i + 1).padStart(6, '0');
      const code = `${prefix_}-${year}-${seq}`;
      try {
        insert.run(code, productId, 'AVAILABLE', campaignId, now, '{}');
        results.push(code);
      } catch {
        // code may already exist, skip
      }
    }
    return results;
  });
  return batchInsert();
}

// --- Reward Delivery ---

const VALID_RESOURCES = ['trigo', 'mineral', 'esencia', 'madera', 'hierba'];
const VALID_CRAFTED = ['racion', 'espada', 'pocion', 'escudo', 'unguento', 'armadura', 'amuleto', 'pocion_fuerza', 'pocion_velocidad', 'antidoto', 'gran_pocion', 'elixir'];

function ensureProfileField(profile, field, defaultVal) {
  if (!profile[field] || typeof profile[field] !== 'object') profile[field] = defaultVal;
  return profile[field];
}

function addCharacterToProfile(profile, rewardId, rewardName, rewardRarity) {
  const collection = ensureProfileField(profile, 'characters', { characters: [], selectedId: '' });
  const exists = collection.characters.find((c) => c.id === rewardId);
  if (exists) return { duplicated: true };

  const rarityMap = { comun: 'comun', raro: 'raro', epico: 'epico', legendario: 'legendario' };
  const rarity = rarityMap[rewardRarity] || 'comun';
  const xpForLevel = (lvl) => lvl * 30 + 10;

  const newChar = {
    id: rewardId,
    name: rewardName,
    traits: {
      element: 'luz',
      rarity,
      bodyType: 'humanoid',
    },
    baseStats: { atk: 5, def: 5, spd: 5, hp: 50, ability: 5 },
    level: 1,
    xp: 0,
    upgrades: [],
    unlockedAt: Date.now(),
    source: 'promo',
    isStarter: false,
  };

  collection.characters.push(newChar);
  if (!collection.selectedId) collection.selectedId = rewardId;
  profile.characters = collection;
  return { duplicated: false };
}

function addItemToProfile(profile, itemId, quantity) {
  const crafted = ensureProfileField(profile, 'crafted', {});
  for (const k of VALID_CRAFTED) { if (crafted[k] === undefined) crafted[k] = 0; }
  const targetKey = itemId.replace(/-/g, '_');
  if (VALID_CRAFTED.includes(targetKey)) {
    crafted[targetKey] = (crafted[targetKey] || 0) + quantity;
  }
  profile.crafted = crafted;
}

function addMaterialToProfile(profile, materialId, quantity) {
  const inventory = ensureProfileField(profile, 'inventory', {});
  for (const k of VALID_RESOURCES) { if (inventory[k] === undefined) inventory[k] = 0; }
  const targetKey = materialId.replace(/-/g, '_');
  if (VALID_RESOURCES.includes(targetKey)) {
    inventory[targetKey] = (inventory[targetKey] || 0) + quantity;
  }
  profile.inventory = inventory;
}

function addCurrencyToProfile(profile, amount) {
  profile.currency = (profile.currency || 0) + amount;
}

function addCrystalsToProfile(profile, amount) {
  profile.crystals = (profile.crystals || 0) + amount;
}

function deliverReward(profile, product) {
  const { reward_type: rt, reward_id: rid, reward_name: rname, reward_rarity: rr, reward_qty: qty } = product;
  let rewardLabel = '';
  let duplicated = false;

  switch (rt) {
    case 'character': {
      const result = addCharacterToProfile(profile, rid, rname, rr);
      duplicated = result.duplicated;
      rewardLabel = duplicated ? `Fragmentos de ${rname} ×${qty * 10}` : `Personaje: ${rname}`;
      if (duplicated) addCrystalsToProfile(profile, qty * 10);
      break;
    }
    case 'item':
      addItemToProfile(profile, rid, qty);
      rewardLabel = `Objeto: ${rname}`;
      break;
    case 'consumable':
      addItemToProfile(profile, rid, qty);
      rewardLabel = `Consumible: ${rname}`;
      break;
    case 'currency':
      addCurrencyToProfile(profile, qty);
      rewardLabel = `${qty} Monedas`;
      break;
    case 'crystals':
      addCrystalsToProfile(profile, qty);
      rewardLabel = `${qty} Cristales`;
      break;
    default:
      addCurrencyToProfile(profile, qty);
      rewardLabel = `${qty} Monedas (default)`;
  }

  return { rewardLabel, duplicated, rewardType: rt, rewardId: rid, rewardName: rname, quantity: qty };
}

function recordRedemption(phone, code, rewardType, rewardId, rewardName, quantity) {
  db.prepare('INSERT INTO reward_history (user_phone, invoice_code, reward_type, reward_id, reward_name, quantity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    phone, code, rewardType, rewardId, rewardName, quantity, Date.now()
  );
}

const BCRYPT_ROUNDS = 12;

const rateLimitStore = new Map();
const authRateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 100;
const AUTH_RATE_LIMIT_MAX = 10;

function checkRateLimit(ip, max = RATE_LIMIT_MAX, store = rateLimitStore) {
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    store.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= max;
}

function cleanupStore(store) {
  const now = Date.now();
  for (const [ip, entry] of store) {
    if (now - entry.start > RATE_LIMIT_WINDOW * 2) store.delete(ip);
  }
}
setInterval(() => {
  cleanupStore(rateLimitStore);
  cleanupStore(authRateLimitStore);
}, 60000);

function validatePhone(phone) {
  return typeof phone === 'string' && /^\d{6,15}$/.test(phone);
}

function validatePassword(pw) {
  return typeof pw === 'string' && pw.length >= 4 && pw.length <= 100;
}

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, 500);
}

function getUser(phone) {
  return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
}

function createUser(phone, passwordHash) {
  db.prepare('INSERT INTO users (phone, password_hash, created_at) VALUES (?, ?, ?)').run(
    phone,
    passwordHash,
    Date.now()
  );
}

function getProfile(phone) {
  const row = db.prepare('SELECT data FROM profiles WHERE phone = ?').get(phone);
  if (!row) return null;
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

function saveProfile(phone, profile) {
  const data = JSON.stringify(profile);
  const existing = db.prepare('SELECT phone FROM profiles WHERE phone = ?').get(phone);
  if (existing) {
    db.prepare('UPDATE profiles SET data = ?, updated_at = ? WHERE phone = ?').run(
      data,
      Date.now(),
      phone
    );
  } else {
    db.prepare('INSERT INTO profiles (phone, data, updated_at) VALUES (?, ?, ?)').run(
      phone,
      data,
      Date.now()
    );
  }
}

async function hashPassword(pw) {
  return bcrypt.hash(pw, BCRYPT_ROUNDS);
}

async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

function legacyHash(pw) {
  let h = 0x811c9dc5;
  for (let i = 0; i < pw.length; i++) { h ^= pw.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return 'x' + (h >>> 0).toString(36);
}

function isLegacyHash(hash) {
  return typeof hash === 'string' && hash.startsWith('x') && hash.length < 10;
}

function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try { req.phone = jwt.verify(token, JWT_SECRET).phone; next(); }
  catch { res.status(401).json({ error: 'Token invalido' }); }
}

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const ip = req.ip || req.connection.remoteAddress;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Demasiadas peticiones. Intenta de nuevo en un minuto.' });
  }
  next();
});

app.post('/api/register', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!checkRateLimit(ip, AUTH_RATE_LIMIT_MAX, authRateLimitStore)) {
    return res.status(429).json({ error: 'Demasiados intentos de registro. Intenta de nuevo en un minuto.' });
  }

  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'Telefono y contrasena requeridos' });
  if (!validatePhone(phone)) return res.status(400).json({ error: 'Telefono invalido (solo numeros, 6-15 digitos)' });
  if (!validatePassword(password)) return res.status(400).json({ error: 'Contrasena invalida (4-100 caracteres)' });

  const existing = getUser(phone);
  if (existing) return res.status(409).json({ error: 'Esta cuenta ya existe. Inicia sesion.' });

  const passwordHash = await hashPassword(password);
  createUser(phone, passwordHash);
  saveProfile(phone, { nft: null, game: null });

  const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: '60d' });
  res.json({ token, phone });
});

app.post('/api/login', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!checkRateLimit(ip, AUTH_RATE_LIMIT_MAX, authRateLimitStore)) {
    return res.status(429).json({ error: 'Demasiados intentos de login. Intenta de nuevo en un minuto.' });
  }

  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'Telefono y contrasena requeridos' });
  if (!validatePhone(phone)) return res.status(400).json({ error: 'Telefono invalido' });

  const user = getUser(phone);
  if (!user) return res.status(401).json({ error: 'Credenciales invalidas' });

  let valid = false;
  if (isLegacyHash(user.password_hash)) {
    valid = user.password_hash === legacyHash(password);
    if (valid) {
      console.log(`[MIGRATE] Migrando hash legacy para usuario ${phone}`);
      const newHash = await hashPassword(password);
      db.prepare('UPDATE users SET password_hash = ? WHERE phone = ?').run(newHash, phone);
    }
  } else {
    valid = await verifyPassword(password, user.password_hash);
  }

  if (!valid) return res.status(401).json({ error: 'Credenciales invalidas' });

  const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: '60d' });
  res.json({ token, phone });
});

app.get('/api/profile', auth, (req, res) => {
  const profile = getProfile(req.phone);
  if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });
  res.json(profile);
});

app.put('/api/profile', auth, (req, res) => {
  const existing = getProfile(req.phone);
  if (!existing) {
    saveProfile(req.phone, { nft: null, game: null });
  }

  const { nft, inventory, crafted, redeemedRewards, quest, quests, attributePoints, currentZone, unlockedZones, loot, achievements, characters, currency, crystals } = req.body;

  if (!nft || typeof nft !== 'object') return res.status(400).json({ error: 'Perfil invalido: nft requerido' });
  if (typeof attributePoints !== 'number' || attributePoints < 0 || attributePoints > 100) {
    return res.status(400).json({ error: 'attributePoints invalido' });
  }
  if (!Array.isArray(unlockedZones)) {
    return res.status(400).json({ error: 'unlockedZones invalido' });
  }
  if (!Array.isArray(redeemedRewards)) {
    return res.status(400).json({ error: 'redeemedRewards invalido' });
  }

  const validZones = ['aldea', 'bosque', 'ruinas', 'desierto', 'cueva'];
  if (currentZone && !validZones.includes(currentZone)) {
    return res.status(400).json({ error: 'Zona invalida' });
  }

  for (const z of unlockedZones) {
    if (!validZones.includes(z)) {
      return res.status(400).json({ error: 'Zona desbloqueada invalida' });
    }
  }

  const validResources = ['trigo', 'mineral', 'esencia', 'madera', 'hierba'];
  if (inventory && typeof inventory === 'object') {
    for (const key of Object.keys(inventory)) {
      if (!validResources.includes(key) || typeof inventory[key] !== 'number' || inventory[key] < 0 || inventory[key] > 9999) {
        return res.status(400).json({ error: 'Inventory invalido' });
      }
    }
  }

  const validCrafted = ['racion', 'espada', 'pocion', 'escudo', 'unguento', 'armadura', 'amuleto', 'pocion_fuerza', 'pocion_velocidad', 'antidoto', 'gran_pocion', 'elixir'];
  if (crafted && typeof crafted === 'object') {
    for (const key of Object.keys(crafted)) {
      if (!validCrafted.includes(key) || typeof crafted[key] !== 'number' || crafted[key] < 0 || crafted[key] > 9999) {
        return res.status(400).json({ error: 'Crafted invalido' });
      }
    }
  }

  if (quest && typeof quest === 'object') {
    if (typeof quest.resources !== 'number' || typeof quest.creatures !== 'number' || typeof quest.completed !== 'boolean') {
      return res.status(400).json({ error: 'Quest invalido' });
    }
  }

  if (!Array.isArray(loot)) {
    return res.status(400).json({ error: 'Loot invalido' });
  }

  if (nft.level && (typeof nft.level !== 'number' || nft.level < 1 || nft.level > 100)) {
    return res.status(400).json({ error: 'Nivel invalido' });
  }

  const profileData = {
    nft,
    inventory,
    crafted,
    redeemedRewards,
    quest,
    quests,
    attributePoints,
    currentZone,
    unlockedZones,
    loot,
    achievements: Array.isArray(achievements) ? achievements : [],
    characters: characters || { characters: [], selectedId: '' },
    currency: typeof currency === 'number' ? currency : 0,
    crystals: typeof crystals === 'number' ? crystals : 0,
  };

  saveProfile(req.phone, profileData);
  res.json({ ok: true });
});

app.post('/api/redeem', auth, (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Código de factura requerido.' });
  }

  const trimmedCode = code.trim().toUpperCase();
  if (trimmedCode.length < 5 || trimmedCode.length > 64) {
    return res.status(400).json({ error: 'Código inválido.' });
  }

  const processRedeem = db.transaction(() => {
    const invoice = db.prepare('SELECT * FROM invoice_codes WHERE code = ?').get(trimmedCode);
    if (!invoice) return { error: 'Código no encontrado.' };
    if (invoice.status === 'REDEEMED') return { error: 'Este código ya fue canjeado.' };
    if (invoice.status === 'CANCELLED') return { error: 'Este código ha sido cancelado.' };
    if (invoice.status === 'EXPIRED') return { error: 'Este código ha expirado.' };
    if (invoice.status !== 'AVAILABLE') return { error: 'Código no disponible.' };

    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(invoice.product_id);
    if (!product) return { error: 'Producto asociado no encontrado.' };

    const promo = db.prepare(`
      SELECT p.* FROM promotions p
      JOIN promotion_products pp ON pp.promotion_id = p.id
      WHERE pp.product_id = ? AND p.active = 1
    `).get(product.id);
    if (promo) {
      const now = Date.now();
      const start = new Date(promo.start_date).getTime();
      const end = new Date(promo.end_date).getTime();
      if (now < start) return { error: 'La promoción asociada aún no ha comenzado.' };
      if (now > end) return { error: 'La promoción asociada ha expirado.' };
    }

    const profile = getProfile(req.phone);
    if (!profile) return { error: 'Perfil de usuario no encontrado.' };

    const redeemed = ensureProfileField(profile, 'redeemedRewards', []);
    if (Array.isArray(redeemed) && redeemed.includes(trimmedCode)) {
      return { error: 'Ya has canjeado este código anteriormente.' };
    }

    const deliveryResult = deliverReward(profile, product);

    if (!Array.isArray(profile.redeemedRewards)) profile.redeemedRewards = [];
    profile.redeemedRewards.push(trimmedCode);

    saveProfile(req.phone, profile);

    db.prepare('UPDATE invoice_codes SET status = ?, redeemed_at = ?, redeemed_by = ? WHERE code = ?').run(
      'REDEEMED', Date.now(), req.phone, trimmedCode
    );

    recordRedemption(
      req.phone, trimmedCode,
      deliveryResult.rewardType,
      deliveryResult.rewardId,
      deliveryResult.rewardName,
      deliveryResult.quantity
    );

    return {
      success: true,
      reward: {
        type: deliveryResult.rewardType,
        id: deliveryResult.rewardId,
        name: deliveryResult.rewardName,
        label: deliveryResult.rewardLabel,
        quantity: deliveryResult.quantity,
        duplicated: deliveryResult.duplicated,
      },
      product: {
        id: product.id,
        name: product.name,
      },
    };
  });

  const result = processRedeem();
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result);
});

app.get('/api/rewards/history', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT rh.*, ic.campaign_id
    FROM reward_history rh
    LEFT JOIN invoice_codes ic ON ic.code = rh.invoice_code
    WHERE rh.user_phone = ?
    ORDER BY rh.created_at DESC
    LIMIT 50
  `).all(req.phone);
  res.json({ history: rows });
});

app.get('/api/rewards/pending', auth, (req, res) => {
  const count = db.prepare(`
    SELECT COUNT(*) AS cnt FROM reward_history
    WHERE user_phone = ? AND created_at > ?
  `).get(req.phone, Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = db.prepare(`
    SELECT rh.*, ic.campaign_id
    FROM reward_history rh
    LEFT JOIN invoice_codes ic ON ic.code = rh.invoice_code
    WHERE rh.user_phone = ?
    ORDER BY rh.created_at DESC
    LIMIT 5
  `).all(req.phone);
  res.json({ pending: count.cnt, recent });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, time: Date.now() }));

app.get('/api/stores', (_req, res) => {
  const rows = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM promotions p WHERE p.store_id = s.id AND p.active = 1) AS promotion_count
    FROM stores s WHERE s.active = 1 ORDER BY s.name
  `).all();
  res.json({ stores: rows });
});

app.get('/api/stores/:id', (req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE id = ? AND active = 1').get(req.params.id);
  if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });

  const promotions = db.prepare(`
    SELECT p.* FROM promotions p WHERE p.store_id = ? AND p.active = 1 ORDER BY p.start_date DESC
  `).all(req.params.id);

  const promotionIds = promotions.map((p) => p.id);
  let products = [];
  if (promotionIds.length > 0) {
    const placeholders = promotionIds.map(() => '?').join(',');
    products = db.prepare(`
      SELECT DISTINCT pr.* FROM products pr
      JOIN promotion_products pp ON pp.product_id = pr.id
      WHERE pp.promotion_id IN (${placeholders}) AND pr.active = 1
      ORDER BY pr.name
    `).all(...promotionIds);
  }

  const productIds = products.map((p) => p.id);
  for (const promo of promotions) {
    promo.product_ids = productIds;
  }

  res.json({ store: { ...store, promotions, products } });
});

app.get('/api/promotions', (_req, res) => {
  const rows = db.prepare(`
    SELECT p.*,
      GROUP_CONCAT(pp.product_id) AS product_ids_csv
    FROM promotions p
    LEFT JOIN promotion_products pp ON pp.promotion_id = p.id
    WHERE p.active = 1
    GROUP BY p.id
    ORDER BY p.start_date DESC
  `).all();
  for (const row of rows) {
    row.product_ids = row.product_ids_csv ? row.product_ids_csv.split(',') : [];
    delete row.product_ids_csv;
  }
  res.json({ promotions: rows });
});

app.get('/api/products', (req, res) => {
  const storeId = req.query.store_id;
  let sql = 'SELECT * FROM products WHERE active = 1';
  const params = [];
  if (storeId) {
    sql += ' AND store_id = ?';
    params.push(storeId);
  }
  sql += ' ORDER BY name';
  const rows = db.prepare(sql).all(...params);
  res.json({ products: rows });
});

if (existsSync(FRONTEND_DIR)) {
  app.use(express.static(FRONTEND_DIR));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(join(FRONTEND_DIR, 'index.html'));
  });
} else {
  app.get('*', (_req, res) => res.status(500).json({ error: 'Frontend not built. Run: npm run build' }));
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Reinos Ancestrales] http://localhost:${PORT}`);
  console.log(`[Frontend] ${existsSync(FRONTEND_DIR) ? 'serving from ' + FRONTEND_DIR : 'NOT BUILT'}`);
});

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
`);

const BCRYPT_ROUNDS = 12;

const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 100;
const AUTH_RATE_LIMIT_MAX = 5;

function checkRateLimit(ip, max = RATE_LIMIT_MAX) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= max;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore) {
    if (now - entry.start > RATE_LIMIT_WINDOW * 2) rateLimitStore.delete(ip);
  }
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
  if (!checkRateLimit(ip, AUTH_RATE_LIMIT_MAX)) {
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
  if (!checkRateLimit(ip, AUTH_RATE_LIMIT_MAX)) {
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

  const { nft, inventory, crafted, redeemedRewards, quest, quests, attributePoints, currentZone, unlockedZones, loot, achievements } = req.body;

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
  };

  saveProfile(req.phone, profileData);
  res.json({ ok: true });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, time: Date.now() }));

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

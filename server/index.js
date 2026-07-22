import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || (() => { if (process.env.NODE_ENV === 'production') { console.error('[SECURITY] JWT_SECRET no configurado. Define la variable de entorno JWT_SECRET.'); process.exit(1); } return 'reinos-ancestrales-dev-secret'; })();
const DATA_DIR = join(__dirname, 'data');
const DB_FILE = join(DATA_DIR, 'db.json');
const FRONTEND_DIR = join(__dirname, '..', 'dist');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function loadDb() {
  if (!existsSync(DB_FILE)) return { users: {}, profiles: {} };
  try { return JSON.parse(readFileSync(DB_FILE, 'utf-8')); }
  catch { return { users: {}, profiles: {} }; }
}

function saveDb(db) {
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function hashPw(pw) {
  let h = 0x811c9dc5;
  for (let i = 0; i < pw.length; i++) { h ^= pw.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return 'x' + (h >>> 0).toString(36);
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
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

app.post('/api/register', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'Telefono y contrasena requeridos' });
  if (password.length < 4) return res.status(400).json({ error: 'Contrasena muy corta (minimo 4 caracteres)' });
  const db = loadDb();
  if (db.users[phone]) return res.status(409).json({ error: 'Esta cuenta ya existe. Inicia sesion.' });
  db.users[phone] = { passwordHash: hashPw(password), createdAt: Date.now() };
  db.profiles[phone] = { nft: null, game: null, updatedAt: Date.now() };
  saveDb(db);
  const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: '60d' });
  res.json({ token, phone });
});

app.post('/api/login', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'Telefono y contrasena requeridos' });
  const db = loadDb();
  const user = db.users[phone];
  if (!user || user.passwordHash !== hashPw(password)) return res.status(401).json({ error: 'Credenciales invalidas' });
  const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: '60d' });
  res.json({ token, phone });
});

app.get('/api/profile', auth, (req, res) => {
  const db = loadDb();
  const profile = db.profiles[req.phone];
  if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });
  res.json(profile);
});

app.put('/api/profile', auth, (req, res) => {
  const db = loadDb();
  if (!db.profiles[req.phone]) db.profiles[req.phone] = { nft: null, game: null, updatedAt: Date.now() };
  const { nft, inventory, crafted, redeemedRewards, quest, quests, attributePoints, currentZone, unlockedZones, loot } = req.body;
  if (!nft || typeof nft !== 'object') return res.status(400).json({ error: 'Perfil invalido: nft requerido' });
  db.profiles[req.phone] = { nft, inventory, crafted, redeemedRewards, quest, quests, attributePoints, currentZone, unlockedZones, loot, updatedAt: Date.now() };
  saveDb(db);
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

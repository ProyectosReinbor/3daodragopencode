import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { WORLD_ITEMS, initialWorldProgress } from '../shared/world-items.js';

export function initializeAdminAccounts(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS admin_accounts (
    username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL
  ); CREATE TABLE IF NOT EXISTS admin_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, action TEXT NOT NULL,
    target TEXT NOT NULL, created_at INTEGER NOT NULL
  );`);
}

export function mountAdminManagement(app, { db, adminAuth, getProfile, saveProfile, secret }) {
  initializeAdminAccounts(db);
  const audit = (req, action, target) => db.prepare('INSERT INTO admin_audit (username, action, target, created_at) VALUES (?, ?, ?, ?)').run(req.admin.username || 'admin', action, target, Date.now());
  app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string' || password.length > 100)
      return res.status(400).json({ error: 'Usuario y contraseña requeridos.' });
    const account = db.prepare('SELECT * FROM admin_accounts WHERE username = ?').get(username.trim().toLowerCase());
    if (!account || !await bcrypt.compare(password, account.password_hash))
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    res.json({ token: jwt.sign({ role: 'admin', username: account.username }, secret, { expiresIn: '8h' }), username: account.username });
  });
  app.get('/api/admin/items', adminAuth, (_req, res) => res.json({ items: Object.entries(WORLD_ITEMS).map(([id, item]) => ({ id, ...item })) }));
  app.patch('/api/admin/users/:phone/account', adminAuth, async (req, res) => {
    if (!db.prepare('SELECT phone FROM users WHERE phone = ?').get(req.params.phone))
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    const { password } = req.body;
    if (typeof password !== 'string' || password.length < 8 || password.length > 100)
      return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 100 caracteres.' });
    const hash = await bcrypt.hash(password, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE phone = ?').run(hash, req.params.phone);
    audit(req, 'account.password', req.params.phone);
    res.json({ ok: true });
  });
  app.post('/api/admin/users/:phone/items', adminAuth, (req, res) => {
    const profile = getProfile(req.params.phone);
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado.' });
    const { item, action } = req.body;
    if (typeof item !== 'string' || !Object.hasOwn(WORLD_ITEMS, item) || !['grant', 'remove'].includes(action))
      return res.status(400).json({ error: 'Ítem o acción inválidos.' });
    const world = profile.world ||= initialWorldProgress();
    if (action === 'grant') { if (!world.items.includes(item)) world.items.push(item); }
    else {
      world.items = world.items.filter(id => id !== item);
      for (const slots of Object.values(world.equipped))
        for (const [slot, id] of Object.entries(slots)) if (id === item) delete slots[slot];
    }
    saveProfile(req.params.phone, profile);
    audit(req, 'item.' + action, req.params.phone + ':' + item);
    res.json({ ok: true, items: world.items });
  });
}

import bcrypt from 'bcryptjs';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './database.js';
import { initializeAdminAccounts } from './admin-management.js';

const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!username || !password || password.length < 8 || password.length > 100)
  throw Error('Define ADMIN_USERNAME y ADMIN_PASSWORD (8–100 caracteres).');
const directory = resolve(process.env.AODASE_DATA_DIR || fileURLToPath(new URL('./data', import.meta.url)));
mkdirSync(directory, { recursive: true });
const db = await createDatabase(resolve(directory, 'game.db'));
try {
  initializeAdminAccounts(db);
  const hash = await bcrypt.hash(password, 12);
  db.prepare('INSERT INTO admin_accounts (username,password_hash,created_at) VALUES (?,?,?) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash').run(username, hash, Date.now());
  console.log('Acceso administrador guardado.');
} finally { db.close(); }

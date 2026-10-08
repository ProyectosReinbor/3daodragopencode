import bcrypt from 'bcryptjs';

export function mountAdminCrud(app, { db, adminAuth, getProfile, saveProfile }) {
  if (!db.prepare('PRAGMA table_info(invoice_codes)').all().some(c => c.name === 'admin_deleted_at'))
    db.exec('ALTER TABLE invoice_codes ADD COLUMN admin_deleted_at INTEGER');
  const audit = (req, action, target) => db.prepare('INSERT INTO admin_audit (username,action,target,created_at) VALUES (?,?,?,?)').run(req.admin.username || 'admin', action, target, Date.now());
  const wrap = handler => (req, res) => { try { handler(req, res); } catch { res.status(500).json({ error: 'No se pudo guardar el cambio.' }); } };
  app.patch('/api/admin/users/:phone', adminAuth, async (req, res) => {
    const user = db.prepare('SELECT phone FROM users WHERE phone = ?').get(req.params.phone);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    const { password, coins, petNames } = req.body;
    if (password !== undefined && (typeof password !== 'string' || password.length < 8 || password.length > 100))
      return res.status(400).json({ error: 'Contraseña: entre 8 y 100 caracteres.' });
    if (coins !== undefined && (!Number.isInteger(coins) || coins < 0 || coins > 10000000))
      return res.status(400).json({ error: 'Monedas inválidas.' });
    if (petNames !== undefined && (!Array.isArray(petNames) || petNames.length > 100 || petNames.some(p => !p || typeof p.id !== 'string' || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 50)))
      return res.status(400).json({ error: 'Nombres de mascotas inválidos.' });
    try {
      const hash = password ? await bcrypt.hash(password, 12) : null;
      const profile = getProfile(user.phone);
      if ((coins !== undefined || petNames !== undefined) && !profile) return res.status(400).json({ error: 'Este usuario aún no tiene perfil.' });
      if (petNames?.some(p => !profile.characters?.characters.some(c => c.id === p.id))) return res.status(400).json({ error: 'Mascota no encontrada.' });
      db.transaction(() => {
        if (hash) db.prepare('UPDATE users SET password_hash = ? WHERE phone = ?').run(hash, user.phone);
        if (profile) {
          if (coins !== undefined) { profile.world ||= { coins: 0, items: [], equipped: {}, potions: 0, mana: 0, kills: 0 }; profile.world.coins = coins; }
          for (const p of petNames || []) profile.characters.characters.find(c => c.id === p.id).name = p.name.trim();
          saveProfile(user.phone, profile);
        }
        audit(req, 'user.edit', user.phone);
      })();
      res.json({ ok: true });
    } catch { res.status(500).json({ error: 'No se pudo editar el usuario.' }); }
  });
  app.delete('/api/admin/users/:phone', adminAuth, wrap((req, res) => {
    if (!db.prepare('SELECT phone FROM users WHERE phone = ?').get(req.params.phone)) return res.status(404).json({ error: 'Usuario no encontrado.' });
    db.transaction(() => {
      // Keep redeemed receipts consumed, even after their owner is deleted.
      db.prepare('UPDATE invoice_codes SET redeemed_by = NULL WHERE redeemed_by = ?').run(req.params.phone);
      db.prepare('DELETE FROM users WHERE phone = ?').run(req.params.phone);
      audit(req, 'user.delete', req.params.phone);
    })();
    res.json({ ok: true });
  }));
  app.patch('/api/admin/invoices/:id', adminAuth, wrap((req, res) => {
    const invoice = db.prepare('SELECT * FROM invoice_codes WHERE id = ? AND admin_deleted_at IS NULL').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Factura no encontrada.' });
    const { campaign_id, status, note } = req.body;
    if (typeof campaign_id !== 'string' || campaign_id.length > 100 || typeof note !== 'string' || note.length > 2000)
      return res.status(400).json({ error: 'Campaña o nota inválida.' });
    if (!['AVAILABLE','CANCELLED','EXPIRED','REDEEMED'].includes(status) || (invoice.status === 'REDEEMED' ? status !== 'REDEEMED' : status === 'REDEEMED'))
      return res.status(400).json({ error: 'Una factura canjeada no puede reabrirse. El canje se realiza desde el juego.' });
    const metadata = JSON.parse(invoice.metadata || '{}'); metadata.admin_note = note;
    db.transaction(() => {
      db.prepare('UPDATE invoice_codes SET campaign_id = ?, status = ?, metadata = ? WHERE id = ?').run(campaign_id.trim(), status, JSON.stringify(metadata), invoice.id);
      audit(req, 'invoice.edit', String(invoice.id));
    })();
    res.json({ ok: true });
  }));
  app.delete('/api/admin/invoices/:id', adminAuth, wrap((req, res) => {
    const invoice = db.prepare('SELECT * FROM invoice_codes WHERE id = ? AND admin_deleted_at IS NULL').get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Factura no encontrada.' });
    db.transaction(() => {
      db.prepare('UPDATE invoice_codes SET admin_deleted_at = ?, status = ? WHERE id = ?').run(Date.now(), invoice.status === 'REDEEMED' ? 'REDEEMED' : 'CANCELLED', invoice.id);
      audit(req, 'invoice.delete', String(invoice.id));
    })();
    res.json({ ok: true });
  }));
  app.delete('/api/admin/stores/:id', adminAuth, wrap((req, res) => {
    if (!db.prepare('SELECT id FROM stores WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Tienda no encontrada.' });
    db.transaction(() => {
      db.prepare('DELETE FROM foodie_purchases WHERE store_id = ?').run(req.params.id);
      db.prepare('DELETE FROM stores WHERE id = ?').run(req.params.id);
      audit(req, 'store.delete', req.params.id);
    })();
    res.json({ ok: true });
  }));
}

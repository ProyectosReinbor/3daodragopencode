import { randomUUID } from 'node:crypto';
import { WORLD_ITEMS, MONSTER_REWARDS, initialWorldProgress } from '../shared/world-items.js';
import { applyPurchaseExperience } from './foodie-growth.js';
// Sessions own combat cooldowns and encounter health. Rewards never come from profile PUT.
export function mountFoodieWorld(app, { auth, getProfile, saveProfile }) {
  const sessions = new Map();
  app.post('/api/world/start', auth, (req, res) => {
    const profile = getProfile(req.phone);
    const pet = profile?.characters?.characters.find(p => p.id === req.body.characterId);
    if (!pet) return res.status(400).json({ error: 'Selecciona un personaje de tu colección.' });
    profile.world ||= initialWorldProgress();
    saveProfile(req.phone, profile);
    for (const [id, old] of sessions) if (old.phone === req.phone || old.expires < Date.now()) sessions.delete(id);
    const id = randomUUID();
    sessions.set(id, { phone: req.phone, petId: pet.id, encounters: new Map(), cooldowns: {}, expires: Date.now() + 3600000 });
    res.json({ session: id, profile });
  });
  app.post('/api/world/action', auth, (req, res) => {
    const session = sessions.get(req.body.session);
    if (!session || session.phone !== req.phone || session.expires < Date.now()) return res.status(409).json({ error: 'Vuelve a entrar al mundo para continuar.' });
    const profile = getProfile(req.phone);
    const pet = profile.characters.characters.find(p => p.id === session.petId);
    const world = profile.world ||= initialWorldProgress();
    const { action, item, enemy, kind, slot } = req.body;
    let reward = null, damage = 0;
    if (action === 'buy') {
      const price = item === 'potions' ? 15 : item === 'mana' ? 12 : 0;
      if (!price || world.coins < price) return res.status(400).json({ error: 'No tienes suficientes monedas.' });
      world.coins -= price; world[item]++;
    } else if (action === 'consume') {
      if (!['potions', 'mana'].includes(item) || world[item] < 1) return res.status(400).json({ error: 'No te quedan consumibles.' });
      if ((session.cooldowns[item] || 0) > Date.now()) return res.status(400).json({ error: 'Espera un momento para usar otra poción.' });
      session.cooldowns[item] = Date.now() + 1500; world[item]--;
    } else if (action === 'equip') {
      if (!WORLD_ITEMS[item] || !world.items.includes(item)) return res.status(400).json({ error: 'Todavía no has encontrado ese objeto.' });
      world.equipped[pet.id] ||= {}; world.equipped[pet.id][WORLD_ITEMS[item].slot] = item;
    } else if (action === 'attack') {
      const spec = MONSTER_REWARDS[kind];
      if (!spec || typeof enemy !== 'string' || enemy.length > 80 || !Number.isInteger(slot) || slot < -1 || slot > 3) return res.status(400).json({ error: 'Ataque inválido.' });
      const now = Date.now();
      const cooldown = [450, 5000, 8000, 7000, 22000][slot + 1];
      if ((session.cooldowns[slot] || 0) > now) return res.status(429).json({ error: 'La habilidad todavía se está recuperando.' });
      session.cooldowns[slot] = now + cooldown;
      let encounter = session.encounters.get(enemy);
      if (!encounter) {
        if (session.encounters.size > 150) return res.status(400).json({ error: 'Vuelve a entrar al mundo.' });
        encounter = { kind, health: spec.health, nextSpawn: 0 }; session.encounters.set(enemy, encounter);
      }
      if (encounter.kind !== kind || (encounter.health <= 0 && encounter.nextSpawn > now)) return res.status(400).json({ error: 'Este enemigo ya fue derrotado.' });
      if (encounter.health <= 0) encounter.health = spec.health;
      const equipment = Object.values(world.equipped[pet.id] || {}).map(id => WORLD_ITEMS[id]);
      const attack = pet.baseStats.atk + pet.level - 1 + (pet.upgrades || []).filter(u => u.stat === 'atk').reduce((sum, u) => sum + (u.amount || u.value || 0), 0) + equipment.filter(x => x?.stat === 'atk').reduce((sum, x) => sum + x.bonus, 0);
      damage = Math.round((10 + attack * 2 + pet.baseStats.ability) * (slot === 3 ? 3 : slot === -1 ? 0.7 : 1.3));
      encounter.health = Math.max(0, encounter.health - damage);
      if (!encounter.health) {
        encounter.nextSpawn = now + 20000;
        reward = { coins: spec.coins, xp: spec.xp, potions: Math.random() < 0.5 ? 1 : 0, mana: Math.random() < 0.4 ? 1 : 0, item: Math.random() < 0.4 ? spec.items[Math.floor(Math.random() * spec.items.length)] : null };
        world.coins += reward.coins; world.potions += reward.potions; world.mana += reward.mana; world.kills++;
        if (reward.item && !world.items.includes(reward.item)) world.items.push(reward.item);
        applyPurchaseExperience(profile, reward.xp, pet.id);
      }
    } else return res.status(400).json({ error: 'Acción desconocida.' });
    saveProfile(req.phone, profile);
    res.json({ profile, reward, damage, enemyHealth: enemy ? session.encounters.get(enemy)?.health : undefined });
  });
}

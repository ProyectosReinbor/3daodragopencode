import { WORLD_QUESTS, questProgress } from '../shared/world-quests.js';
import { randomUUID } from 'node:crypto';
import { WORLD_ITEMS, MONSTER_REWARDS, initialWorldProgress } from '../shared/world-items.js';
import { CITY_WORLD, CITY_ENCOUNTERS } from '../shared/city-world.js';
import { craftWorldItem, WORLD_RECIPES, MONSTER_MATERIALS, normalizeMaterials } from '../shared/world-crafting.js';
import { applyPurchaseExperience } from './foodie-growth.js';
// Sessions own combat cooldowns and encounter health. Rewards never come from profile PUT.
export function mountFoodieWorld(app, { auth, getProfile, saveProfile, clock = () => Date.now() }) {
  const sessions = new Map();
  app.post('/api/world/start', auth, (req, res) => {
    const profile = getProfile(req.phone);
    const pet = profile?.characters?.characters.find(p => p.id === req.body.characterId);
    if (!pet) return res.status(400).json({ error: 'Selecciona un personaje de tu colección.' });
    profile.world ||= initialWorldProgress();
    profile.world.crafted ??= Object.values(WORLD_RECIPES).filter(r=>profile.world.items.includes(r.output)).length;
    saveProfile(req.phone, profile);
    for (const [id, old] of sessions) if (old.phone === req.phone || old.expires < clock()) sessions.delete(id);
    const id = randomUUID();
    sessions.set(id, { publicId: randomUUID(), phone: req.phone, petId: pet.id, encounters: new Map(), cooldowns: {}, expires: clock() + 3600000 });
    res.json({ session: id, profile, serverNow: clock() });
  });
  app.post('/api/world/action', auth, (req, res) => {
    const session = sessions.get(req.body.session);
    if (!session || session.phone !== req.phone || session.expires < clock()) return res.status(409).json({ error: 'Vuelve a entrar al mundo para continuar.' });
    const profile = getProfile(req.phone);
    const pet = profile?.characters?.characters.find(p => p.id === session.petId);
    if(!pet)return res.status(409).json({error:'Selecciona de nuevo una mascota para entrar.'});
    const world = profile.world ||= initialWorldProgress();
    const { action, item, enemy, kind, slot } = req.body;
    let reward = null, damage = 0;
    if (action === 'buy') {
      const price = item === 'potions' ? 15 : item === 'mana' ? 12 : 0;
      if (!price || world.coins < price) return res.status(400).json({ error: 'No tienes suficientes monedas.' });
      world.coins -= price; world[item]++;
    } else if (action === 'consume') {
      if (!['potions', 'mana'].includes(item) || world[item] < 1) return res.status(400).json({ error: 'No te quedan consumibles.' });
      if ((session.cooldowns[item] || 0) > clock()) return res.status(400).json({ error: 'Espera un momento para usar otra poción.' });
      session.cooldowns[item] = clock() + 1500; world[item]--;
    } else if (action === 'equip') {
      if (!WORLD_ITEMS[item] || !world.items.includes(item)) return res.status(400).json({ error: 'Todavía no has encontrado ese objeto.' });
      world.equipped[pet.id] ||= {}; world.equipped[pet.id][WORLD_ITEMS[item].slot] = item;
    } else if (action === 'accept_quest' || action === 'claim_quest') {
      const id=req.body.quest;
      if(typeof id!=='string' || !Object.hasOwn(WORLD_QUESTS,id))return res.status(400).json({error:'Misión desconocida.'});
      world.acceptedQuests ||= [];world.claimedQuests ||= [];
      if(action==='accept_quest'){if(!world.acceptedQuests.includes(id))world.acceptedQuests.push(id);}
      else {
        if(!world.acceptedQuests.includes(id) || world.claimedQuests.includes(id) || questProgress(world,id)<WORLD_QUESTS[id].target)return res.status(400).json({error:'Completa una misión activa antes de cobrarla.'});
        const q=WORLD_QUESTS[id];world.claimedQuests.push(id);world.coins+=q.coins;world.potions++;applyPurchaseExperience(profile,q.xp,pet.id);reward={coins:q.coins,xp:q.xp};
      }
    } else if (action === 'pickup') {
      const node=CITY_WORLD.nodes.find(n=>n.id===req.body.node && n.pickup);
      const pos=req.body.position;
      if(!node || !pos || !Number.isFinite(pos.x)||!Number.isFinite(pos.z)||Math.hypot(pos.x-node.x,pos.z-node.z)>5)return res.status(400).json({error:'Acércate al objeto para recogerlo.'});
      const materials=normalizeMaterials(world);
      if((world.resourceCooldowns[node.id]||0)>clock())return res.status(429).json({error:'Este objeto todavía no reaparece.'});
      materials[node.material]=(materials[node.material]||0)+node.amount;world.gathered=(world.gathered||0)+node.amount;world.resourceCooldowns[node.id]=clock()+60000;reward={material:node.material,amount:node.amount};
    } else if (action === 'craft') {
      const pos=req.body.position;
      if(!pos || !Number.isFinite(pos.x)||!Number.isFinite(pos.z)||Math.hypot(pos.x-CITY_WORLD.forge.x,pos.z-CITY_WORLD.forge.z)>5)return res.status(400).json({error:'Acércate a la forja para fabricar.'});
      try { reward = craftWorldItem(world, req.body.recipe); if(!reward.alreadyCrafted)world.crafted=(world.crafted||0)+1; }
      catch (error) { return res.status(400).json({error:error.message}); }
    } else if (action === 'begin_gather' || action === 'gather') {
      const node = CITY_WORLD.nodes.find(n => n.id === req.body.node);
      const pos=req.body.position;
      if (!node || node.pickup || !pos || !Number.isFinite(pos.x)||!Number.isFinite(pos.z)||Math.hypot(pos.x-node.x,pos.z-node.z)>5) return res.status(400).json({error:'Acércate al yacimiento.'});
      normalizeMaterials(world);
      if ((world.resourceCooldowns[node.id] || 0) > clock()) return res.status(429).json({error:'Este yacimiento todavía se está recuperando.'});
      if (action === 'begin_gather') {
        session.gathering = {node:node.id,token:randomUUID(),readyAt:clock()+3000};
        return res.json({profile,serverNow:clock(),challenge:{token:session.gathering.token,readyAt:session.gathering.readyAt}});
      }
      if (!session.gathering || session.gathering.node !== node.id || session.gathering.token !== req.body.token || (clock() < session.gathering.readyAt || clock() > session.gathering.readyAt + 30000))
        return res.status(400).json({error:'Completa la extracción antes de recoger el material.'});
      session.gathering = null;
      world.materials[node.material] = (world.materials[node.material] || 0) + node.amount;
      world.resourceCooldowns[node.id] = clock()+30000;
      world.gathered=(world.gathered||0)+node.amount;
      reward = {material:node.material,amount:node.amount};
    } else if (action === 'attack') {
      const spec = Object.hasOwn(MONSTER_REWARDS,kind) ? MONSTER_REWARDS[kind] : null;
      const encounterSpec=typeof enemy==='string' && /^city:\d+$/.test(enemy) ? CITY_ENCOUNTERS[Number(enemy.slice(5))] : null;
      if(!encounterSpec && !((enemy==='aldea:0'&&kind==='wolf')||(enemy==='aldea:1'&&kind==='skeleton')))return res.status(400).json({error:'Enemigo desconocido.'});
      if(encounterSpec && encounterSpec.kind!==kind)return res.status(400).json({error:'Enemigo inválido.'});
      if (!spec || typeof enemy !== 'string' || enemy.length > 80 || !Number.isInteger(slot) || slot < -1 || slot > 3) return res.status(400).json({ error: 'Ataque inválido.' });
      const now = clock();
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
        const drop = MONSTER_MATERIALS[kind];
        const materials = normalizeMaterials(world);
        materials[drop.material] = (materials[drop.material] || 0) + drop.amount;
        world.gathered=(world.gathered||0)+drop.amount;
        reward.material = drop.material; reward.amount = drop.amount;
        applyPurchaseExperience(profile, reward.xp, pet.id);
      }
    } else return res.status(400).json({ error: 'Acción desconocida.' });
    saveProfile(req.phone, profile);
    res.json({ profile, reward, serverNow:clock(), damage, enemyHealth: enemy ? session.encounters.get(enemy)?.health : undefined });
  });
  app.post('/api/world/presence', auth, (req,res) => {
    const session = sessions.get(req.body.session), now = clock();
    if (!session || session.phone !== req.phone || session.expires < now) return res.status(409).json({error:'Vuelve a entrar al mundo.'});
    const {x,z} = req.body;
    if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x)>CITY_WORLD.size/2 || Math.abs(z)>CITY_WORLD.size/2) return res.status(400).json({error:'Posición inválida.'});
    session.position = {x,z}; session.seenAt = now;
    const players=[];
    for(const [id,other] of sessions) {
      if (id===req.body.session || other.expires<now || !other.position || now-other.seenAt>10000 || Math.hypot(x-other.position.x,z-other.position.z)>45) continue;
      const profile=getProfile(other.phone),pet=profile?.characters?.characters.find(p=>p.id===other.petId);
      if(pet)players.push({id:other.publicId,position:other.position,name:pet.name,level:pet.level,traits:pet.traits});
      if(players.length>=4)break;
    }
    res.json({players});
  });

}

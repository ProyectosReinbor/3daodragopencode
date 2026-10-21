export const POWER_RULES = {
  fireball: { cost: 25, support: false }, flame_burst: { cost: 40, support: false },
  heal_wave: { cost: 30, support: true }, frost_shield: { cost: 35, support: true },
  stone_wall: { cost: 20, support: true }, earthquake: { cost: 45, support: false },
  dash: { cost: 15, support: true }, wind_blade: { cost: 20, support: false },
  shadow_step: { cost: 30, support: true }, dark_pulse: { cost: 35, support: false },
  divine_smite: { cost: 35, support: false }, holy_barrier: { cost: 40, support: true },
};
const elements = {
  fuego: ['fireball','flame_burst'], agua: ['heal_wave','frost_shield'],
  tierra: ['stone_wall','earthquake'], aire: ['dash','wind_blade'],
  sombra: ['shadow_step','dark_pulse'], luz: ['divine_smite','holy_barrier'],
};
export function powerRule(pet, slot) {
  if (!Number.isInteger(slot) || slot < -1 || slot > 3) throw Error('Poder inválido.');
  if (slot === -1) return { cost: 0, support: false, cooldown: 450 };
  if (slot === 2) return { cost: 15, support: true, cooldown: 7000 };
  if (slot === 3) return { cost: 40, support: false, cooldown: 22000 };
  const chosen = Array.isArray(pet.powers) ? pet.powers.filter(id => Object.hasOwn(POWER_RULES,id)) : [];
  const ids = chosen.length >= 2 ? chosen : elements[pet.traits?.element] || elements.fuego;
  return { ...POWER_RULES[ids[slot]], cooldown: slot === 0 ? 5000 : 8000 };
}
export function combatResources(world, now) {
  const combat = world.combat ||= { cooldowns: {}, encounters: {} };
  combat.mana = Math.min(100, Math.max(0, (combat.mana ?? 100) + Math.max(0, now - (combat.manaUpdatedAt ?? now)) * 0.004));
  combat.manaUpdatedAt = Math.max(now, combat.manaUpdatedAt ?? now);
  return combat;
}
export function spendPower(combat, rule, slot, now) {
  if ((combat.cooldowns[slot] || 0) > now) throw Object.assign(Error('La habilidad todavía se está recuperando.'), {status:429});
  if (combat.mana < rule.cost) throw Object.assign(Error('No tienes suficiente maná.'), {status:400});
  combat.mana -= rule.cost;
  combat.cooldowns[slot] = now + rule.cooldown;
}

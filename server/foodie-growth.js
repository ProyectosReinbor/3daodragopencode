export function applyPurchaseExperience(profile, amount, characterId) {
  const collection = profile.characters;
  const targetId = characterId || collection?.selectedId || profile.selectedCharacter;
  const pet = collection?.characters?.find((character) => character.id === targetId);
  if (!pet) throw new Error('Selecciona un Foodie Pet de tu colección para recibir la compra.');
  if (!Number.isInteger(amount) || amount < 0 || amount > 10000) throw new Error('La experiencia de esta compra no está configurada correctamente.');
  const before = { level: pet.level, xp: pet.xp };
  pet.xp += amount;
  while (pet.level < 100) {
    const required = pet.level * 25 + Math.floor(pet.level * pet.level * 2);
    if (pet.xp < required) break;
    pet.xp -= required; pet.level++;
  }
  if (pet.level >= 100) pet.xp = 0;
  return { characterId: pet.id, name: pet.name, amount, before, after: { level: pet.level, xp: pet.xp } };
}

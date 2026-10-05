export const APPEARANCE_ENUMS = {
  species: ['cat', 'insect', 'alien', 'monster', 'dragon', 'spirit'],
  mood: ['cute', 'fierce', 'grumpy', 'odd'],
  coat: ['smooth', 'fluffy', 'striped', 'spotted', 'dirty', 'scales'],
  ears: ['cat', 'long', 'round', 'none'],
  wings: ['none', 'insect', 'feather', 'bat'],
  limbKind: ['paws', 'hands', 'tentacles', 'claws'],
  tail: ['none', 'curled', 'long', 'spiked'],
  eyes: ['round', 'slit', 'bug', 'sleepy'],
};
export const APPEARANCE_NUMBERS = {
  headSize: [0.65, 1.6], bodyWidth: [0.6, 1.65], bodyHeight: [0.65, 1.6],
  headX: [-0.35, 0.35], headY: [-0.2, 0.35],
  eyeSize: [0.6, 1.7], eyeSpacing: [0.65, 1.6], eyeHeight: [-0.16, 0.18], eyeTilt: [-0.45, 0.45],
  earSize: [0.5, 1.6], wingSize: [0.5, 1.7], antennaLength: [0, 1.5],
  furLength: [0.03, 0.16], roughness: [0, 1], spikes: [0, 8],
};
export const DEFAULT_APPEARANCE = {
  species: 'cat', mood: 'cute', coat: 'fluffy', ears: 'cat', wings: 'none',
  limbKind: 'paws', tail: 'curled', eyes: 'round',
  headSize: 1.18, bodyWidth: 1, bodyHeight: 1, headX: 0, headY: 0,
  eyeSize: 1.15, eyeSpacing: 1, eyeHeight: 0, eyeTilt: 0,
  earSize: 1, wingSize: 1, antennaLength: 0, furLength: 0.07, roughness: 0.15, spikes: 0,
  eyeLeft: { x: 0, y: 0, z: 0 }, eyeRight: { x: 0, y: 0, z: 0 }, sculpt: [],
};
export const PET_PRESETS = [
  { id: 'cat', label: 'Gatito', icon: '🐱', description: 'Pelaje, patitas y bigotes', color: '#eab385', secondary: '#fff0d8', accent: '#f4a6a1', bodyType: 'bestia', limbs: 4,
    appearance: { species: 'cat', coat: 'fluffy', ears: 'cat', tail: 'curled', limbKind: 'paws', headSize: 1.22 } },
  { id: 'insect', label: 'Insecto', icon: '🪲', description: 'Caparazón, antenas y alas', color: '#86a674', secondary: '#d7ddac', accent: '#edc573', bodyType: 'bestia', limbs: 6,
    appearance: { species: 'insect', coat: 'dirty', ears: 'none', wings: 'insect', eyes: 'bug', tail: 'none', limbKind: 'claws', antennaLength: 1, headSize: 0.95 } },
  { id: 'alien', label: 'Extraterrestre', icon: '👽', description: 'Ojos enormes y manos curiosas', color: '#98b7cc', secondary: '#e4e1f2', accent: '#c4a5dc', bodyType: 'humanoid', limbs: 4,
    appearance: { species: 'alien', coat: 'smooth', ears: 'none', eyes: 'slit', tail: 'none', limbKind: 'hands', antennaLength: 0.6, headSize: 1.4, eyeSize: 1.45 } },
  { id: 'monster', label: 'Monstruito', icon: '👹', description: 'Fuerte, extraño o adorable', color: '#ac9abd', secondary: '#e9d2c7', accent: '#e8b968', bodyType: 'golem', limbs: 4,
    appearance: { species: 'monster', mood: 'fierce', coat: 'spotted', ears: 'round', tail: 'spiked', limbKind: 'hands', bodyWidth: 1.35, spikes: 4, headSize: 1.05 } },
  { id: 'dragon', label: 'Dragoncito', icon: '🐲', description: 'Escamas, cuernos y alas', color: '#84b6ab', secondary: '#e0efb8', accent: '#eccb76', bodyType: 'bestia', limbs: 4,
    appearance: { species: 'dragon', coat: 'scales', ears: 'long', wings: 'bat', tail: 'spiked', limbKind: 'claws', spikes: 4, headSize: 1.1 } },
  { id: 'spirit', label: 'Espíritu', icon: '👻', description: 'Suave y lleno de magia', color: '#c8b5df', secondary: '#eee6f5', accent: '#edbbd9', bodyType: 'espectral', limbs: 2,
    appearance: { species: 'spirit', coat: 'smooth', ears: 'long', wings: 'feather', tail: 'none', limbKind: 'tentacles', headSize: 1.15 } },
];

/** One schema for the editor and the server; the server never trusts mesh data. */
export function normalizeAppearance(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Revisa la personalización de tu Pet.');
  const result = structuredClone(DEFAULT_APPEARANCE);
  for (const [key, options] of Object.entries(APPEARANCE_ENUMS)) {
    if (value[key] !== undefined) {
      if (!options.includes(value[key])) throw new Error('Selecciona un rasgo válido.');
      result[key] = value[key];
    }
  }
  for (const [key, [min, max]] of Object.entries(APPEARANCE_NUMBERS)) {
    if (value[key] !== undefined) {
      if (!Number.isFinite(value[key]) || value[key] < min || value[key] > max || (key === 'spikes' && !Number.isInteger(value[key]))) throw new Error('Una proporción está fuera del rango permitido.');
      result[key] = value[key];
    }
  }
  for (const key of ['eyeLeft', 'eyeRight']) {
    if (value[key] === undefined) continue;
    const point = value[key];
    if (!point || typeof point !== 'object' || ['x', 'y', 'z'].some(axis => !Number.isFinite(point[axis]) || Math.abs(point[axis]) > 0.5)) throw new Error('La posición de los ojos no es válida.');
    result[key] = { x: point.x, y: point.y, z: point.z };
  }
  if (value.sculpt !== undefined) {
    if (!Array.isArray(value.sculpt) || value.sculpt.length > 48) throw new Error('Puedes guardar hasta 48 trazos de modelado.');
    result.sculpt = value.sculpt.map(stroke => {
      if (!stroke || !['head', 'body'].includes(stroke.part) || ['x', 'y', 'z'].some(axis => !Number.isFinite(stroke[axis]) || Math.abs(stroke[axis]) > 1.6) || !Number.isFinite(stroke.radius) || stroke.radius < 0.08 || stroke.radius > 0.65 || !Number.isFinite(stroke.strength) || Math.abs(stroke.strength) > 0.25) throw new Error('Un trazo de modelado no es válido.');
      return { part: stroke.part, x: stroke.x, y: stroke.y, z: stroke.z, radius: stroke.radius, strength: stroke.strength };
    });
  }
  return result;
}

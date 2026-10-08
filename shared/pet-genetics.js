import { APPEARANCE_ENUMS, DEFAULT_APPEARANCE, normalizeAppearance } from './pet-appearance.js';

const PROFILES = {
  cat: { ears: ['cat'], coat: ['fluffy', 'smooth', 'striped', 'spotted', 'marbled', 'calico', 'tuxedo'], tail: ['curled', 'long', 'fluffy', 'short'], limbKind: 'paws', limbs: 4 },
  dog: { ears: ['dog', 'round'], coat: ['fluffy', 'smooth', 'spotted', 'marbled', 'tuxedo'], tail: ['curled', 'fluffy', 'short'], limbKind: 'paws', limbs: 4 },
  rabbit: { ears: ['rabbit'], coat: ['fluffy', 'smooth', 'spotted', 'marbled', 'calico'], tail: ['short', 'fluffy'], limbKind: 'paws', limbs: 4 },
  fox: { ears: ['cat', 'long'], coat: ['fluffy', 'striped', 'spotted', 'marbled', 'tuxedo'], tail: ['fluffy', 'long'], limbKind: 'paws', limbs: 4 },
  bear: { ears: ['round'], coat: ['fluffy', 'smooth', 'spotted', 'tuxedo'], tail: ['short', 'none'], limbKind: 'paws', limbs: 4, width: 1.25 },
  bird: { ears: ['none'], coat: ['smooth', 'striped', 'spotted', 'marbled'], tail: ['short', 'long'], limbKind: 'claws', limbs: 2, wings: 'feather', height: 1.12 },
  axolotl: { ears: ['fins'], coat: ['smooth', 'spotted', 'marbled'], tail: ['fin'], limbKind: 'paws', limbs: 4, width: 1.15 },
  turtle: { ears: ['none'], coat: ['scales', 'smooth', 'spotted', 'marbled'], tail: ['short', 'none'], limbKind: 'claws', limbs: 4, width: 1.25, height: 0.8 },
  fish: { ears: ['fins'], coat: ['smooth', 'scales', 'striped', 'spotted', 'marbled'], tail: ['fin'], limbKind: 'paws', limbs: 0, width: 1.15 },
  insect: { ears: ['none'], coat: ['smooth', 'dirty', 'striped', 'spotted', 'marbled'], tail: ['none', 'short'], limbKind: 'claws', limbs: 6, wings: 'insect', antenna: 0.9 },
  alien: { ears: ['none', 'fins'], coat: ['smooth', 'spotted', 'marbled'], tail: ['none', 'short', 'long'], limbKind: 'hands', limbs: 4, bodyType: 'humanoid', antenna: 0.45, eyeSize: 1.05 },
  monster: { ears: ['round', 'long', 'cat'], coat: ['fluffy', 'spotted', 'marbled', 'striped', 'scales'], tail: ['spiked', 'curled', 'short'], limbKind: 'hands', limbs: 4, bodyType: 'golem', width: 1.2 },
  dragon: { ears: ['long', 'fins'], coat: ['scales', 'smooth', 'spotted', 'marbled'], tail: ['spiked', 'long', 'fin'], limbKind: 'claws', limbs: 4, wings: 'bat', spikes: 3 },
  spirit: { ears: ['long', 'round', 'none'], coat: ['smooth', 'marbled', 'spotted'], tail: ['none', 'long'], limbKind: 'tentacles', limbs: 2, bodyType: 'espectral' },
};
const HYBRIDS = {
  cat: ['dog', 'rabbit', 'fox', 'bird', 'dragon', 'spirit'], dog: ['cat', 'rabbit', 'bear', 'fox', 'dragon'],
  rabbit: ['cat', 'fox', 'dog', 'bird', 'spirit'], fox: ['cat', 'dog', 'rabbit', 'dragon'], bear: ['cat', 'dog', 'rabbit', 'monster'],
  bird: ['insect', 'dragon', 'spirit'], axolotl: ['fish', 'dragon', 'spirit'], turtle: ['axolotl', 'dragon', 'fish'],
  fish: ['axolotl', 'dragon', 'spirit'], insect: ['bird', 'dragon', 'alien'], alien: ['insect', 'axolotl', 'spirit', 'monster'],
  monster: ['cat', 'dog', 'bear', 'dragon', 'alien'], dragon: ['fox', 'cat', 'bird', 'axolotl', 'monster'],
  spirit: ['cat', 'rabbit', 'bird', 'axolotl', 'dragon'],
};
const THEME_WEIGHTS = {
  forest: { cat: 5, dog: 5, rabbit: 6, fox: 6, bear: 5, bird: 4, insect: 4, turtle: 3 },
  fire: { dragon: 7, fox: 5, dog: 4, monster: 4, cat: 4, bird: 3 },
  water: { axolotl: 7, fish: 7, turtle: 5, spirit: 4, alien: 3, cat: 3 },
  mystery: {},
};
const ELEMENTS = { forest: ['tierra', 'tierra', 'tierra', 'aire', 'agua', 'luz'], fire: ['fuego', 'fuego', 'fuego', 'tierra', 'luz', 'sombra'],
  water: ['agua', 'agua', 'agua', 'aire', 'luz', 'sombra'], mystery: ['tierra', 'fuego', 'agua', 'aire', 'luz', 'sombra'] };
const HUES = { forest: [100, 130, 160, 45, 25], fire: [12, 30, 350, 45, 285], water: [170, 195, 220, 260, 310], mystery: [0, 45, 90, 140, 185, 225, 270, 315] };

function sample(rng) {
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('El generador aleatorio debe devolver un número entre 0 y 1.');
  return value;
}
const pick = (values, rng) => values[Math.floor(sample(rng) * values.length)];
const within = (low, high, rng) => Math.round((low + sample(rng) * (high - low)) * 1000) / 1000;
function enumPick(key, candidates, rng) {
  const valid = candidates.filter(value => APPEARANCE_ENUMS[key]?.includes(value));
  return pick(valid.length ? valid : APPEARANCE_ENUMS[key], rng);
}
function hslColor(hue, saturation, lightness) {
  const h = ((hue % 360) + 360) % 360 / 360, s = saturation / 100, l = lightness / 100;
  const channel = offset => {
    const k = (offset + h * 12) % 12;
    return Math.round(255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return channel(0) * 65536 + channel(8) * 256 + channel(4);
}

/** Shared phenotype generator. Server callers supply crypto RNG; previews can supply a seed. */
export function generatePetTraits(theme = 'mystery', rng = Math.random) {
  if (!Object.hasOwn(THEME_WEIGHTS, theme)) throw new Error('Elige una afinidad de huevo válida.');
  const speciesChoices = APPEARANCE_ENUMS.species.filter(species => PROFILES[species]);
  const weights = THEME_WEIGHTS[theme];
  const total = speciesChoices.reduce((sum, species) => sum + (weights[species] || 1), 0);
  let roll = sample(rng) * total, species = speciesChoices[speciesChoices.length - 1];
  for (const candidate of speciesChoices) {
    roll -= weights[candidate] || 1;
    if (roll < 0) { species = candidate; break; }
  }
  const profile = PROFILES[species];
  const appearance = { ...structuredClone(DEFAULT_APPEARANCE), species,
    mood: enumPick('mood', ['cute', 'cute', 'cute', 'grumpy', 'fierce'], rng),
    coat: enumPick('coat', profile.coat, rng), ears: enumPick('ears', profile.ears, rng),
    wings: enumPick('wings', [profile.wings || 'none', profile.wings || 'none', 'none'], rng),
    limbKind: profile.limbKind, tail: enumPick('tail', profile.tail, rng),
    eyes: enumPick('eyes', ['round', 'round', 'sleepy', 'sparkling', ...(species === 'insect' ? ['bug', 'bug'] : species === 'dragon' || species === 'alien' ? ['slit'] : [])], rng),
    headSize: within(1.0, 1.38, rng), bodyWidth: within((profile.width || 1) - 0.12, (profile.width || 1) + 0.12, rng),
    bodyHeight: within((profile.height || 1) - 0.12, (profile.height || 1) + 0.12, rng),
    headX: within(-0.05, 0.05, rng), headY: within(-0.15, -0.05, rng),
    eyeSize: within((profile.eyeSize || 1) - 0.1, (profile.eyeSize || 1.2) + 0.15, rng), eyeSpacing: within(0.88, 1.25, rng),
    eyeHeight: within(-0.06, 0.1, rng), eyeTilt: within(-0.12, 0.12, rng), earSize: within(0.8, 1.3, rng),
    wingSize: within(0.8, 1.25, rng), antennaLength: profile.antenna ? within(profile.antenna * 0.75, profile.antenna * 1.2, rng) : 0,
    furLength: within(0.035, 0.065, rng), roughness: within(0.18, 0.65, rng), spikes: profile.spikes ? Math.floor(sample(rng) * 5) + 1 : 0,
  };
  // A compatible family can contribute a coat or small wing variant.
  // The defining face, tail and limb anatomy always stay with the base species.
  if (sample(rng) < 0.18) {
    const donorSpecies = pick(HYBRIDS[species].filter(value => speciesChoices.includes(value)), rng);
    const donor = PROFILES[donorSpecies];
    const feature = 'coat';
    appearance[feature] = enumPick(feature, donor[feature], rng);
    if (donor.wings === 'bat' && ['cat', 'dog', 'fox'].includes(species) && sample(rng) < 0.3) appearance.wings = 'bat';
    
  }
  if (APPEARANCE_ENUMS.markings) appearance.markings = enumPick('markings', ['none', 'mask', 'socks', 'blaze', 'freckles', 'bands'], rng);
  if (APPEARANCE_ENUMS.eyeColor) appearance.eyeColor = enumPick('eyeColor', ['mint', 'sky', 'amber', 'violet', 'rose', 'lime'], rng);
  const headShape = ['alien', 'monster', 'spirit'].includes(species) ? pick(['round', 'round', 'round', 'round', 'diamond', 'cube'], rng) : 'round';
  const eyeShift = within(-0.02, 0.02, rng), eyeLift = within(-0.01, 0.01, rng);
  for (const [key, side] of [['eyeLeft', -1], ['eyeRight', 1]]) {
    const x = side * eyeShift;
    const nx = (side * 0.19 * appearance.headSize * appearance.eyeSpacing + x) / (0.48 * appearance.headSize);
    const ny = (0.035 + appearance.eyeHeight + eyeLift) / (0.41 * appearance.headSize);
    const surface = headShape === 'cube' ? 1 : Math.sqrt(1 - nx * nx - ny * ny);
    appearance[key] = { x, y: eyeLift, z: Math.round((0.38 * appearance.headSize * (surface - 0.88) - 0.025) * 1000) / 1000 };
  }
  const hue = (sample(rng) < 0.75 ? pick(HUES[theme], rng) : within(0, 360, rng)) + within(-16, 16, rng);
  const primaryColor = hslColor(hue, within(52, 75, rng), within(48, 66, rng));
  const secondaryColor = hslColor(hue + within(30, 100, rng), within(12, 30, rng), within(87, 94, rng));
  const accentColor = hslColor(hue + within(120, 220, rng), within(35, 58, rng), within(38, 52, rng));
  return { appearance: normalizeAppearance(appearance), element: pick(ELEMENTS[theme], rng), rarity: 'comun',
    bodyType: profile.bodyType || 'bestia', headShape,
    limbCount: profile.limbs,
    limbLength: within(0.65, 1.05, rng), primaryColor, secondaryColor, accentColor,
    eyeStyle: { round: 0, slit: 1, sleepy: 2, bug: 3, sparkling: 4 }[appearance.eyes],
    hornStyle: species === 'dragon' || species === 'monster' ? Math.floor(sample(rng) * 2) : 0,
    wingStyle: appearance.wings === 'none' ? 0 : 1,
    pattern: appearance.coat === 'striped' ? 1 : appearance.coat === 'spotted' ? 2 : appearance.coat === 'scales' ? 3 : 0 };
}

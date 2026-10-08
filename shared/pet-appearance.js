import { petSpeciesName } from './pet-species.js';
export const APPEARANCE_ENUMS = {
  species: [
    'cat',
    'insect',
    'alien',
    'monster',
    'dragon',
    'spirit',
    'dog',
    'rabbit',
    'fox',
    'bear',
    'bird',
    'axolotl',
    'turtle',
    'fish',
  ],
  mood: ['cute', 'fierce', 'grumpy', 'odd'],
  coat: [
    'smooth',
    'fluffy',
    'striped',
    'spotted',
    'dirty',
    'scales',
    'marbled',
    'calico',
    'tuxedo',
  ],
  ears: ['cat', 'long', 'round', 'none', 'dog', 'rabbit', 'fins'],
  wings: ['none', 'insect', 'feather', 'bat'],
  limbKind: ['paws', 'hands', 'tentacles', 'claws'],
  tail: ['none', 'curled', 'long', 'spiked', 'fluffy', 'fin', 'short'],
  eyes: ['round', 'slit', 'bug', 'sleepy', 'sparkling'],
  markings: ['none', 'mask', 'socks', 'blaze', 'freckles', 'bands'],
  eyeColor: ['mint', 'sky', 'amber', 'violet', 'rose', 'lime'],
};
export const APPEARANCE_NUMBERS = {
  headSize: [0.65, 1.6],
  bodyWidth: [0.6, 1.65],
  bodyHeight: [0.65, 1.6],
  headX: [-0.35, 0.35],
  headY: [-0.2, 0.35],
  eyeSize: [0.6, 1.7],
  eyeSpacing: [0.65, 1.6],
  eyeHeight: [-0.16, 0.18],
  eyeTilt: [-0.45, 0.45],
  earSize: [0.5, 1.6],
  wingSize: [0.5, 1.7],
  antennaLength: [0, 1.5],
  furLength: [0.03, 0.16],
  roughness: [0, 1],
  spikes: [0, 8],
};
export const DEFAULT_APPEARANCE = {
  species: 'cat',
  mood: 'cute',
  coat: 'fluffy',
  ears: 'cat',
  wings: 'none',
  limbKind: 'paws',
  tail: 'curled',
  eyes: 'round',
  markings: 'none',
  eyeColor: 'mint',
  headSize: 1.18,
  bodyWidth: 1,
  bodyHeight: 1,
  headX: 0,
  headY: 0,
  eyeSize: 1.15,
  eyeSpacing: 1,
  eyeHeight: 0,
  eyeTilt: 0,
  earSize: 1,
  wingSize: 1,
  antennaLength: 0,
  furLength: 0.07,
  roughness: 0.15,
  spikes: 0,
  eyeLeft: { x: 0, y: 0, z: 0 },
  eyeRight: { x: 0, y: 0, z: 0 },
  sculpt: [],
};
export const PET_PRESETS = [
  {
    id: 'cat',
    label: petSpeciesName('cat'),
    icon: '🐱',
    description: 'Pelaje, patitas y bigotes',
    color: '#55ad86',
    secondary: '#f3e7b4',
    accent: '#2e725e',
    bodyType: 'bestia',
    limbs: 4,
    appearance: {
      species: 'cat',
      coat: 'fluffy',
      ears: 'cat',
      tail: 'curled',
      limbKind: 'paws',
      headSize: 1.22,
    },
  },
  {
    id: 'insect',
    label: petSpeciesName('insect'),
    icon: '🪲',
    description: 'Caparazón, antenas y alas',
    color: '#80ae41',
    secondary: '#f1dd8a',
    accent: '#965aca',
    bodyType: 'bestia',
    limbs: 6,
    appearance: {
      species: 'insect',
      coat: 'dirty',
      ears: 'none',
      wings: 'insect',
      eyes: 'bug',
      tail: 'none',
      limbKind: 'claws',
      antennaLength: 1,
      headSize: 0.95,
    },
  },
  {
    id: 'alien',
    label: petSpeciesName('alien'),
    icon: '👽',
    description: 'Ojos enormes y manos curiosas',
    color: '#8883d3',
    secondary: '#e7eafa',
    accent: '#4b446d',
    bodyType: 'humanoid',
    limbs: 4,
    appearance: {
      species: 'alien',
      coat: 'smooth',
      ears: 'none',
      eyes: 'slit',
      tail: 'none',
      limbKind: 'hands',
      antennaLength: 0.6,
      headSize: 1.4,
      eyeSize: 1.45,
    },
  },
  {
    id: 'monster',
    label: petSpeciesName('monster'),
    icon: '👹',
    description: 'Fuerte, extraño o adorable',
    color: '#687d92',
    secondary: '#c7d0d5',
    accent: '#f0aa48',
    bodyType: 'golem',
    limbs: 4,
    appearance: {
      species: 'monster',
      mood: 'fierce',
      coat: 'spotted',
      ears: 'round',
      tail: 'spiked',
      limbKind: 'hands',
      bodyWidth: 1.35,
      spikes: 4,
      headSize: 1.05,
    },
  },
  {
    id: 'dragon',
    label: petSpeciesName('dragon'),
    icon: '🐲',
    description: 'Escamas, cuernos y alas',
    color: '#e27555',
    secondary: '#f9deb0',
    accent: '#555c8f',
    bodyType: 'bestia',
    limbs: 4,
    appearance: {
      species: 'dragon',
      coat: 'scales',
      ears: 'long',
      wings: 'bat',
      tail: 'spiked',
      limbKind: 'claws',
      spikes: 4,
      headSize: 1.1,
    },
  },
  {
    id: 'spirit',
    label: petSpeciesName('spirit'),
    icon: '👻',
    description: 'Suave y lleno de magia',
    color: '#8b7fc4',
    secondary: '#e5dafa',
    accent: '#69c9bc',
    bodyType: 'espectral',
    limbs: 2,
    appearance: {
      species: 'spirit',
      coat: 'smooth',
      ears: 'long',
      wings: 'none',
      tail: 'none',
      limbKind: 'tentacles',
      headSize: 1.15,
    },
  },
  {
    id: 'dog',
    label: petSpeciesName('dog'),
    icon: '🐶',
    description: 'Hocico redondo y orejas caídas',
    color: '#df9b53',
    secondary: '#fbefc7',
    accent: '#675558',
    bodyType: 'bestia',
    limbs: 4,
    appearance: {
      species: 'dog',
      coat: 'tuxedo',
      ears: 'dog',
      tail: 'short',
      eyes: 'round',
      eyeColor: 'amber',
      markings: 'socks',
      headSize: 1.2,
    },
  },
  {
    id: 'rabbit',
    label: petSpeciesName('rabbit'),
    icon: '🐰',
    description: 'Orejas largas, mejillas y dientecitos',
    color: '#b5b8e9',
    secondary: '#f6eaf6',
    accent: '#6b69a7',
    bodyType: 'bestia',
    limbs: 4,
    appearance: {
      species: 'rabbit',
      coat: 'fluffy',
      ears: 'rabbit',
      tail: 'short',
      eyes: 'sparkling',
      eyeColor: 'rose',
      headSize: 1.16,
      earSize: 1.1,
    },
  },
  {
    id: 'fox',
    label: petSpeciesName('fox'),
    icon: '🦊',
    description: 'Hocico fino y una gran cola suave',
    color: '#ca7860',
    secondary: '#fff0ce',
    accent: '#604a74',
    bodyType: 'bestia',
    limbs: 4,
    appearance: {
      species: 'fox',
      coat: 'smooth',
      ears: 'cat',
      tail: 'fluffy',
      eyes: 'slit',
      eyeColor: 'amber',
      markings: 'socks',
      headSize: 1.1,
    },
  },
  {
    id: 'bear',
    label: petSpeciesName('bear'),
    icon: '🐻',
    description: 'Orejas redondas y patitas mullidas',
    color: '#9a8968',
    secondary: '#f7df9d',
    accent: '#649b89',
    bodyType: 'bestia',
    limbs: 4,
    appearance: {
      species: 'bear',
      coat: 'smooth',
      ears: 'round',
      tail: 'short',
      eyes: 'round',
      eyeColor: 'sky',
      bodyWidth: 1.25,
      markings: 'mask',
      headSize: 1.16,
    },
  },
  {
    id: 'bird',
    label: petSpeciesName('bird'),
    icon: '🐦',
    description: 'Pico pequeño, plumas y deditos',
    color: '#5c9daa',
    secondary: '#f9e9bd',
    accent: '#dd935a',
    bodyType: 'bestia',
    limbs: 2,
    appearance: {
      species: 'bird',
      coat: 'smooth',
      ears: 'none',
      wings: 'feather',
      tail: 'short',
      limbKind: 'claws',
      eyes: 'sparkling',
      eyeColor: 'violet',
      headSize: 1.08,
    },
  },
  {
    id: 'axolotl',
    label: petSpeciesName('axolotl'),
    icon: '🫧',
    description: 'Branquias suaves y sonrisa ancha',
    color: '#d68fb6',
    secondary: '#fae3e8',
    accent: '#7574bc',
    bodyType: 'bestia',
    limbs: 4,
    appearance: {
      species: 'axolotl',
      coat: 'smooth',
      ears: 'fins',
      tail: 'fin',
      eyes: 'round',
      eyeColor: 'mint',
      markings: 'freckles',
      bodyWidth: 1.1,
      headSize: 1.2,
    },
  },
  {
    id: 'turtle',
    label: petSpeciesName('turtle'),
    icon: '🐢',
    description: 'Caparazón abombado y patas cortas',
    color: '#58a294',
    secondary: '#f1d5a2',
    accent: '#716a9b',
    bodyType: 'bestia',
    limbs: 4,
    appearance: {
      species: 'turtle',
      coat: 'scales',
      ears: 'none',
      tail: 'short',
      eyes: 'round',
      eyeColor: 'lime',
      bodyHeight: 0.8,
      bodyWidth: 1.2,
      headSize: 1.05,
    },
  },
  {
    id: 'fish',
    label: petSpeciesName('fish'),
    icon: '🐟',
    description: 'Aletas, branquias y labios redondos',
    color: '#5c9fcb',
    secondary: '#e7ecf8',
    accent: '#e29a78',
    bodyType: 'espectral',
    limbs: 0,
    appearance: {
      species: 'fish',
      coat: 'marbled',
      ears: 'fins',
      tail: 'fin',
      eyes: 'sparkling',
      eyeColor: 'sky',
      bodyHeight: 0.8,
      headSize: 1.1,
    },
  },
];

/** One schema for the editor and the server; the server never trusts mesh data. */
export function normalizeAppearance(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Revisa la personalización de tu Pet.');
  const result = structuredClone(DEFAULT_APPEARANCE);
  for (const [key, options] of Object.entries(APPEARANCE_ENUMS)) {
    if (value[key] !== undefined) {
      if (!options.includes(value[key])) throw new Error('Selecciona un rasgo válido.');
      result[key] = value[key];
    }
  }
  for (const [key, [min, max]] of Object.entries(APPEARANCE_NUMBERS)) {
    if (value[key] !== undefined) {
      if (
        !Number.isFinite(value[key]) ||
        value[key] < min ||
        value[key] > max ||
        (key === 'spikes' && !Number.isInteger(value[key]))
      )
        throw new Error('Una proporción está fuera del rango permitido.');
      result[key] = value[key];
    }
  }
  for (const key of ['eyeLeft', 'eyeRight']) {
    if (value[key] === undefined) continue;
    const point = value[key];
    if (
      !point ||
      typeof point !== 'object' ||
      ['x', 'y', 'z'].some((axis) => !Number.isFinite(point[axis]) || Math.abs(point[axis]) > 0.5)
    )
      throw new Error('La posición de los ojos no es válida.');
    result[key] = { x: point.x, y: point.y, z: point.z };
  }
  if (value.sculpt !== undefined) {
    if (!Array.isArray(value.sculpt) || value.sculpt.length > 48)
      throw new Error('Puedes guardar hasta 48 trazos de modelado.');
    result.sculpt = value.sculpt.map((stroke) => {
      if (
        !stroke ||
        !['head', 'body'].includes(stroke.part) ||
        ['x', 'y', 'z'].some(
          (axis) => !Number.isFinite(stroke[axis]) || Math.abs(stroke[axis]) > 1.6
        ) ||
        !Number.isFinite(stroke.radius) ||
        stroke.radius < 0.08 ||
        stroke.radius > 0.65 ||
        !Number.isFinite(stroke.strength) ||
        Math.abs(stroke.strength) > 0.25
      )
        throw new Error('Un trazo de modelado no es válido.');
      return {
        part: stroke.part,
        x: stroke.x,
        y: stroke.y,
        z: stroke.z,
        radius: stroke.radius,
        strength: stroke.strength,
      };
    });
  }
  return result;
}

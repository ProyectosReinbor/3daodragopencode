import type { PetAppearance } from './pet-appearance.js';
export interface GeneratedPetTraits {
  appearance: PetAppearance; element: 'fuego' | 'agua' | 'tierra' | 'aire' | 'sombra' | 'luz'; rarity: 'comun';
  bodyType: 'bestia' | 'humanoid' | 'golem' | 'espectral'; headShape: 'round' | 'cube' | 'diamond';
  limbCount: number; limbLength: number; primaryColor: number; secondaryColor: number; accentColor: number;
  eyeStyle: number; hornStyle: number; wingStyle: number; pattern: number;
}
export function generatePetTraits(theme?: 'forest' | 'fire' | 'water' | 'mystery', rng?: () => number): GeneratedPetTraits;

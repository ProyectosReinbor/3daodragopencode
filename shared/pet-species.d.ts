import type { PetAppearance } from './pet-appearance.js';
export const PET_SPECIES_NAMES: Readonly<Record<PetAppearance['species'], string>>;
export function petSpeciesName(species: string): string;

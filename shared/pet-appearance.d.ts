export interface SculptStroke { part: 'head' | 'body'; x: number; y: number; z: number; radius: number; strength: number; }
export interface EyeOffset { x: number; y: number; z: number; }
export interface PetAppearance {
  species: 'cat' | 'insect' | 'alien' | 'monster' | 'dragon' | 'spirit';
  mood: 'cute' | 'fierce' | 'grumpy' | 'odd';
  coat: 'smooth' | 'fluffy' | 'striped' | 'spotted' | 'dirty' | 'scales';
  ears: 'cat' | 'long' | 'round' | 'none'; wings: 'none' | 'insect' | 'feather' | 'bat';
  limbKind: 'paws' | 'hands' | 'tentacles' | 'claws'; tail: 'none' | 'curled' | 'long' | 'spiked';
  eyes: 'round' | 'slit' | 'bug' | 'sleepy';
  headSize: number; bodyWidth: number; bodyHeight: number; headX: number; headY: number;
  eyeSize: number; eyeSpacing: number; eyeHeight: number; eyeTilt: number;
  earSize: number; wingSize: number; antennaLength: number; furLength: number; roughness: number; spikes: number;
  eyeLeft: EyeOffset; eyeRight: EyeOffset; sculpt: SculptStroke[];
}
export const APPEARANCE_ENUMS: Record<string, string[]>;
export const APPEARANCE_NUMBERS: Record<string, [number, number]>;
export const DEFAULT_APPEARANCE: PetAppearance;
export const PET_PRESETS: { id: PetAppearance['species']; label: string; icon: string; description: string; color: string; secondary: string; accent: string; bodyType: 'bestia' | 'humanoid' | 'golem' | 'espectral'; limbs: number; appearance: Partial<PetAppearance> }[];
export function normalizeAppearance(value: unknown): PetAppearance | undefined;

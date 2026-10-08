export type EggTheme = 'forest' | 'fire' | 'water' | 'mystery';
export type GuardianAction = 'choose_egg' | 'warm_egg' | 'hatch' | 'feed' | 'play' | 'rest' | 'bathe' | 'pet' | 'train' | 'claim_mission' | 'rename_pet';
export type GuardianMissionId = 'firstcare' | 'incubation' | 'hatching';
export interface GuardianEgg {
  id: string; theme: EggTheme; label: string; status: 'incubating' | 'ready' | 'hatched';
  /** Each warmth action improves all birth stats; three unlock an early birth. */
  care: number; requiredCare: number;
  /** Persisted server deadline; existing eggs retain their original deadline. */
  readyAt: number; createdAt?: number; warmthBonus?: number; petId?: string;
}
export interface GuardianCare {
  satiety: number; energy: number; mood: number; hygiene: number; affection: number; health: number; curiosity: number;
  updatedAt: number; stage: 'baby' | 'juvenile' | 'adult'; personality: string; activity: string;
}
export interface GuardianGenetics {
  genomeId: string; fingerprint: string; generation: number; parents: string[]; origin: string; species: string;
  affinity: string; knownGenes: string[]; hiddenGenes: number;
}
export interface GuardianMission {
  id: GuardianMissionId; title: string; description: string; progress: number; target: number; claimed: boolean;
  reward: { food: number; coins: number; xp: number };
}
export interface GuardianState {
  version: 1; serverNow: number; food: number; eggs: GuardianEgg[]; care: Record<string, GuardianCare>;
  genetics: Record<string, GuardianGenetics>; discoveries: { species: string[]; genes: string[]; zones: string[] };
  missions: GuardianMission[];
}
export interface GuardianRequest {
  action: GuardianAction; requestId: string; petId?: string; eggId?: string; theme?: EggTheme; missionId?: GuardianMissionId; name?: string;
}
export interface GuardianResponse<Profile = unknown> { profile: Profile; guardian: GuardianState; message?: string; }

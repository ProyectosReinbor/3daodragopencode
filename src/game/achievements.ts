export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: 'exploration' | 'combat' | 'collection' | 'social' | 'crafting';
  icon: string;
  requirement: number;
  reward?: { type: 'xp' | 'title'; value: number | string };
}

export interface PlayerAchievement {
  id: string;
  progress: number;
  completed: boolean;
  completedAt?: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'explorer_1',
    name: 'Explorador',
    description: 'Visita todas las zonas disponibles',
    category: 'exploration',
    icon: '🗺️',
    requirement: 5,
    reward: { type: 'xp', value: 100 },
  },
  {
    id: 'explorer_2',
    name: 'Viajero',
    description: 'Cambia de zona 10 veces',
    category: 'exploration',
    icon: '🌍',
    requirement: 10,
    reward: { type: 'xp', value: 150 },
  },
  {
    id: 'explorer_3',
    name: 'Maestro Explorador',
    description: 'Cambia de zona 50 veces',
    category: 'exploration',
    icon: '⭐',
    requirement: 50,
    reward: { type: 'xp', value: 300 },
  },
  {
    id: 'wolf_hunter_1',
    name: 'Cazador de Lobos',
    description: 'Mata 10 lobos',
    category: 'combat',
    icon: '🐺',
    requirement: 10,
    reward: { type: 'xp', value: 80 },
  },
  {
    id: 'wolf_hunter_2',
    name: 'Lobo Solitario',
    description: 'Mata 50 lobos',
    category: 'combat',
    icon: '🐺',
    requirement: 50,
    reward: { type: 'xp', value: 200 },
  },
  {
    id: 'spirit_hunter_1',
    name: 'Cazador de Espiritus',
    description: 'Mata 10 espiritus',
    category: 'combat',
    icon: '👻',
    requirement: 10,
    reward: { type: 'xp', value: 100 },
  },
  {
    id: 'golem_hunter_1',
    name: 'Destructor de Golems',
    description: 'Mata 10 golems',
    category: 'combat',
    icon: '🗿',
    requirement: 10,
    reward: { type: 'xp', value: 150 },
  },
  {
    id: 'monster_slayer_1',
    name: 'Monster Slayer',
    description: 'Mata 100 criaturas',
    category: 'combat',
    icon: '⚔️',
    requirement: 100,
    reward: { type: 'xp', value: 500 },
  },
  {
    id: 'monster_slayer_2',
    name: 'Carnicero',
    description: 'Mata 500 criaturas',
    category: 'combat',
    icon: '💀',
    requirement: 500,
    reward: { type: 'xp', value: 1000 },
  },
  {
    id: 'collector_1',
    name: 'Recolector',
    description: 'Recoge 50 recursos',
    category: 'collection',
    icon: '📦',
    requirement: 50,
    reward: { type: 'xp', value: 60 },
  },
  {
    id: 'collector_2',
    name: 'Acumulador',
    description: 'Recoge 200 recursos',
    category: 'collection',
    icon: '🎒',
    requirement: 200,
    reward: { type: 'xp', value: 200 },
  },
  {
    id: 'collector_3',
    name: 'Hoarder',
    description: 'Recoge 1000 recursos',
    category: 'collection',
    icon: '💎',
    requirement: 1000,
    reward: { type: 'xp', value: 500 },
  },
  {
    id: 'crafter_1',
    name: 'Aprendiz',
    description: 'Fabrica 10 objetos',
    category: 'crafting',
    icon: '🔨',
    requirement: 10,
    reward: { type: 'xp', value: 50 },
  },
  {
    id: 'crafter_2',
    name: 'Artesano',
    description: 'Fabrica 50 objetos',
    category: 'crafting',
    icon: '⚒️',
    requirement: 50,
    reward: { type: 'xp', value: 200 },
  },
  {
    id: 'crafter_3',
    name: 'Maestro Artesano',
    description: 'Fabrica 200 objetos',
    category: 'crafting',
    icon: '🏆',
    requirement: 200,
    reward: { type: 'xp', value: 500 },
  },
  {
    id: 'level_5',
    name: 'Novato',
    description: 'Alcanza nivel 5',
    category: 'combat',
    icon: '⭐',
    requirement: 5,
    reward: { type: 'xp', value: 100 },
  },
  {
    id: 'level_10',
    name: 'Veterano',
    description: 'Alcanza nivel 10',
    category: 'combat',
    icon: '⭐',
    requirement: 10,
    reward: { type: 'xp', value: 200 },
  },
  {
    id: 'level_20',
    name: 'Maestro',
    description: 'Alcanza nivel 20',
    category: 'combat',
    icon: '⭐',
    requirement: 20,
    reward: { type: 'xp', value: 500 },
  },
  {
    id: 'quest_complete_1',
    name: 'Misionero',
    description: 'Completa 3 misiones',
    category: 'exploration',
    icon: '📜',
    requirement: 3,
    reward: { type: 'xp', value: 100 },
  },
  {
    id: 'quest_complete_2',
    name: 'Héroe',
    description: 'Completa todas las misiones',
    category: 'exploration',
    icon: '👑',
    requirement: 7,
    reward: { type: 'xp', value: 500 },
  },
];

export function createAchievements(): PlayerAchievement[] {
  return ACHIEVEMENTS.map((a) => ({
    id: a.id,
    progress: 0,
    completed: false,
  }));
}

export function updateAchievement(
  achievements: PlayerAchievement[],
  id: string,
  amount: number
): PlayerAchievement[] {
  return achievements.map((a) => {
    if (a.id !== id || a.completed) return a;
    const def = ACHIEVEMENTS.find((d) => d.id === id);
    if (!def) return a;
    const newProgress = a.progress + amount;
    if (newProgress >= def.requirement) {
      return {
        ...a,
        progress: def.requirement,
        completed: true,
        completedAt: Date.now(),
      };
    }
    return { ...a, progress: newProgress };
  });
}

export function getAchievementDef(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function getCompletedCount(achievements: PlayerAchievement[]): number {
  return achievements.filter((a) => a.completed).length;
}

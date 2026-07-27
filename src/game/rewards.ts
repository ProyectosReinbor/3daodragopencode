/**
 * Adaptador de códigos QR de restaurantes.
 * En producción, cada código se valida en servidor contra una base de datos
 * de códigos generados por los comercios afiliados.
 * Cada código solo puede canjearse una vez por cuenta.
 */
import { type NftCharacter, type StatName } from './nft';

export interface QrUpgrade {
  codeId: string;
  type: 'stat_boost' | 'xp_boost' | 'cosmetic';
  stat?: StatName;
  amount: number;
  label: string;
}

const STAT_NAMES: Record<StatName, string> = {
  atk: 'Ataque',
  def: 'Defensa',
  spd: 'Velocidad',
  hp: 'Vida',
  ability: 'Habilidad',
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateDemoQrUpgrade(): QrUpgrade {
  const types: QrUpgrade['type'][] = [
    'stat_boost',
    'stat_boost',
    'stat_boost',
    'xp_boost',
    'xp_boost',
    'cosmetic',
  ];
  const type = pick(types);
  if (type === 'stat_boost') {
    const stat = pick(['atk', 'def', 'spd', 'hp', 'ability'] as StatName[]);
    const amount = 1 + Math.floor(Math.random() * 3);
    return {
      codeId: `DEMO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      stat,
      amount,
      label: `+${amount} ${STAT_NAMES[stat]}`,
    };
  }
  if (type === 'xp_boost') {
    const amount = 10 + Math.floor(Math.random() * 25);
    return {
      codeId: `DEMO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      amount,
      label: `+${amount} EXP`,
    };
  }
  return {
    codeId: `DEMO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    amount: 1,
    label: 'Mejora cosmética',
  };
}

export function applyQrUpgrade(nft: NftCharacter, upgrade: QrUpgrade): string {
  if (upgrade.type === 'stat_boost' && upgrade.stat) {
    nft.upgrades.push({
      source: 'qr',
      label: upgrade.label,
      stat: upgrade.stat,
      amount: upgrade.amount,
      timestamp: Date.now(),
    });
    return `${upgrade.label} aplicado a ${nft.name}`;
  }
  if (upgrade.type === 'xp_boost') {
    nft.xp += upgrade.amount;
    return `+${upgrade.amount} EXP para ${nft.name}`;
  }
  return `Mejora cosmética desbloqueada para ${nft.name}`;
}

export type Reward = {
  id: string;
  label: string;
  health: number;
  energy: number;
  resource?: 'trigo' | 'mineral' | 'esencia';
  amount?: number;
};

const demoRewards: Record<string, Reward> = {
  TABERNA: { id: 'TABERNA', label: 'Restauración de la taberna', health: 30, energy: 30 },
  PANADERIA: {
    id: 'PANADERIA',
    label: 'Ración de panadero',
    health: 0,
    energy: 25,
    resource: 'trigo',
    amount: 2,
  },
  FOGATA: { id: 'FOGATA', label: 'Comida de fogata', health: 20, energy: 15 },
  MERCADO: {
    id: 'MERCADO',
    label: 'Botín del mercado',
    health: 0,
    energy: 0,
    resource: 'mineral',
    amount: 3,
  },
};

export async function validateRewardCode(code: string): Promise<Reward | undefined> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  return demoRewards[code.trim().toUpperCase()];
}

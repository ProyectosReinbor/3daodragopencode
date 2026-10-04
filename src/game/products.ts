import type { Product } from './stores';

export function getRewardLabel(product: Product): string {
  const typeLabels: Record<string, string> = {
    character: 'Personaje',
    item: 'Objeto',
    currency: 'Monedas',
    crystals: 'Cristales',
    consumable: 'Consumible',
  };
  const qty = product.reward_qty > 1 ? ` ×${product.reward_qty}` : '';
  return `${typeLabels[product.reward_type] ?? product.reward_type}: ${product.reward_name}${qty}`;
}

export function getRarityLabel(rarity: string): string {
  const labels: Record<string, string> = {
    comun: 'Común',
    raro: 'Raro',
    epico: 'Épico',
    legendario: 'Legendario',
    especial: 'Especial',
  };
  return labels[rarity] ?? rarity;
}

export function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    comun: '#aabbaa',
    raro: '#4488ff',
    epico: '#aa44ff',
    legendario: '#ffaa00',
    especial: '#df6499',
  };
  return colors[rarity] ?? '#aabbaa';
}

export function formatPrice(product: Product): string {
  const symbols: Record<string, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    MXN: 'MX$',
  };
  const sym = symbols[product.currency] ?? product.currency;
  return `${sym}${product.price.toFixed(2)} ${product.currency}`;
}

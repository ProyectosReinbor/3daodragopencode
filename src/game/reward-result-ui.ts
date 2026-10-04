import type { RedeemResult } from './reward-manager';

export interface RewardResultCallbacks {
  onContinue: () => void;
}

export function mountRewardResult(result: RedeemResult, callbacks: RewardResultCallbacks): void {
  const container = document.getElementById('reward-result-content');
  const continueBtn = document.getElementById('reward-result-continue');
  if (!container || !continueBtn) return;

  const isDuplicate = result.reward.duplicated;
  const icon = getRewardEmoji(result.reward.type);

  container.innerHTML = `
    <div class="reward-result-animation ${isDuplicate ? 'duplicate' : 'success'}">
      <div class="reward-sparkle">${icon}</div>
      <h2 class="reward-result-title">${isDuplicate ? '¡Recompensa Convertida!' : '¡Felicidades!'}</h2>
      <p class="reward-result-subtitle">${isDuplicate ? 'Ya poseías esta recompensa.' : 'Has desbloqueado'}</p>
      <div class="reward-result-item">
        <strong class="reward-result-name">${result.reward.label}</strong>
        <span class="reward-result-product">Producto: ${result.product.name}</span>
      </div>
      <p class="reward-result-detail">
        ${getRewardDescription(result)}
      </p>
      ${result.growth ? `<p class="foodie-growth-result">+${result.growth.amount} XP para <strong id="growth-pet-name"></strong><br />Nivel ${result.growth.before.level} → Nivel ${result.growth.after.level}</p>` : ''}
    </div>
  `;
  const petName = document.getElementById('growth-pet-name');
  if (petName && result.growth) petName.textContent = result.growth.name;

  continueBtn.onclick = () => {
    callbacks.onContinue();
  };
}

function getRewardEmoji(type: string): string {
  const map: Record<string, string> = {
    character: '👤',
    item: '⚔️',
    consumable: '🧪',
    currency: '🪙',
    crystals: '💎',
  };
  return map[type] || '🎁';
}

function getRewardDescription(result: RedeemResult): string {
  const qty = result.reward.quantity;
  const name = result.reward.name;
  const typeLabels: Record<string, string> = {
    character: 'Personaje',
    item: 'Objeto',
    consumable: 'Consumible',
    currency: 'Monedas',
    crystals: 'Cristales',
  };
  const label = typeLabels[result.reward.type] || result.reward.type;
  return `${label}: ${name}${qty > 1 ? ` ×${qty}` : ''}`;
}

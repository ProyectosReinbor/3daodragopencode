import type { PlayerProfile } from './profile';
import type { CharacterManager, Character } from './characters';
import { totalStats } from './characters';
import { rarityLabel, rarityColor, elementLabel, elementColor, statLabel, statIcon } from './nft';

export interface HubCallbacks {
  onCharacters: () => void;
  onInventory: () => void;
  onStores: () => void;
  onStartGame: () => void;
  onRedeem: () => void;
}

export function mountHub(
  profile: PlayerProfile,
  characterManager: CharacterManager,
  callbacks: HubCallbacks
): void {
  const active = characterManager.getActive();
  updateHubCharacter(active);
  updateHubNews();

  const charBtn = document.getElementById('hub-characters');
  const invBtn = document.getElementById('hub-inventory');
  const storeBtn = document.getElementById('hub-stores');
  const startBtn = document.getElementById('hub-start');
  const redeemBtn = document.getElementById('hub-redeem');

  charBtn?.addEventListener('click', callbacks.onCharacters);
  invBtn?.addEventListener('click', callbacks.onInventory);
  startBtn?.addEventListener('click', callbacks.onStartGame);

  storeBtn?.addEventListener('click', callbacks.onStores);
  redeemBtn?.addEventListener('click', callbacks.onRedeem);
}

export function updateHubCharacter(character: Character): void {
  const nameEl = document.getElementById('hub-char-name');
  const levelEl = document.getElementById('hub-char-level');
  const rarityEl = document.getElementById('hub-char-rarity');
  const elementEl = document.getElementById('hub-char-element');
  const statsEl = document.getElementById('hub-char-stats');
  const previewEl = document.getElementById('hub-char-preview');

  if (nameEl) nameEl.textContent = character.name;
  if (levelEl) levelEl.textContent = `Nivel ${character.level}`;
  if (rarityEl) {
    rarityEl.textContent = rarityLabel(character.traits.rarity);
    rarityEl.style.color = rarityColor(character.traits.rarity);
  }
  if (elementEl) {
    elementEl.textContent = elementLabel(character.traits.element);
    elementEl.style.color = elementColor(character.traits.element);
  }
  if (statsEl) {
    const stats = totalStats(character);
    statsEl.innerHTML = (['atk', 'def', 'spd', 'hp', 'ability'] as const)
      .map((s) => `<span>${statIcon(s)} ${statLabel(s)} <b>${stats[s]}</b></span>`)
      .join('');
  }
  if (previewEl) {
    const bodyLabel: Record<string, string> = {
      humanoid: 'Humanoide',
      bestia: 'Bestia',
      espectral: 'Espectral',
      golem: 'Golem',
    };
    previewEl.textContent = bodyLabel[character.traits.bodyType] ?? '';
  }
}

function updateHubNews(): void {
  const container = document.getElementById('hub-news');
  if (!container) return;
  const news = [
    { icon: '⚔', title: 'Nuevo Evento', desc: 'Tormenta de almas — próximamente.' },
    { icon: '👤', title: 'Nuevos Personajes', desc: 'Más héroes llegarán al reino.' },
    { icon: '🔮', title: 'Próxima Actualización', desc: 'Mejoras y contenido en camino.' },
  ];
  container.innerHTML = news
    .map(
      (n) => `
    <div class="news-card">
      <span class="news-icon">${n.icon}</span>
      <div>
        <strong>${n.title}</strong>
        <small>${n.desc}</small>
      </div>
    </div>`
    )
    .join('');
}

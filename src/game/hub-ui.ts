import type { PlayerProfile } from './profile';
import type { CharacterManager, Character } from './characters';
import { totalStats } from './characters';
import {
  rarityLabel,
  rarityColor,
  elementLabel,
  elementColor,
  statLabel,
  statIcon,
  xpForLevel,
} from './nft';
import { mountPetPreview } from './pet-preview';
import { navigation } from './navigation';

let hubPet: Character | undefined;
let stopPreview: (() => void) | undefined;
function showHubPet() {
  stopPreview?.();
  stopPreview = undefined;
  const container = document.getElementById('hub-pet-visual');
  if (container && hubPet && navigation.getCurrent() === 'hub')
    stopPreview = mountPetPreview(container, hubPet);
}
navigation.onNavigate(showHubPet);

export interface HubCallbacks {
  onGuardian?: () => void;
  onCharacters: () => void;
  onInventory: () => void;
  onStores: () => void;
  onStartGame: () => void;
  onRedeem: () => void;
  onHome?: () => void;
  onLogout?: () => void;
}

export function mountHub(
  _profile: PlayerProfile,
  characterManager: CharacterManager,
  callbacks: HubCallbacks
): void {
  const active = characterManager.getActive();
  updateHubCharacter(active);
  updateHubNews();

  const guardianBtn = document.getElementById('hub-guardian');
  if (guardianBtn) guardianBtn.onclick = callbacks.onGuardian || null;
  const charBtn = document.getElementById('hub-characters');
  const invBtn = document.getElementById('hub-inventory');
  const storeBtn = document.getElementById('hub-stores');
  const startBtn = document.getElementById('hub-start');
  const redeemBtn = document.getElementById('hub-redeem');
  const homeBtn = document.getElementById('hub-home');
  if (homeBtn) homeBtn.onclick = callbacks.onHome || null;
  const logoutBtn = document.getElementById('hub-logout');
  if (logoutBtn) logoutBtn.onclick = callbacks.onLogout || null;

  if (charBtn) charBtn.onclick = callbacks.onCharacters;
  if (invBtn) invBtn.hidden = true;
  if (startBtn) startBtn.onclick = callbacks.onStartGame;
  if (storeBtn) storeBtn.onclick = callbacks.onStores;
  if (redeemBtn) redeemBtn.onclick = callbacks.onRedeem;
}

export function updateHubCharacter(character: Character): void {
  hubPet = character;
  showHubPet();
  const nameEl = document.getElementById('hub-char-name');
  const levelEl = document.getElementById('hub-char-level');
  const rarityEl = document.getElementById('hub-char-rarity');
  const elementEl = document.getElementById('hub-char-element');
  const statsEl = document.getElementById('hub-char-stats');
  const previewEl = document.getElementById('hub-char-preview');

  if (nameEl) nameEl.textContent = character.name;
  if (levelEl) levelEl.textContent = `Nivel ${character.level}`;
  const xpEl = document.getElementById('hub-char-xp');
  if (xpEl)
    xpEl.textContent =
      character.level >= 100
        ? 'Nivel máximo'
        : `${character.xp} / ${xpForLevel(character.level)} XP`;
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
    {
      icon: '✦',
      title: 'Tu colección',
      desc: 'Cada compañero tiene su propio elemento y personalidad.',
    },
    {
      icon: '◈',
      title: 'Negocios de tu ciudad',
      desc: 'Descubre comercios, servicios y experiencias disponibles.',
    },
    {
      icon: '🎁',
      title: 'Tus recompensas',
      desc: 'Canjea el código de tus compras y consulta tu historial.',
    },
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

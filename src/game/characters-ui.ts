import type { CharacterManager, Character } from './characters';
import { totalStats } from './characters';
import { rarityLabel, rarityColor, elementLabel, elementColor, statIcon } from './nft';
import { apiSaveProfile } from './api';
import type { PlayerProfile } from './profile';

export interface CharactersCallbacks {
  onBack: () => void;
  onSelected: () => void;
}

export function mountCharacters(
  profile: PlayerProfile,
  characterManager: CharacterManager,
  callbacks: CharactersCallbacks
): void {
  renderCharacters(characterManager);

  document.getElementById('characters-back')?.addEventListener('click', callbacks.onBack);

  const container = document.getElementById('characters-list');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-char-id]');
    if (!btn) return;
    const charId = btn.dataset.charId;
    if (!charId) return;
    const active = characterManager.getActive();
    if (charId === active.id) return;
    characterManager.selectCharacter(charId);
    profile.selectedCharacter = charId;
    profile.characters = characterManager.getCollection();
    apiSaveProfile(profile);
    renderCharacters(characterManager);
    callbacks.onSelected();
  });
}

function renderCharacters(characterManager: CharacterManager): void {
  const container = document.getElementById('characters-list');
  if (!container) return;
  const all = characterManager.getAll();
  const active = characterManager.getActive();

  container.innerHTML = all.map((c) => renderCharacterCard(c, c.id === active.id)).join('');
}

function renderCharacterCard(character: Character, isActive: boolean): string {
  const stats = totalStats(character);
  const statRows = (['atk', 'def', 'spd', 'hp', 'ability'] as const)
    .map((s) => `<span>${statIcon(s)} ${stats[s]}</span>`)
    .join('');

  const bodyLabel: Record<string, string> = {
    humanoid: 'Humanoide',
    bestia: 'Bestia',
    espectral: 'Espectral',
    golem: 'Golem',
  };

  return `
    <div class="char-card ${isActive ? 'active' : ''}">
      <div class="char-card-header">
        <strong class="char-card-name">${character.name}</strong>
        ${isActive ? '<span class="char-active-badge">ACTIVO</span>' : ''}
      </div>
      <div class="char-card-meta">
        <span>Nv. ${character.level}</span>
        <span style="color:${rarityColor(character.traits.rarity)}">${rarityLabel(character.traits.rarity)}</span>
        <span style="color:${elementColor(character.traits.element)}">${elementLabel(character.traits.element)}</span>
        <span>${bodyLabel[character.traits.bodyType] ?? ''}</span>
      </div>
      <div class="char-card-stats">${statRows}</div>
      ${!isActive ? `<button class="char-select-btn" data-char-id="${character.id}">Seleccionar</button>` : ''}
    </div>`;
}

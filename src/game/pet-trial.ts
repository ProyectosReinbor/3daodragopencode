import type { Character } from './characters';
import { mountWorldPlay } from './world-play';
export function mountPetTrial(
  container: HTMLElement,
  pet: Character,
  onExit?: () => void
): () => void {
  container.textContent = 'Campo de prueba abierto a pantalla completa.';
  return mountWorldPlay({ pet, onExit: () => onExit?.() });
}

import type { Character } from './characters';
import { mountLazyWorld } from './lazy-world';
export function mountPetTrial(
  container: HTMLElement,
  pet: Character,
  onExit?: () => void
): () => void {
  container.textContent = 'Campo de prueba abierto a pantalla completa.';
  return mountLazyWorld({ pet, onExit: () => onExit?.() });
}

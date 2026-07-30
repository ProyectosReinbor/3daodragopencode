import type { PlayerProfile } from './profile';

export interface InventoryCallbacks {
  onBack: () => void;
}

interface InvCategory {
  id: string;
  label: string;
  empty?: boolean;
  builtin?: boolean;
}

const INVENTORY_CATEGORIES: InvCategory[] = [
  { id: 'weapons', label: 'Armas', empty: true },
  { id: 'armor', label: 'Armaduras', empty: true },
  { id: 'consumables', label: 'Consumibles', builtin: true },
  { id: 'materials', label: 'Materiales', builtin: true },
  { id: 'special', label: 'Objetos Especiales', empty: true },
  { id: 'promo', label: 'Recompensas Promocionales', empty: true },
];

export function mountInventory(profile: PlayerProfile, callbacks: InventoryCallbacks): void {
  const container = document.getElementById('inventory-categories');
  if (!container) return;

  container.innerHTML = INVENTORY_CATEGORIES.map((cat) => {
    let items = '';
    if (cat.builtin) {
      if (cat.id === 'materials') {
        const matNames: Record<string, string> = {
          trigo: 'Trigo',
          mineral: 'Mineral',
          esencia: 'Esencia',
          madera: 'Madera',
          hierba: 'Hierba',
        };
        items = Object.entries(profile.inventory)
          .filter(([, count]) => count > 0)
          .map(
            ([key, count]) =>
              `<span class="inv-item">${matNames[key] ?? key}: <b>${count}</b></span>`
          )
          .join('');
        if (!items) items = '<span class="inv-empty">Vacío</span>';
      } else if (cat.id === 'consumables') {
        const conNames: Record<string, string> = {
          racion: 'Ración',
          pocion: 'Poción',
          unguento: 'Ungüento',
          pocion_fuerza: 'P. Fuerza',
          pocion_velocidad: 'P. Velocidad',
          antidoto: 'Antídoto',
          gran_pocion: 'Gran Poción',
          elixir: 'Elixir',
          espada: 'Espada',
          escudo: 'Escudo',
          armadura: 'Armadura',
          amuleto: 'Amuleto',
        };
        items = Object.entries(profile.crafted)
          .filter(([, count]) => count > 0)
          .map(
            ([key, count]) =>
              `<span class="inv-item">${conNames[key] ?? key}: <b>${count}</b></span>`
          )
          .join('');
        if (!items) items = '<span class="inv-empty">Vacío</span>';
      }
    } else if (cat.empty) {
      items = '<span class="inv-empty">Próximamente</span>';
    }
    return `
        <div class="inv-category">
          <h3>${cat.label}</h3>
          <div class="inv-items">${items}</div>
        </div>`;
  }).join('');

  document.getElementById('inventory-back')?.addEventListener('click', callbacks.onBack);
}

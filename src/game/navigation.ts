export type AppScreen =
  | 'login'
  | 'nft'
  | 'hub'
  | 'characters'
  | 'inventory'
  | 'stores'
  | 'store-detail'
  | 'redeem'
  | 'reward-result'
  | 'game';

type Listener = (screen: AppScreen) => void;

const SCREENS: AppScreen[] = [
  'login',
  'nft',
  'hub',
  'characters',
  'inventory',
  'stores',
  'store-detail',
  'redeem',
  'reward-result',
];

class Navigation {
  private current: AppScreen = 'login';
  private listeners: Listener[] = [];
  private history: AppScreen[] = [];

  navigate(screen: AppScreen): void {
    if (this.current === screen) return;
    if (this.current !== 'game') this.history.push(this.current);
    this.current = screen;

    for (const id of SCREENS) {
      const el = document.getElementById(`${id}-screen`);
      if (el) el.classList.toggle('hidden', id !== screen);
    }

    const canvas = document.querySelector<HTMLElement>('#game-canvas');
    if (canvas) canvas.style.display = screen === 'game' ? 'block' : 'none';

    const intro = document.getElementById('intro');
    if (intro) intro.classList.toggle('hidden', screen !== 'login');

    for (const cb of this.listeners) cb(screen);
  }

  goBack(): void {
    const prev = this.history.pop();
    if (prev) this.navigateSilent(prev);
  }

  private navigateSilent(screen: AppScreen): void {
    this.current = screen;
    for (const id of SCREENS) {
      const el = document.getElementById(`${id}-screen`);
      if (el) el.classList.toggle('hidden', id !== screen);
    }
    const canvas = document.querySelector<HTMLElement>('#game-canvas');
    if (canvas) canvas.style.display = screen === 'game' ? 'block' : 'none';
    const intro = document.getElementById('intro');
    if (intro) intro.classList.toggle('hidden', screen !== 'login');
    for (const cb of this.listeners) cb(screen);
  }

  getCurrent(): AppScreen {
    return this.current;
  }

  onNavigate(cb: Listener): void {
    this.listeners.push(cb);
  }
}

export const navigation = new Navigation();

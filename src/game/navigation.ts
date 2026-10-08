export type AppScreen =
  | 'landing'
  | 'onboarding'
  | 'login'
  | 'nft'
  | 'guardian'
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
  'landing',
  'onboarding',
  'login',
  'nft',
  'hub',
  'guardian',
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
    if (this.current !== 'game' && this.current !== 'landing') this.history.push(this.current);
    this.current = screen;

    for (const id of SCREENS) {
      const el = document.getElementById(`${id}-screen`);
      if (el) el.classList.toggle('hidden', id !== screen);
      if (el) el.inert = id !== screen;
    }

    const canvas = document.querySelector<HTMLElement>('#game-canvas');
    if (canvas) canvas.style.display = screen === 'game' ? 'block' : 'none';

    const intro = document.getElementById('intro');
    if (intro) intro.classList.add('hidden');
    this.toggleGameElements(screen);

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
      if (el) el.inert = id !== screen;
    }
    const canvas = document.querySelector<HTMLElement>('#game-canvas');
    if (canvas) canvas.style.display = screen === 'game' ? 'block' : 'none';
    const intro = document.getElementById('intro');
    if (intro) intro.classList.add('hidden');
    this.toggleGameElements(screen);
    for (const cb of this.listeners) cb(screen);
  }

  getCurrent(): AppScreen {
    return this.current;
  }

  private toggleGameElements(screen: AppScreen) {
    for (const element of document.querySelectorAll<HTMLElement>('#app > *')) {
      if (element.id.endsWith('-screen') || element.id === 'game-canvas') continue;
      element.classList.toggle('foodie-game-hidden', screen !== 'game');
      element.inert = screen !== 'game';
    }
  }

  onNavigate(cb: Listener): void {
    this.listeners.push(cb);
  }
}

export const navigation = new Navigation();

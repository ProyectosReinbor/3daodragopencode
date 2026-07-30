import { describe, it, expect, beforeEach } from 'vitest';
import { navigation, type AppScreen } from './navigation';

describe('Navigation', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="login-screen" class=""></section>
      <section id="nft-screen" class="hidden"></section>
      <section id="hub-screen" class="hidden"></section>
      <section id="characters-screen" class="hidden"></section>
      <section id="inventory-screen" class="hidden"></section>
      <section id="stores-screen" class="hidden"></section>
      <section id="store-detail-screen" class="hidden"></section>
      <section id="intro" class=""></section>
      <canvas id="game-canvas" style="display:none"></canvas>
    `;
  });

  it('starts on login', () => {
    navigation.navigate('login');
    expect(navigation.getCurrent()).toBe('login');
  });

  it('navigates to hub', () => {
    navigation.navigate('login');
    navigation.navigate('hub');
    expect(navigation.getCurrent()).toBe('hub');
    expect(document.getElementById('hub-screen')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('login-screen')?.classList.contains('hidden')).toBe(true);
  });

  it('navigates to characters', () => {
    navigation.navigate('login');
    navigation.navigate('characters');
    expect(navigation.getCurrent()).toBe('characters');
    expect(document.getElementById('characters-screen')?.classList.contains('hidden')).toBe(false);
  });

  it('navigates to inventory', () => {
    navigation.navigate('login');
    navigation.navigate('inventory');
    expect(navigation.getCurrent()).toBe('inventory');
    expect(document.getElementById('inventory-screen')?.classList.contains('hidden')).toBe(false);
  });

  it('navigates to stores', () => {
    navigation.navigate('login');
    navigation.navigate('stores');
    expect(navigation.getCurrent()).toBe('stores');
    expect(document.getElementById('stores-screen')?.classList.contains('hidden')).toBe(false);
  });

  it('navigates to store-detail', () => {
    navigation.navigate('login');
    navigation.navigate('store-detail');
    expect(navigation.getCurrent()).toBe('store-detail');
    expect(document.getElementById('store-detail-screen')?.classList.contains('hidden')).toBe(
      false
    );
  });

  it('shows game canvas when navigating to game', () => {
    navigation.navigate('login');
    navigation.navigate('game');
    expect(navigation.getCurrent()).toBe('game');
    const canvas = document.getElementById('game-canvas');
    expect(canvas?.style.display).toBe('block');
  });

  it('shows only one screen at a time', () => {
    navigation.navigate('login');
    navigation.navigate('hub');
    navigation.navigate('characters');
    navigation.navigate('inventory');
    expect(document.getElementById('hub-screen')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('characters-screen')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('inventory-screen')?.classList.contains('hidden')).toBe(false);
  });

  it('ignores navigation to current screen', () => {
    navigation.navigate('login');
    navigation.navigate('hub');
    const log: AppScreen[] = [];
    navigation.onNavigate((s) => log.push(s));
    navigation.navigate('hub');
    expect(log).toEqual([]);
  });

  it('fires onNavigate callbacks', () => {
    navigation.navigate('login');
    const log: AppScreen[] = [];
    navigation.onNavigate((s) => log.push(s));
    navigation.navigate('hub');
    navigation.navigate('game');
    expect(log).toEqual(['hub', 'game']);
  });

  it('toggles intro visibility with login', () => {
    navigation.navigate('login');
    navigation.navigate('hub');
    const intro = document.getElementById('intro');
    expect(intro?.classList.contains('hidden')).toBe(true);
    navigation.navigate('login');
    expect(intro?.classList.contains('hidden')).toBe(false);
  });
});

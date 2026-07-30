import './styles.css';
import { Game } from './game/game';
import { createProfile, migrateProfile, type PlayerProfile } from './game/profile';
import {
  buildNftModel,
  rarityLabel,
  rarityColor,
  elementLabel,
  elementColor,
  statLabel,
  statIcon,
} from './game/nft';
import { generateCharacterFromPhone, totalStats } from './game/characters';
import type { Character } from './game/characters';
import { CharacterManager } from './game/characters';
import {
  apiRegister,
  apiLogin,
  apiGetProfile,
  apiSaveProfile,
  isLoggedIn,
  getPhone,
} from './game/api';
import { navigation } from './game/navigation';
import type { AppScreen } from './game/navigation';
import { mountHub, updateHubCharacter } from './game/hub-ui';
import type { HubCallbacks } from './game/hub-ui';
import { mountCharacters } from './game/characters-ui';
import type { CharactersCallbacks } from './game/characters-ui';
import { mountInventory } from './game/inventory-ui';
import type { InventoryCallbacks } from './game/inventory-ui';
import { mountStoresList, mountStoreDetail } from './game/stores-ui';
import type { StoresCallbacks } from './game/stores-ui';
import { mountRedeem } from './game/redeem-ui';
import type { RedeemCallbacks } from './game/redeem-ui';
import { mountRewardResult } from './game/reward-result-ui';
import type { RewardResultCallbacks } from './game/reward-result-ui';
import type { RedeemResult } from './game/reward-manager';
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  HemisphereLight,
  DirectionalLight,
  Color,
} from 'three';

const nftPreview = document.querySelector<HTMLElement>('#nft-preview')!;
const nftGenerateBtn = document.querySelector<HTMLButtonElement>('#nft-generate')!;
const nftEnterBtn = document.querySelector<HTMLButtonElement>('#nft-enter')!;
const nftNameEl = document.querySelector<HTMLElement>('#nft-name')!;
const nftIdEl = document.querySelector<HTMLElement>('#nft-id')!;
const nftRarityEl = document.querySelector<HTMLElement>('#nft-rarity')!;
const nftElementEl = document.querySelector<HTMLElement>('#nft-element')!;
const nftStatsEl = document.querySelector<HTMLElement>('#nft-stats')!;
const nftBodyEl = document.querySelector<HTMLElement>('#nft-body-type')!;
const loginPhone = document.querySelector<HTMLInputElement>('#login-phone')!;
const loginPw = document.querySelector<HTMLInputElement>('#login-password')!;
const loginSubmit = document.querySelector<HTMLButtonElement>('#login-submit')!;
const loginRegister = document.querySelector<HTMLButtonElement>('#login-register')!;
const loginError = document.querySelector<HTMLElement>('#login-error')!;

let deferredPrompt: BeforeInstallPromptEvent | undefined;
let currentCharacter: Character | null = null;
let currentProfile: PlayerProfile | null = null;
let currentManager: CharacterManager | null = null;
let previewRenderer: WebGLRenderer | null = null;
let previewScene: Scene | null = null;
let previewCamera: PerspectiveCamera | null = null;
let previewModel: ReturnType<typeof buildNftModel> | null = null;
let previewFrame = 0;
let _selectedStoreId = '';
let _lastRedeemResult: RedeemResult | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  document.querySelector<HTMLButtonElement>('#install-button')!.hidden = false;
});
document.querySelector('#install-button')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  deferredPrompt = undefined;
  document.querySelector<HTMLButtonElement>('#install-button')!.hidden = true;
});
document
  .querySelector<HTMLButtonElement>('#clear-cache-button')
  ?.addEventListener('click', async () => {
    const button = document.querySelector<HTMLButtonElement>('#clear-cache-button')!;
    button.disabled = true;
    if ('caches' in window)
      await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
    button.textContent = 'Cache eliminada';
    window.setTimeout(() => {
      button.textContent = 'Limpiar cache';
      button.disabled = false;
    }, 1800);
  });

function showLoginError(msg: string) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
}
function hideLoginError() {
  loginError.classList.add('hidden');
}

async function handleAuthAction(action: 'login' | 'register') {
  hideLoginError();
  const ph = loginPhone.value.trim();
  const pw = loginPw.value;
  if (!ph || ph.length < 6) {
    showLoginError('Ingresa un numero de telefono valido.');
    return;
  }
  if (!pw || pw.length < 4) {
    showLoginError('La contrasena debe tener al menos 4 caracteres.');
    return;
  }
  loginSubmit.disabled = true;
  loginRegister.disabled = true;
  try {
    if (action === 'register') await apiRegister(ph, pw);
    else await apiLogin(ph, pw);
    await onAuthSuccess();
  } catch (e: unknown) {
    showLoginError(e instanceof Error ? e.message : 'Error de conexion');
  } finally {
    loginSubmit.disabled = false;
    loginRegister.disabled = false;
  }
}

loginSubmit.addEventListener('click', () => handleAuthAction('login'));
loginRegister.addEventListener('click', () => handleAuthAction('register'));
loginPw.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleAuthAction('login');
});
loginPhone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginPw.focus();
});

async function onAuthSuccess() {
  const phoneStr = getPhone()!;
  const serverProfile = await apiGetProfile();
  if (serverProfile) {
    migrateProfile(serverProfile);
    if (serverProfile.characters && serverProfile.characters.characters.length > 0) {
      goToHub(serverProfile);
      return;
    }
  }
  showNftCreation(phoneStr);
}

function goToHub(profile: PlayerProfile) {
  currentProfile = profile;
  currentManager = new CharacterManager(profile.characters!);

  const hubCbs: HubCallbacks = {
    onCharacters: () => navigation.navigate('characters'),
    onInventory: () => navigation.navigate('inventory'),
    onStores: () => navigation.navigate('stores'),
    onStartGame: () => startGameWithProfile(profile),
    onRedeem: () => navigation.navigate('redeem'),
  };
  mountHub(profile, currentManager, hubCbs);
  navigation.navigate('hub');
}

function startGameWithProfile(profile: PlayerProfile) {
  navigation.navigate('game');
  if (profile.characters && profile.characters.characters.length > 0) {
    const active =
      profile.characters.characters.find((c) => c.id === profile.selectedCharacter) ||
      profile.characters.characters[0];
    if (active) {
      currentCharacter = active;
      new Game(document.querySelector('#game-canvas')!, profile).start();
    }
  }
}

function showNftCreation(phoneStr: string) {
  navigation.navigate('nft');
  currentCharacter = generateCharacterFromPhone(phoneStr);
  showNftInfo(currentCharacter);
  initPreview();
  nftEnterBtn.hidden = false;
}

nftGenerateBtn.addEventListener('click', () => {
  if (!getPhone()) return;
  currentCharacter = generateCharacterFromPhone(getPhone()!);
  showNftInfo(currentCharacter);
  initPreview();
  nftEnterBtn.hidden = false;
});

nftEnterBtn.addEventListener(
  'click',
  () => {
    if (!currentCharacter) return;
    const profile = createProfile(currentCharacter);
    apiSaveProfile(profile);
    goToHub(profile);
  },
  { once: true }
);

document.querySelector('#nft-back')?.addEventListener('click', () => {
  navigation.navigate('login');
});

navigation.onNavigate((screen: AppScreen) => {
  if (screen === 'characters' && currentProfile && currentManager) {
    const charCbs: CharactersCallbacks = {
      onBack: () => {
        if (currentManager) updateHubCharacter(currentManager.getActive());
        navigation.navigate('hub');
      },
      onSelected: () => {
        if (currentManager) updateHubCharacter(currentManager.getActive());
      },
    };
    mountCharacters(currentProfile, currentManager, charCbs);
  } else if (screen === 'inventory' && currentProfile) {
    const invCbs: InventoryCallbacks = {
      onBack: () => navigation.navigate('hub'),
    };
    mountInventory(currentProfile, invCbs);
  } else if (screen === 'stores') {
    const storeCbs: StoresCallbacks = {
      onBack: () => navigation.navigate('hub'),
      onStoreSelected: (storeId: string) => {
        _selectedStoreId = storeId;
        navigation.navigate('store-detail');
      },
      onRedeem: () => navigation.navigate('redeem'),
    };
    mountStoresList(storeCbs);
  } else if (screen === 'store-detail') {
    if (_selectedStoreId) mountStoreDetail(_selectedStoreId);
  } else if (screen === 'redeem') {
    const redeemCbs: RedeemCallbacks = {
      onBack: () => navigation.goBack(),
      onSuccess: (result: RedeemResult) => {
        _lastRedeemResult = result;
        navigation.navigate('reward-result');
      },
    };
    mountRedeem(redeemCbs);
  } else if (screen === 'reward-result') {
    if (_lastRedeemResult) {
      const resultCbs: RewardResultCallbacks = {
        onContinue: () => {
          _lastRedeemResult = null;
          navigation.navigate('hub');
        },
      };
      mountRewardResult(_lastRedeemResult, resultCbs);
    }
  }
});

function showNftInfo(character: Character) {
  nftNameEl.textContent = character.name;
  nftIdEl.textContent = character.id;
  nftRarityEl.textContent = rarityLabel(character.traits.rarity);
  nftRarityEl.style.color = rarityColor(character.traits.rarity);
  nftElementEl.textContent = elementLabel(character.traits.element);
  nftElementEl.style.color = elementColor(character.traits.element);
  nftBodyEl.textContent = {
    humanoid: 'Humanoide',
    bestia: 'Bestia',
    espectral: 'Espectral',
    golem: 'Golem',
  }[character.traits.bodyType];
  const stats = totalStats(character);
  nftStatsEl.innerHTML = (['atk', 'def', 'spd', 'hp', 'ability'] as const)
    .map((s) => `<span>${statIcon(s)} ${statLabel(s)} <b>${stats[s]}</b></span>`)
    .join('');
}

function initPreview() {
  if (!nftPreview) return;
  if (!currentCharacter) return;
  const w = nftPreview.clientWidth || 280;
  const h = nftPreview.clientHeight || 300;
  if (!previewRenderer) {
    previewRenderer = new WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'low-power',
    });
    previewRenderer.setPixelRatio(Math.min(devicePixelRatio, 1));
    previewRenderer.outputColorSpace = 'srgb';
    nftPreview.appendChild(previewRenderer.domElement);
    previewScene = new Scene();
    previewScene.background = new Color(0x1a2a20);
    previewCamera = new PerspectiveCamera(40, w / h, 0.1, 30);
    previewCamera.position.set(0, 1.5, 3.5);
    previewScene.add(new HemisphereLight(0xd8edff, 0x273b28, 2.2));
    const sun = new DirectionalLight(0xfff0c9, 1.6);
    sun.position.set(5, 8, 4);
    previewScene.add(sun);
  }
  previewRenderer.setSize(w, h, false);
  if (previewModel && previewScene) previewScene.remove(previewModel);
  previewModel = buildNftModel(currentCharacter as any);
  if (previewScene) previewScene.add(previewModel);
  if (previewFrame) cancelAnimationFrame(previewFrame);
  function animate() {
    previewFrame = requestAnimationFrame(animate);
    if (previewModel) previewModel.rotation.y += 0.012;
    if (previewRenderer && previewScene && previewCamera)
      previewRenderer.render(previewScene, previewCamera);
  }
  animate();
}

if ('serviceWorker' in navigator)
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));

if (isLoggedIn()) {
  onAuthSuccess();
} else if (getPhone()) {
  loginPhone.value = getPhone()!;
}

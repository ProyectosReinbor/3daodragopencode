import './styles.css';
import { Game } from './game/game';
import { createProfile, type PlayerProfile } from './game/profile';
import {
  generateNftFromPhone,
  buildNftModel,
  rarityLabel,
  rarityColor,
  elementLabel,
  elementColor,
  statLabel,
  statIcon,
  totalStats,
  type NftCharacter,
} from './game/nft';
import {
  apiRegister,
  apiLogin,
  apiGetProfile,
  apiSaveProfile,
  isLoggedIn,
  getPhone,
} from './game/api';
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  HemisphereLight,
  DirectionalLight,
  Color,
} from 'three';

const loginScreen = document.querySelector<HTMLElement>('#login-screen')!;
const intro = document.querySelector<HTMLElement>('#intro')!;
const nftScreen = document.querySelector<HTMLElement>('#nft-screen')!;
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
let currentNft: NftCharacter | null = null;
let previewRenderer: WebGLRenderer | null = null;
let previewScene: Scene | null = null;
let previewCamera: PerspectiveCamera | null = null;
let previewModel: ReturnType<typeof buildNftModel> | null = null;
let previewFrame = 0;

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
  if (serverProfile?.nft) {
    startGameWithProfile(serverProfile);
  } else {
    showNftCreation(phoneStr);
  }
}

function showNftCreation(phoneStr: string) {
  loginScreen.classList.add('hidden');
  nftScreen.classList.remove('hidden');
  currentNft = generateNftFromPhone(phoneStr);
  showNftInfo(currentNft);
  initPreview();
  nftEnterBtn.hidden = false;
}

function startGameWithProfile(profile: PlayerProfile) {
  loginScreen.classList.add('hidden');
  intro.classList.add('hidden');
  nftScreen.classList.add('hidden');
  if (profile.nft) {
    currentNft = profile.nft;
    new Game(document.querySelector('#game-canvas')!, profile).start();
  }
}

nftGenerateBtn.addEventListener('click', () => {
  if (!getPhone()) return;
  currentNft = generateNftFromPhone(getPhone()!);
  showNftInfo(currentNft);
  initPreview();
  nftEnterBtn.hidden = false;
});

nftEnterBtn.addEventListener(
  'click',
  () => {
    if (!currentNft) return;
    const profile = createProfile(currentNft);
    apiSaveProfile(profile);
    startGameWithProfile(profile);
  },
  { once: true }
);

document.querySelector('#nft-back')?.addEventListener('click', () => {
  nftScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
});

function showNftInfo(nft: NftCharacter) {
  nftNameEl.textContent = nft.name;
  nftIdEl.textContent = nft.id;
  nftRarityEl.textContent = rarityLabel(nft.traits.rarity);
  nftRarityEl.style.color = rarityColor(nft.traits.rarity);
  nftElementEl.textContent = elementLabel(nft.traits.element);
  nftElementEl.style.color = elementColor(nft.traits.element);
  nftBodyEl.textContent = {
    humanoid: 'Humanoide',
    bestia: 'Bestia',
    espectral: 'Espectral',
    golem: 'Golem',
  }[nft.traits.bodyType];
  const stats = totalStats(nft);
  nftStatsEl.innerHTML = (['atk', 'def', 'spd', 'hp', 'ability'] as const)
    .map((s) => `<span>${statIcon(s)} ${statLabel(s)} <b>${stats[s]}</b></span>`)
    .join('');
}

function initPreview() {
  if (!nftPreview) return;
  if (!currentNft) return;
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
  previewModel = buildNftModel(currentNft);
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

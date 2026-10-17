import './styles.css';
import './foodie.css';
import './aodase.css';
import { mountGuardian } from './game/guardian-ui';
let stopGuardian: (() => void) | undefined;
import { mountLazyWorld } from './game/lazy-world';
let stopWorld: (() => void) | undefined;
import { migrateProfile, type PlayerProfile } from './game/profile';
import { initFoodieLanding } from './game/landing-ui';
import { mountOnboarding, hasPendingPet } from './game/onboarding-ui';
import { CharacterManager } from './game/characters';
import { apiRegister, apiLogin, apiGetProfile, isLoggedIn, getPhone, clearAuth } from './game/api';
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
import './game-theme.css';
const loginPhone = document.querySelector<HTMLInputElement>('#login-phone')!;
const loginPw = document.querySelector<HTMLInputElement>('#login-password')!;
const loginSubmit = document.querySelector<HTMLButtonElement>('#login-submit')!;
const loginRegister = document.querySelector<HTMLButtonElement>('#login-register')!;
const loginError = document.querySelector<HTMLElement>('#login-error')!;

let deferredPrompt: BeforeInstallPromptEvent | undefined;
let currentProfile: PlayerProfile | null = null;
let currentManager: CharacterManager | null = null;
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
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    button.textContent = 'Cache eliminada — recargando';
    window.location.reload();
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
document.getElementById('login-back')!.onclick = () =>
  navigation.navigate(hasPendingPet() ? 'onboarding' : 'landing');
loginRegister.addEventListener('click', () => handleAuthAction('register'));
loginPw.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleAuthAction('login');
});
loginPhone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginPw.focus();
});

async function onAuthSuccess() {
  const serverProfile = await apiGetProfile();
  if (serverProfile) {
    migrateProfile(serverProfile);
    if (serverProfile.characters && serverProfile.characters.characters.length > 0) {
      goToHub(serverProfile);
      return;
    }
  }
  // New Guardians start with an egg; a workshop preview is never their starter pet.
  if (!serverProfile) throw new Error('No se pudo cargar tu perfil. Vuelve a iniciar sesión.');
  currentProfile = serverProfile;
  currentManager = null;
  navigation.navigate('guardian');
}

function goToHub(profile: PlayerProfile) {
  currentProfile = profile;
  if (!profile.characters?.characters.length) {
    currentManager = null;
    if (navigation.getCurrent() !== 'guardian') navigation.navigate('guardian');
    return;
  }
  currentManager = new CharacterManager(profile.characters!);

  const hubCbs: HubCallbacks = {
    onGuardian: () => navigation.navigate('guardian'),
    onCharacters: () => navigation.navigate('characters'),
    onInventory: () => navigation.navigate('inventory'),
    onStores: () => navigation.navigate('stores'),
    onStartGame: () => startGameWithProfile(profile),
    onRedeem: () => navigation.navigate('redeem'),
    onHome: () => navigation.navigate('landing'),
    onLogout: () => {
      clearAuth();
      currentProfile = null;
      currentManager = null;
      navigation.navigate('landing');
    },
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
      stopWorld?.();
      stopWorld = mountLazyWorld({
        pet: active,
        profile,
        onExit: (updated) => {
          stopWorld = undefined;
          goToHub(updated || profile);
        },
      });
    }
  }
}

navigation.onNavigate((screen: AppScreen) => {
  if (screen !== 'guardian') {
    stopGuardian?.();
    stopGuardian = undefined;
  }
  if (screen === 'guardian' && currentProfile) {
    stopGuardian?.();
    stopGuardian = mountGuardian(document.getElementById('guardian-screen')!, currentProfile, {
      onBack: (updated) => {
        currentProfile = updated;
        if (updated.characters?.characters.length) goToHub(updated);
        else navigation.navigate('landing');
      },
      onExplore: (updated) => {
        currentProfile = updated;
        currentManager = updated.characters?.characters.length
          ? new CharacterManager(updated.characters)
          : null;
        startGameWithProfile(updated);
      },
      onProfile: (updated) => {
        currentProfile = updated;
        currentManager = updated.characters?.characters.length
          ? new CharacterManager(updated.characters)
          : null;
      },
    });
  }
  if (screen !== 'game') {
    stopWorld?.();
    stopWorld = undefined;
  }
  if (screen === 'login')
    document.getElementById('login-back')!.textContent = hasPendingPet()
      ? '← Volver a mi personaje'
      : '← Volver a AODASE PETS';
  if (screen === 'onboarding') mountOnboarding(goToHub);
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
    mountRedeem(redeemCbs, currentProfile || undefined);
  } else if (screen === 'reward-result') {
    if (_lastRedeemResult) {
      const resultCbs: RewardResultCallbacks = {
        onContinue: () => {
          void apiGetProfile()
            .then((profile) => {
              if (!profile) throw new Error('No se pudo actualizar tu colección.');
              migrateProfile(profile);
              _lastRedeemResult = null;
              goToHub(profile);
            })
            .catch((error: Error) => {
              const message = document.getElementById('reward-result-message');
              if (message) message.textContent = error.message;
            });
        },
      };
      mountRewardResult(_lastRedeemResult, resultCbs);
    }
  }
});

if ('serviceWorker' in navigator)
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));

initFoodieLanding(() => {
  if (isLoggedIn() && currentProfile) goToHub(currentProfile);
  else navigation.navigate('login');
});

if (isLoggedIn()) {
  void onAuthSuccess().catch((error: Error) => {
    navigation.navigate('login');
    showLoginError(error.message);
  });
} else {
  if (getPhone()) loginPhone.value = getPhone()!;
  navigation.navigate('landing');
}

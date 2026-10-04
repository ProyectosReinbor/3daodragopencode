import { redeemCode, getRewardHistory } from './reward-manager';
import type { RedeemResult, RewardHistoryEntry } from './reward-manager';
import type { PlayerProfile } from './profile';
import { QrScanner } from './qr-scanner';
import { navigation } from './navigation';

let activeScanner: QrScanner | null = null;
navigation.onNavigate((screen) => {
  if (screen !== 'redeem') activeScanner?.stop();
});

export interface RedeemCallbacks {
  onBack: () => void;
  onSuccess: (result: RedeemResult) => void;
}

export function mountRedeem(callbacks: RedeemCallbacks, profile?: PlayerProfile): void {
  const input = document.getElementById('redeem-code-input') as HTMLInputElement;
  const button = document.getElementById('redeem-submit') as HTMLButtonElement;
  const message = document.getElementById('redeem-message');
  const historyContainer = document.getElementById('redeem-history');
  const backBtn = document.getElementById('redeem-back');

  if (!input || !button || !message || !historyContainer) return;

  input.value = '';
  message.classList.add('hidden');
  message.textContent = '';
  button.disabled = false;
  button.textContent = 'Canjear';

  if (backBtn) backBtn.onclick = callbacks.onBack;

  const select = document.getElementById('redeem-pet') as HTMLSelectElement | null;
  if (select && profile?.characters) {
    select.replaceChildren(
      ...profile.characters.characters.map((pet) => new Option(pet.name, pet.id))
    );
    select.value = profile.characters.selectedId;
  }
  activeScanner?.stop();
  const video = document.getElementById('redeem-camera') as HTMLVideoElement | null;
  const scanStatus = document.getElementById('redeem-scan-status');
  const scanButton = document.getElementById('redeem-scan');
  const stopButton = document.getElementById('redeem-scan-stop');
  if (video && scanStatus && scanButton && stopButton) {
    video.hidden = true;
    scanStatus.textContent = '';
    activeScanner = new QrScanner(video, scanStatus, (code) => {
      input.value = code.trim();
      video.hidden = true;
      scanStatus.textContent = 'Código detectado. Revisa el Pet elegido y confirma el canje.';
    });
    scanButton.onclick = () => {
      video.hidden = false;
      void activeScanner?.start();
    };
    stopButton.onclick = () => {
      activeScanner?.stop();
      video.hidden = true;
    };
  }

  loadHistory(historyContainer);

  button.onclick = async () => {
    const code = input.value.trim();
    if (!code) {
      showMessage(message, 'Ingresa un código de factura.', 'error');
      return;
    }
    if (code.length < 5) {
      showMessage(message, 'El código debe tener al menos 5 caracteres.', 'error');
      return;
    }

    button.disabled = true;
    button.textContent = 'Canjeando...';

    try {
      const result = await redeemCode(code, select?.value);
      activeScanner?.stop();
      button.textContent = 'Canjeado';
      showMessage(message, '¡Código canjeado exitosamente!', 'success');
      loadHistory(historyContainer);
      callbacks.onSuccess(result);
    } catch (e) {
      button.disabled = false;
      button.textContent = 'Canjear';
      showMessage(message, e instanceof Error ? e.message : 'Error al canjear el código.', 'error');
    }
  };

  input.onkeydown = (e) => {
    if (e.key === 'Enter') button.click();
  };
}

function showMessage(el: HTMLElement, text: string, type: 'success' | 'error') {
  el.textContent = text;
  el.className = `redeem-message ${type}`;
  el.classList.remove('hidden');
}

async function loadHistory(container: HTMLElement) {
  try {
    const history = await getRewardHistory();
    if (history.length === 0) {
      container.innerHTML =
        '<p class="redeem-history-empty">Aún no has canjeado ningún código.</p>';
      return;
    }
    container.innerHTML = history.map((entry) => renderHistoryEntry(entry)).join('');
  } catch {
    container.innerHTML = '<p class="redeem-history-empty">Error al cargar historial.</p>';
  }
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderHistoryEntry(entry: RewardHistoryEntry): string {
  const rewardIcon = getRewardIcon(entry.reward_type);
  return `
    <div class="redeem-history-item">
      <span class="reward-icon">${rewardIcon}</span>
      <div class="history-details">
        <strong>${entry.reward_name}</strong>
        <span class="history-code">${entry.invoice_code}</span>
        <span class="history-date">${formatDate(entry.created_at)}</span>
      </div>
    </div>
  `;
}

function getRewardIcon(type: string): string {
  const icons: Record<string, string> = {
    character: '👤',
    item: '⚔️',
    consumable: '🧪',
    currency: '🪙',
    crystals: '💎',
  };
  return icons[type] || '🎁';
}

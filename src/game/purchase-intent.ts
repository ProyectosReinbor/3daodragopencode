export interface PurchaseIntent {
  requestId: string;
  item: 'potions' | 'mana';
  quantity: number;
}
export function pendingPurchase(owner: string): PurchaseIntent | null {
  const value = localStorage.getItem('aodase-pending-purchase:' + owner);
  if (!value) return null;
  const parsed = JSON.parse(value) as PurchaseIntent;
  if (
    !parsed ||
    typeof parsed.requestId !== 'string' ||
    !/^[a-zA-Z0-9-]{8,80}$/.test(parsed.requestId) ||
    !['potions', 'mana'].includes(parsed.item) ||
    ![1, 3, 5].includes(parsed.quantity)
  )
    throw new Error('No se pudo recuperar la compra pendiente.');
  return parsed;
}
export function rememberPurchase(owner: string, intent: PurchaseIntent): void {
  localStorage.setItem('aodase-pending-purchase:' + owner, JSON.stringify(intent));
}
export function confirmPurchase(owner: string, requestId: string): void {
  if (pendingPurchase(owner)?.requestId !== requestId) return;
  localStorage.removeItem('aodase-pending-purchase:' + owner);
}

import { buyConsumables } from '../shared/world-shop.js';

// The receipt and debit are saved together in the server-owned world profile.
export function purchaseOnce(world, { requestId, item, quantity = 1 }) {
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(requestId)) {
    throw Object.assign(new Error('Identificador de compra inválido. Actualiza el juego e intenta de nuevo.'), { status: 400 });
  }
  const receipts = world.purchaseReceipts || {};
  if (Object.hasOwn(receipts, requestId)) {
    const previous = receipts[requestId];
    if (previous.item !== item || previous.quantity !== quantity)
      throw Object.assign(new Error('Esta solicitud ya corresponde a otra compra.'), { status: 409 });
    return { replayed: true };
  }
  buyConsumables(world, item, quantity);
  world.purchaseReceipts ||= {};
  world.purchaseReceipts[requestId] = { item, quantity };
  return { replayed: false };
}

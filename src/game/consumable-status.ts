export function consumableStatus(input: {
  stock: number;
  current: number;
  maximum: number;
  readyAt: number;
  now: number;
  blocked: boolean;
}) {
  const seconds = Math.max(0, Math.ceil((input.readyAt - input.now) / 1000));
  if (input.blocked) return { disabled: true, label: 'No disponible', state: 'blocked' };
  if (input.stock < 1) return { disabled: true, label: 'Sin unidades', state: 'empty' };
  if (seconds) return { disabled: true, label: `Espera ${seconds} s`, state: 'cooldown' };
  if (input.current >= input.maximum) return { disabled: true, label: 'Al máximo', state: 'full' };
  return { disabled: false, label: 'Usar', state: 'ready' };
}

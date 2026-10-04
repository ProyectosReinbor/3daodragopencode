import type { Promotion } from './stores';

export function isPromotionActive(promo: Promotion): boolean {
  const now = Date.now();
  const start = new Date(promo.start_date).getTime();
  const end = new Date(promo.end_date).getTime();
  return promo.active && now >= start && now <= end;
}

export function isPromotionUpcoming(promo: Promotion): boolean {
  const now = Date.now();
  const start = new Date(promo.start_date).getTime();
  return promo.active && now < start;
}

export function isPromotionExpired(promo: Promotion): boolean {
  const now = Date.now();
  const end = new Date(promo.end_date).getTime();
  return now > end;
}

export function getPromotionStatus(
  promo: Promotion
): 'active' | 'upcoming' | 'expired' | 'inactive' {
  if (!promo.active) return 'inactive';
  if (isPromotionActive(promo)) return 'active';
  if (isPromotionUpcoming(promo)) return 'upcoming';
  return 'expired';
}

export function formatPromotionDates(promo: Promotion): string {
  const format = (value: string) => {
    // A date without a time is a calendar day, not a UTC instant.
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00`)
      : new Date(value);
    return date.toLocaleDateString(
      'es-ES',
      /^\d{4}-\d{2}-\d{2}$/.test(value) ? undefined : { timeZone: 'UTC' }
    );
  };
  const start = format(promo.start_date);
  const end = format(promo.end_date);
  return `${start} → ${end}`;
}

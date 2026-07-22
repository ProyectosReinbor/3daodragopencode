export type QualityLevel = 'low' | 'medium' | 'high';
const STORAGE_KEY = 'reinos-ancestrales-quality-v1';

type NavigatorWithHardware = Navigator & { deviceMemory?: number };

export function getQuality(): QualityLevel {
  const stored = localStorage.getItem(STORAGE_KEY) as QualityLevel | null;
  if (stored === 'low' || stored === 'medium' || stored === 'high') return stored;
  const navigatorInfo = navigator as NavigatorWithHardware;
  if ((navigatorInfo.deviceMemory && navigatorInfo.deviceMemory <= 3) || navigator.hardwareConcurrency <= 4) return 'low';
  if (devicePixelRatio > 2 || navigator.hardwareConcurrency <= 6) return 'medium';
  return 'high';
}

export function saveQuality(level: QualityLevel) { localStorage.setItem(STORAGE_KEY, level); }

export function pixelRatioFor(level: QualityLevel) {
  const caps: Record<QualityLevel, number> = { low: 0.8, medium: 1, high: 1.35 };
  return Math.min(devicePixelRatio, caps[level]);
}

export function frameIntervalFor(level: QualityLevel) {
  const frameRates: Record<QualityLevel, number> = { low: 30, medium: 45, high: 60 };
  return 1000 / frameRates[level];
}

export interface Settings { volume: number; sensitivity: number }
export const SETTINGS_KEY = 'dao-den-long.settings.v1';
export const DEFAULT_SETTINGS: Settings = { volume: 0.45, sensitivity: 0.004 };
export function parseSettings(raw: string | null): Settings {
  try {
    const value = JSON.parse(raw ?? '{}');
    const clamp = (n: unknown, min: number, max: number, fallback: number) =>
      typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    return { volume: clamp(value?.volume, 0, 1, DEFAULT_SETTINGS.volume),
      sensitivity: clamp(value?.sensitivity, 0.001, 0.012, DEFAULT_SETTINGS.sensitivity) };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export function loadSettings(): Settings {
  try { return parseSettings(localStorage.getItem(SETTINGS_KEY)); }
  catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(settings: Settings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Private browsing can deny storage. */ }
}

import { DEFAULT_BINDINGS, parseBindings, type Bindings } from './bindings';
export interface Settings { volume: number; sensitivity: number; accessiblePalette: boolean; reducedMotion:boolean;largeText:boolean;bindings:Bindings }
export const SETTINGS_KEY = 'dao-den-long.settings.v1';
export const DEFAULT_SETTINGS: Settings = { volume: 0.45, sensitivity: 0.004, accessiblePalette: false,reducedMotion:false,largeText:false,bindings:{...DEFAULT_BINDINGS} };
export function parseSettings(raw: string | null): Settings {
  try {
    const value = JSON.parse(raw ?? '{}');
    const clamp = (n: unknown, min: number, max: number, fallback: number) =>
      typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    return { volume: clamp(value?.volume, 0, 1, DEFAULT_SETTINGS.volume),
      sensitivity: clamp(value?.sensitivity, 0.001, 0.012, DEFAULT_SETTINGS.sensitivity),
      accessiblePalette: value?.accessiblePalette === true,reducedMotion:value?.reducedMotion===true,largeText:value?.largeText===true,bindings:parseBindings(value?.bindings) };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export function loadSettings(): Settings {
  try { return parseSettings(localStorage.getItem(SETTINGS_KEY)); }
  catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(settings: Settings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Private browsing can deny storage. */ }
}

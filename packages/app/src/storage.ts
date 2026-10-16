/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * localStorage keys and the two small helpers the app uses for its own state. The stored shapes are a contract
 * with people's browsers: do not rename a key or a stored value without a migration.
 */
import type { Store } from './store';

export const SAVE_KEY = 'hodoku-revisited:game';
export const SETTINGS_KEY = 'hodoku-revisited:settings';
export const TIME_KEY = 'hodoku-revisited:time';

/** localStorage in the shape the store helpers want; they swallow the failures (private mode, quota). */
export const localStorageStore: Store = {
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
};

export function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or full: the game just isn't remembered */
  }
}

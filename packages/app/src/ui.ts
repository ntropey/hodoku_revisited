import type { HintLevel } from './protocol';

export type Mode = 'value' | 'notes' | 'filter';
export type Theme = 'system' | 'light' | 'dark';
export type Tab = 'hint' | 'steps' | 'summary';

export interface Settings {
  showCands: boolean;
  checkMistakes: boolean;
  /** level of "New puzzle" */
  level: number;
  hintLevel: HintLevel;
  theme: Theme;
  /** bank indices already played, per level */
  seen?: Record<number, number[]>;
}

export const DEFAULT_SETTINGS: Settings = { showCands: false, checkMistakes: false, level: 1, hintLevel: 5, theme: 'system' };

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

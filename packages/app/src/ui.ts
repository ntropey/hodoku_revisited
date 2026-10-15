import type { HintLevel } from './protocol';

export type Mode = 'value' | 'notes' | 'filter' | 'color';

/** The original's three game modes: plain play, learning (auto-solve to the technique) and practising. */
export type GameMode = 'playing' | 'learning' | 'practising';

/** The things the Copy menu can put on the clipboard. */
export type CopyWhat = 'givens' | 'pm' | 'library' | 'formatted';
export type Theme = 'system' | 'light' | 'dark';
export type Tab = 'hint' | 'steps' | 'path' | 'summary';

export interface Settings {
  showCands: boolean;
  checkMistakes: boolean;
  /** fill the last empty cell of a row, column or box automatically after a move */
  autoFill: boolean;
  /** level of "New puzzle" */
  level: number;
  hintLevel: HintLevel;
  /** solution types a hint may NOT use; empty means every technique is allowed (the default) */
  disabledTechniques: string[];
  /** ColorKu: draw digits and candidates as coloured balls instead of numerals */
  colorKu: boolean;
  /** ColorKu: the colour per digit 1-9 (hex strings) */
  colorKuColors: string[];
  /** show an enlarged view of the selected cell */
  cellZoom: boolean;
  /** mark the cells whose candidate marks differ from what the placed values allow */
  showDeviations: boolean;
  theme: Theme;
  /** the original's game mode; 'playing' is the plain mode */
  gameMode: GameMode;
  /** techniques Training modes drill; a new puzzle is guaranteed to need at least one */
  trainingTechniques: string[];
  /** bank indices already played, per level */
  seen?: Record<number, number[]>;
}

/** The default ColorKu palette: one distinct colour per digit. */
export const DEFAULT_COLORKU_COLORS = ['#e03131', '#f08c00', '#fab005', '#2f9e44', '#0c8599', '#1971c2', '#6741d9', '#c2255c', '#868e96'];

/** The palette for colouring cells and candidates yourself; semi-transparent so the board shows through. */
export const PALETTE = ['#e0313180', '#f08c0080', '#2f9e4480', '#1971c280', '#6741d980', '#c2255c80'];

export const DEFAULT_SETTINGS: Settings = {
  showCands: false,
  checkMistakes: false,
  autoFill: false,
  level: 1,
  hintLevel: 5,
  disabledTechniques: [],
  colorKu: false,
  colorKuColors: DEFAULT_COLORKU_COLORS,
  cellZoom: false,
  showDeviations: false,
  theme: 'system',
  gameMode: 'playing',
  trainingTechniques: [],
};

/** The ColorKu colour of a digit, falling back to the default palette (for old saves with a short list). */
export function colorKuColor(colors: readonly string[] | undefined, digit: number): string {
  return colors?.[digit - 1] ?? DEFAULT_COLORKU_COLORS[digit - 1] ?? '#888888';
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

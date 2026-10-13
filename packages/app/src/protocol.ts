/** Messages between the UI and the solver worker. */

export interface HintResult {
  /** Technique name, e.g. "Naked Pair" */
  name: string;
  /** Cells that make up the pattern (0..80) */
  cells: number[];
  /** Digits that can be placed, one per entry in `cells` for singles */
  placements: { cell: number; digit: number }[];
  /** Candidates that can be eliminated */
  eliminations: { cell: number; digit: number }[];
  text: string;
}

export type WorkerRequest =
  | { id: number; kind: 'generate'; level: number }
  | { id: number; kind: 'bank'; level: number; seen: number[] }
  | { id: number; kind: 'analyze'; puzzle: string }
  | { id: number; kind: 'hint'; values: number[]; cands: number[] };

export interface PuzzleInfo {
  /** 81 characters, '.' for empty cells */
  puzzle: string;
  solution: number[];
  level: number;
  score: number;
  /** Set for puzzles from the bank: its index in the level's list (to avoid repeats) */
  bankIndex?: number;
}

export type WorkerResponse =
  | { id: number; kind: 'puzzle'; info: PuzzleInfo }
  | { id: number; kind: 'hint'; hint: HintResult | null }
  | { id: number; kind: 'error'; message: string };

export const LEVEL_NAMES = ['', 'Easy', 'Medium', 'Hard', 'Unfair', 'Extreme'];
export const cellName = (i: number): string => `r${Math.floor(i / 9) + 1}c${(i % 9) + 1}`;

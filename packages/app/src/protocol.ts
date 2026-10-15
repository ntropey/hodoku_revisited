/** Messages between the UI and the solver worker. */
import type { StepMarks } from '@hodoku/core';

export interface HintResult {
  /** Technique name, e.g. "Naked Pair" */
  name: string;
  type: string;
  /** What to do, e.g. "3 goes in r1c1" */
  text: string;
  /** One sentence on why the technique works */
  summary: string;
  /** Guide page on the website (techniques/<slug>.html), if there is one */
  slug: string | null;
  /** Cells, candidates and chains of the step, ready to draw */
  marks: StepMarks;
  /** Chains in the usual notation: 3r1c1 = 3r1c5 - ... */
  notation: string[];
}

/** How hard a technique the hint may use: 0 = singles only, 1-5 = up to Easy ... Extreme */
export type HintLevel = 0 | 1 | 2 | 3 | 4 | 5;
export const HINT_LEVEL_NAMES = ['Singles only', 'Up to Easy', 'Up to Medium', 'Up to Hard', 'Up to Unfair', 'Everything'];

/** The text formats the Copy menu can produce, see {@link formatSudoku}. */
export type CopyFormat = 'PM_GRID' | 'LIBRARY' | 'VALUES_ONLY' | 'CLUES_ONLY_FORMATTED';

export type WorkerRequest =
  | { id: number; kind: 'generate'; level: number }
  | { id: number; kind: 'bank'; level: number; seen: number[] }
  | { id: number; kind: 'train'; level: number; techniques: string[]; autoSolve: boolean; seen: number[] }
  | { id: number; kind: 'analyze'; puzzle: string }
  | { id: number; kind: 'hint'; values: number[]; cands: number[]; level: HintLevel; disabled: string[] }
  | { id: number; kind: 'allHints'; values: number[]; cands: number[]; level: HintLevel; disabled: string[] }
  | { id: number; kind: 'path'; values: number[]; cands: number[] }
  | { id: number; kind: 'format'; values: number[]; cands: number[]; mode: CopyFormat }
  | { id: number; kind: 'book'; sections: PrintSection[]; techniques: string[] };

/** One technique used on the way from the givens to the solution (the "solve path"). */
export interface PathEntry {
  name: string;
  type: string;
  slug: string | null;
  count: number;
  /** HoDoKu base score of the technique: how hard it is */
  score: number;
}

export interface PuzzleInfo {
  /** 81 characters, '.' for empty cells */
  puzzle: string;
  solution: number[];
  level: number;
  score: number;
  /** The techniques of the solve path, hardest first, then by count */
  path?: PathEntry[];
  /** Set for puzzles from the bank: its index in the level's list (to avoid repeats) */
  bankIndex?: number;
  /** Set by a training puzzle in Learning mode: the board solved up to the trained technique. */
  board?: { values: number[]; cands: number[] };
}

/** One section of an extended print job: how many puzzles, of which level, in which mode. */
export interface PrintSection {
  level: number;
  count: number;
  mode: 'playing' | 'learning' | 'practising';
  /** print the candidates the placed values still allow */
  cands: boolean;
}

/** One puzzle of an extended print job, ready to draw. */
export interface PrintSudoku {
  /** 81 characters, '.' for empty cells: the givens */
  givens: string;
  /** the values to print (a Learning puzzle is solved up to its technique) */
  values: number[];
  /** candidate bitmasks, bit d = digit d, only what the values allow */
  cands: number[];
  level: number;
  score: number;
  /** from the section: whether to print the candidates */
  showCands: boolean;
}

export type WorkerResponse =
  | { id: number; kind: 'puzzle'; info: PuzzleInfo }
  | { id: number; kind: 'train'; info: PuzzleInfo | null }
  | { id: number; kind: 'hint'; hint: HintResult | null }
  | { id: number; kind: 'allHints'; results: HintResult[]; total: Record<string, number> }
  | { id: number; kind: 'path'; steps: HintResult[] }
  | { id: number; kind: 'format'; text: string }
  | { id: number; kind: 'book'; puzzles: PrintSudoku[] }
  | { id: number; kind: 'error'; message: string };

export const LEVEL_NAMES = ['', 'Easy', 'Medium', 'Hard', 'Unfair', 'Extreme'];
export const cellName = (i: number): string => `r${Math.floor(i / 9) + 1}c${(i % 9) + 1}`;

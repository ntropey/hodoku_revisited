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

export type WorkerRequest =
  | { id: number; kind: 'generate'; level: number }
  | { id: number; kind: 'bank'; level: number; seen: number[] }
  | { id: number; kind: 'analyze'; puzzle: string }
  | { id: number; kind: 'hint'; values: number[]; cands: number[]; level: HintLevel }
  | { id: number; kind: 'allHints'; values: number[]; cands: number[]; level: HintLevel };

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
}

export type WorkerResponse =
  | { id: number; kind: 'puzzle'; info: PuzzleInfo }
  | { id: number; kind: 'hint'; hint: HintResult | null }
  | { id: number; kind: 'allHints'; results: HintResult[]; total: Record<string, number> }
  | { id: number; kind: 'error'; message: string };

export const LEVEL_NAMES = ['', 'Easy', 'Medium', 'Hard', 'Unfair', 'Extreme'];
export const cellName = (i: number): string => `r${Math.floor(i / 9) + 1}c${(i % 9) + 1}`;

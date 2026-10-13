/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's BackgroundGenerator (Java).
 */
import { getDifficultyLevel } from '../options.js';
import { SudokuSolver } from '../solver/sudokuSolver.js';
import type { Sudoku2 } from '../sudoku2.js';
import type { Rng } from './random.js';
import { SudokuGenerator } from './sudokuGenerator.js';

export interface GeneratedPuzzle {
  /** The puzzle; `level` and `score` are set. */
  sudoku: Sudoku2;
  /** The givens as 81-character string. */
  puzzle: string;
  /** Difficulty level ordinal (1 = easy ... 5 = extreme). */
  level: number;
  score: number;
  /** How many candidate puzzles had to be created and rated. */
  tries: number;
}

export interface GenerateLevelOptions {
  rng?: Rng;
  /** Give up after this many candidates (default 20000, like the original). */
  maxTries?: number;
  /** Symmetric puzzles (default true). */
  symmetric?: boolean;
}

/**
 * Generate a puzzle of exactly the given difficulty level (1 = easy ... 5 = extreme): puzzles are
 * generated and rated with the solver until one has the wanted level and is not at the lower edge of
 * it. Returns null if nothing suitable is found within `maxTries` candidates.
 */
export function generatePuzzle(level: number, options: GenerateLevelOptions = {}): GeneratedPuzzle | null {
  const generator = new SudokuGenerator(options.rng);
  const solver = new SudokuSolver();
  const maxTries = options.maxTries ?? 20000;
  const wanted = getDifficultyLevel(level);
  for (let tries = 1; tries <= maxTries; tries++) {
    const sudoku = generator.generateSudoku({ symmetric: options.symmetric ?? true });
    if (sudoku === null) return null;
    const solved = sudoku.clone();
    solver.setSudoku(solved);
    const ok = solver.solve({ maxLevel: wanted, rejectTooLowScore: true });
    if (ok && solved.level === wanted.ordinal) {
      sudoku.level = solved.level;
      sudoku.score = solved.score;
      return { sudoku, puzzle: sudoku.getCluesString(), level: wanted.ordinal, score: solved.score, tries };
    }
  }
  return null;
}

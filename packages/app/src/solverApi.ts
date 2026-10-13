/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Pure functions on top of @hodoku/core, used by the worker (and testable without one).
 */
import {
  SOLUTION_TYPE_INFO,
  Sudoku2,
  SudokuGenerator,
  SudokuSolver,
  generatePuzzle,
  tables,
} from '@hodoku/core';
import { cellName, type HintResult, type PuzzleInfo } from './protocol';

/** Rate a puzzle and find its solution. Throws if it is invalid or has no unique solution. */
export function analyze(puzzle: string): PuzzleInfo {
  const s = new Sudoku2();
  s.setSudoku(puzzle);
  const clues = s.getCluesString();
  if (81 - s.unsolvedCellsAnz < 17) throw new Error('A sudoku needs at least 17 givens.');
  const count = new SudokuGenerator().getNumberOfSolutions(s.clone());
  if (count === 0) throw new Error('This puzzle has no solution.');
  if (count > 1) throw new Error('This puzzle has more than one solution.');
  const work = s.clone();
  const solver = new SudokuSolver();
  solver.setSudoku(work);
  solver.solve();
  if (!work.isSolved()) throw new Error('The solver could not complete this puzzle.');
  return { puzzle: clues, solution: Array.from(work.values), level: work.level ?? 5, score: work.score };
}

export function generate(level: number): PuzzleInfo {
  const result = generatePuzzle(level);
  if (result === null) throw new Error('No puzzle of this level found. Try again.');
  const info = analyze(result.puzzle);
  return { ...info, level: result.level, score: result.score };
}

/** The next logical step for the given board (values and candidate bitmasks, bit d = digit d). */
export function hint(values: number[], cands: number[]): HintResult | null {
  const s = new Sudoku2();
  s.setSudoku(values.map((v) => (v === 0 ? '.' : String(v))).join(''));
  for (let i = 0; i < 81; i++) {
    if (values[i] !== 0) continue;
    for (let d = 1; d <= 9; d++) {
      if (s.isCandidate(i, d) && (cands[i] & (1 << d)) === 0) s.setCandidate(i, d, false);
    }
  }
  const step = new SudokuSolver().getHint(s, false);
  if (step === null || step.type === 'GIVE_UP' || step.type === 'INCOMPLETE') return null;
  const name = SOLUTION_TYPE_INFO[step.type].stepName;
  const placements: HintResult['placements'] = [];
  if (step.values.length > 0 && step.candidatesToDelete.length === 0) {
    step.indices.forEach((cell, k) => placements.push({ cell, digit: step.values[k] ?? step.values[0] }));
  }
  const eliminations = step.candidatesToDelete.map((c) => ({ cell: c.index, digit: c.value }));
  const cells = [...new Set(step.indices)];
  const where = (list: { cell: number }[]) => [...new Set(list.map((x) => cellName(x.cell)))].join(', ');
  let text = name + ': ';
  if (placements.length > 0) {
    text += placements.map((p) => `${p.digit} goes in ${cellName(p.cell)}`).join('; ');
  } else {
    const digits = [...new Set(eliminations.map((e) => e.digit))].sort().join(', ');
    text += `remove ${digits} from ${where(eliminations)}`;
  }
  return { name, cells, placements, eliminations, text };
}

export const PEERS: readonly (readonly number[])[] = tables.BUDDIES.map((b) => [...b.values()]);

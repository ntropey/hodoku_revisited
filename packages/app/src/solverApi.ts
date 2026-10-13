/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Pure functions on top of @hodoku/core, used by the worker (and testable without one).
 */
import {
  SOLUTION_TYPE_INFO,
  chainNotation,
  defaultSolverSteps,
  describeStep,
  Sudoku2,
  SudokuGenerator,
  SudokuSolver,
  generatePuzzle,
  cellName,
  tables,
} from '@hodoku/core';
import { bankPuzzle, isomorph, pickBankIndex, type Rng } from './bank/bank';
import type { HintLevel, HintResult, PuzzleInfo } from './protocol';
import { techniqueInfo } from './techniqueInfo';

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

/**
 * A puzzle of the given level from the bank, disguised by a random isomorphism (kept only if the solver
 * rates it the same, which it almost always does). Null if the bank has none of that level.
 */
export function fromBank(level: number, seen: readonly number[], rng: Rng = Math.random): PuzzleInfo | null {
  const index = pickBankIndex(level, seen, rng);
  if (index === null) return null;
  const original = bankPuzzle(level, index);
  let info = analyze(isomorph(original, rng));
  if (info.level !== level) info = analyze(original);
  return { ...info, bankIndex: index };
}

/** The next logical step for the given board (values and candidate bitmasks, bit d = digit d). */
export function hint(values: number[], cands: number[], level: HintLevel = 5): HintResult | null {
  const s = new Sudoku2();
  s.setSudoku(values.map((v) => (v === 0 ? '.' : String(v))).join(''));
  for (let i = 0; i < 81; i++) {
    if (values[i] !== 0) continue;
    for (let d = 1; d <= 9; d++) {
      if (s.isCandidate(i, d) && (cands[i] & (1 << d)) === 0) s.setCandidate(i, d, false);
    }
  }
  const before = s.clone();
  const solver = new SudokuSolver();
  solver.setSudoku(s);
  const configs = defaultSolverSteps().map((c) => ({ ...c, enabled: c.enabled && c.level <= level }));
  const step = solver.getHint(level === 0, configs);
  if (step === null || step.type === 'GIVE_UP' || step.type === 'INCOMPLETE') return null;
  const name = SOLUTION_TYPE_INFO[step.type].stepName;
  const marks = describeStep(step, before);
  const where = (list: { cell: number }[]) => [...new Set(list.map((x) => cellName(x.cell)))].join(', ');
  let text: string;
  if (marks.place.length > 0 && marks.elim.length === 0) {
    text = marks.place.map((p) => `${p.digit} goes in ${cellName(p.cell)}`).join('; ');
  } else {
    const digits = [...new Set(marks.elim.map((e) => e.digit))].sort().join(', ');
    text = `remove ${digits} from ${where(marks.elim)}`;
  }
  const info = techniqueInfo(step.type);
  return {
    name,
    type: step.type,
    text: `${name}: ${text}`,
    summary: info?.summary ?? (step.type === 'BRUTE_FORCE' ? 'No logical technique applies here, so this digit comes from trial and error.' : ''),
    slug: info?.slug ?? null,
    marks,
    notation: marks.chains.map((c) => chainNotation(c)),
  };
}

export const PEERS: readonly (readonly number[])[] = tables.BUDDIES.map((b) => [...b.values()]);

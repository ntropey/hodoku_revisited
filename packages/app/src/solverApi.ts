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
  SudokuStepFinder,
  type SolutionStep,
  generatePuzzle,
  formatSudoku,
  cellName,
  tables,
} from '@hodoku/core';
import { bankPuzzle, bankSize, isomorph, pickBankIndex, type Rng } from './bank/bank';
import type { CopyFormat, HintLevel, HintResult, PathEntry, PrintSection, PrintSudoku, PuzzleInfo } from './protocol';
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
  return { puzzle: clues, solution: Array.from(work.values), level: work.level ?? 5, score: work.score, path: solvePath(solver) };
}

/** The techniques the solver used, hardest first, then the most frequent. */
function solvePath(solver: SudokuSolver): PathEntry[] {
  const scores = new Map<string, number>(defaultSolverSteps().map((c) => [c.type, c.baseScore]));
  const byType = new Map<string, PathEntry>();
  for (const step of solver.getSteps()) {
    if (step.type === 'GIVE_UP' || step.type === 'INCOMPLETE') continue;
    const e = byType.get(step.type);
    if (e) e.count++;
    else {
      const info = techniqueInfo(step.type);
      byType.set(step.type, { name: SOLUTION_TYPE_INFO[step.type].stepName, type: step.type, slug: info?.slug ?? null, count: 1, score: scores.get(step.type) ?? 0 });
    }
  }
  const list = [...byType.values()];
  const hardest = list.reduce<PathEntry | null>((a, b) => (a === null || b.score > a.score ? b : a), null);
  return list.sort((a, b) => (a === hardest ? -1 : b === hardest ? 1 : b.count - a.count || b.score - a.score));
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

/** Fisher–Yates shuffle in place; returns the same array for convenience. */
function shuffle<T>(a: T[], rng: Rng): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A fresh board of the puzzle. */
function boardOf(puzzle: string): Sudoku2 {
  const s = new Sudoku2();
  s.setSudoku(puzzle);
  return s;
}

/** The candidates of a board's empty cells: what the placed values still allow (bit d = digit d). */
function candsOf(s: Sudoku2): number[] {
  const cands = new Array<number>(81).fill(0);
  for (let i = 0; i < 81; i++) {
    if (s.values[i] !== 0) continue;
    let mask = 0;
    for (let d = 1; d <= 9; d++) if (s.isCandidate(i, d)) mask |= 1 << d;
    cands[i] = mask;
  }
  return cands;
}

/**
 * The puzzle solved up to its technique: the solver's own steps are replayed on a fresh board and the
 * replay stops before the first step that uses one of `techniques`, which is exactly where the
 * original's Learning mode stops. Disabling the techniques instead would let other ones carry on and
 * could hand back a solved board.
 */
function trainBoard(puzzle: string, techniques: readonly string[]): { values: number[]; cands: number[] } {
  const solver = new SudokuSolver();
  solver.setSudoku(boardOf(puzzle));
  solver.solve();
  const board = boardOf(puzzle);
  const wanted = new Set(techniques);
  for (const step of solver.getSteps()) {
    if (wanted.has(step.type)) break;
    solver.doStep(board, step);
  }
  return { values: Array.from(board.values), cands: candsOf(board) };
}

/**
 * A bank puzzle of the level that needs at least one of `techniques` (a technique the standard
 * solution uses). Examines puzzles in a random order, skipping `seen`, and stops after `maxTries`
 * analyses; returns null when none was found. With `autoSolve` the board is solved up to the first
 * step that uses one of `techniques`, which is the state Learning mode starts from.
 */
export function train(level: number, techniques: string[], autoSolve: boolean, seen: readonly number[], rng: Rng = Math.random, maxTries = 500): PuzzleInfo | null {
  if (techniques.length === 0) return null;
  const n = bankSize(level);
  if (n === 0) return null;
  const seenSet = new Set(seen);
  const free: number[] = [];
  const played: number[] = [];
  for (let i = 0; i < n; i++) (seenSet.has(i) ? played : free).push(i);
  const order = [...shuffle(free, rng), ...shuffle(played, rng)];
  const wanted = new Set(techniques);
  let tries = 0;
  for (const index of order) {
    if (tries >= maxTries) break;
    tries++;
    const puzzle = bankPuzzle(level, index);
    const info = analyze(puzzle);
    if (!info.path?.some((p) => wanted.has(p.type))) continue;
    return { ...info, bankIndex: index, board: autoSolve ? trainBoard(puzzle, techniques) : undefined };
  }
  return null;
}

/** The givens' values and the candidates those values still allow (bit d = digit d). */
function candsFromGivens(puzzle: string): { values: number[]; cands: number[] } {
  const s = boardOf(puzzle);
  return { values: Array.from(s.values), cands: candsOf(s) };
}

/**
 * The puzzles of an extended print job, in section order. Playing and Practicing sections print the
 * puzzle's starting board; a Learning section prints a bank puzzle solved as far as the solver gets
 * with `techniques` switched off (the original's behavior), falling back to the starting board when
 * no puzzle of the level needs one. Bank indices are not recorded (printing must not change what the
 * app considers "seen").
 */
export function book(sections: readonly PrintSection[], techniques: readonly string[], rng: Rng = Math.random): PrintSudoku[] {
  const out: PrintSudoku[] = [];
  for (const section of sections) {
    const level = Math.min(5, Math.max(1, section.level));
    const count = Math.min(99, Math.max(0, Math.floor(section.count)));
    for (let i = 0; i < count; i++) {
      const info = section.mode === 'learning' && techniques.length > 0 ? train(level, [...techniques], true, [], rng, 150) : null;
      if (info !== null && info.board) {
        out.push({ givens: info.puzzle, values: info.board.values, cands: info.board.cands, level: info.level, score: info.score, showCands: section.cands });
        continue;
      }
      const playing = fromBank(level, [], rng);
      if (playing === null) continue;
      const board = candsFromGivens(playing.puzzle);
      out.push({ givens: playing.puzzle, values: board.values, cands: board.cands, level: playing.level, score: playing.score, showCands: section.cands });
    }
  }
  return out;
}

/** The board as the solver sees it: values, and only the candidates the player still has. */
function boardToSudoku(values: number[], cands: number[]): Sudoku2 {
  const s = new Sudoku2();
  s.setSudoku(values.map((v) => (v === 0 ? '.' : String(v))).join(''));
  for (let i = 0; i < 81; i++) {
    if (values[i] !== 0) continue;
    for (let d = 1; d <= 9; d++) {
      if (s.isCandidate(i, d) && (cands[i] & (1 << d)) === 0) s.setCandidate(i, d, false);
    }
  }
  return s;
}

function toHintResult(step: SolutionStep, before: Sudoku2): HintResult {
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

/** The next logical step for the given board (values and candidate bitmasks, bit d = digit d). */
export function hint(values: number[], cands: number[], level: HintLevel = 5, disabled: readonly string[] = []): HintResult | null {
  const s = boardToSudoku(values, cands);
  const before = s.clone();
  const solver = new SudokuSolver();
  solver.setSudoku(s);
  const off = new Set(disabled);
  const configs = defaultSolverSteps().map((c) => ({ ...c, enabled: c.enabled && (level === 0 || c.level <= level) && !off.has(c.type) }));
  const step = solver.getHint(level === 0, configs);
  if (step === null || step.type === 'GIVE_UP' || step.type === 'INCOMPLETE') return null;
  return toHintResult(step, before);
}

/**
 * The solver's own way from the given board to the solution: every step it would take, in order, ready
 * to draw. The marks of each step are computed against the board just before it, so the first step fits
 * the board as it is and applying the steps one by one walks the solution path. Always uses the full
 * technique set (not the hint filters).
 */
export function path(values: number[], cands: number[]): HintResult[] {
  const solver = new SudokuSolver();
  solver.setSudoku(boardToSudoku(values, cands));
  solver.solve();
  const replay = boardToSudoku(values, cands);
  const steps: HintResult[] = [];
  for (const step of solver.getSteps()) {
    if (step.type === 'GIVE_UP' || step.type === 'INCOMPLETE') break;
    steps.push(toHintResult(step, replay));
    solver.doStep(replay, step);
  }
  return steps;
}

/** One of the text formats the original could copy, for the current board (values and candidates). */
export function format(values: number[], cands: number[], mode: CopyFormat): string {
  return formatSudoku(boardToSudoku(values, cands), mode);
}

/**
 * Every step that is available right now ("find all steps"), grouped by technique and sorted from
 * easy to hard. Techniques above `level` are skipped (0 = singles only); at most `perType` steps are
 * returned per technique and `total` tells how many there are. Techniques in `disabled` are dropped
 * entirely (so they do not show up in `total` either).
 */
export function allHints(
  values: number[],
  cands: number[],
  level: HintLevel = 5,
  perType = 12,
  disabled: readonly string[] = [],
): { results: HintResult[]; total: Record<string, number> } {
  const s = boardToSudoku(values, cands);
  const finder = new SudokuStepFinder();
  const steps: SolutionStep[] = [];
  const run = (minLevel: number, find: () => SolutionStep[]) => {
    if (level >= minLevel) steps.push(...find());
  };
  const isSingle = (st: SolutionStep) => st.type === 'NAKED_SINGLE' || st.type === 'HIDDEN_SINGLE' || st.type === 'FULL_HOUSE';
  // singles: Full Houses are Naked Singles, too; the subset searches contain the singles again
  run(0, () => finder.findAllFullHouses(s.clone()));
  run(0, () => finder.findAllNakedSingles(s.clone()));
  run(0, () => finder.findAllHiddenSingles(s.clone()));
  run(1, () => finder.findAllLockedCandidates(s.clone()));
  run(1, () => finder.findAllNakedXle(s.clone()).filter((st) => !isSingle(st)));
  run(1, () => finder.findAllHiddenXle(s.clone()).filter((st) => !isSingle(st)));
  run(3, () => finder.getAllFishes(s.clone(), 2, 4, 5, 2, -1, 0));
  run(3, () => finder.findAllSkyScrapers(s.clone()));
  run(3, () => finder.findAllTwoStringKites(s.clone()));
  run(3, () => finder.findAllEmptyRectangles(s.clone()));
  run(3, () => finder.getAllWings(s.clone()));
  run(3, () => finder.getAllUniqueness(s.clone()));
  run(3, () => finder.findAllSimpleColors(s.clone()));
  run(3, () => finder.findAllMultiColors(s.clone()));
  run(3, () => finder.getAllChains(s.clone()));
  run(4, () => finder.getAllSueDeCoqs(s.clone()));
  run(4, () => finder.getAllAlses(s.clone(), true, true, true));
  run(4, () => finder.getAllDeathBlossoms(s.clone()));
  run(4, () => finder.getAllNiceLoops(s.clone()));
  run(4, () => finder.getAllGroupedNiceLoops(s.clone()));
  run(5, () => finder.getAllForcingChains(s.clone()));
  run(5, () => finder.getAllForcingNets(s.clone()));
  // a stable order: by difficulty of the technique, then the order found
  const order = new Map<string, number>(defaultSolverSteps().map((c, i) => [c.type, i]));
  const off = new Set(disabled);
  const sorted = steps
    .map((st, i) => ({ st, i }))
    .sort((a, b) => (order.get(a.st.type) ?? 999) - (order.get(b.st.type) ?? 999) || a.i - b.i)
    .map((x) => x.st)
    .filter((st) => !off.has(st.type));
  const total: Record<string, number> = {};
  const counts: Record<string, number> = {};
  const results: HintResult[] = [];
  for (const st of sorted) {
    const name = SOLUTION_TYPE_INFO[st.type].stepName;
    total[name] = (total[name] ?? 0) + 1;
    if ((counts[name] = (counts[name] ?? 0) + 1) > perType) continue;
    results.push(toHintResult(st, s));
  }
  return { results, total };
}

export const PEERS: readonly (readonly number[])[] = tables.BUDDIES.map((b) => [...b.values()]);

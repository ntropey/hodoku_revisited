import { describe, expect, it } from 'vitest';
import { Sudoku2, SudokuGenerator, SudokuSolver, generatePuzzle, seededRng } from '../src/index.js';

/** An independent solution counter (plain backtracking over rows/cols/boxes), stops at 2. */
function countSolutions(puzzle: string): number {
  const g = [...puzzle].map((c) => (c >= '1' && c <= '9' ? Number(c) : 0));
  let count = 0;
  const ok = (i: number, v: number): boolean => {
    const r = Math.floor(i / 9);
    const c = i % 9;
    for (let k = 0; k < 9; k++) {
      if (g[r * 9 + k] === v || g[k * 9 + c] === v) return false;
    }
    const br = r - (r % 3);
    const bc = c - (c % 3);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (g[(br + a) * 9 + bc + b] === v) return false;
    return true;
  };
  const rec = (): void => {
    if (count > 1) return;
    const i = g.indexOf(0);
    if (i === -1) {
      count++;
      return;
    }
    for (let v = 1; v <= 9; v++) {
      if (ok(i, v)) {
        g[i] = v;
        rec();
        g[i] = 0;
      }
    }
  };
  rec();
  return count;
}

describe('SudokuGenerator', () => {
  it('creates puzzles with exactly one solution and at least 17 clues', () => {
    const gen = new SudokuGenerator(seededRng(1));
    for (let n = 0; n < 15; n++) {
      const s = gen.generateSudoku()!;
      const puzzle = s.getCluesString();
      expect([...puzzle].filter((c) => c !== '.').length).toBeGreaterThanOrEqual(17);
      expect(countSolutions(puzzle)).toBe(1);
      expect(gen.validSolution(s)).toBe(true);
      expect(s.solutionSet).toBe(true);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = new SudokuGenerator(seededRng(42)).generateSudoku()!.getCluesString();
    const b = new SudokuGenerator(seededRng(42)).generateSudoku()!.getCluesString();
    const c = new SudokuGenerator(seededRng(43)).generateSudoku()!.getCluesString();
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('removes clues symmetrically by default', () => {
    const gen = new SudokuGenerator(seededRng(7));
    for (let n = 0; n < 5; n++) {
      const p = gen.generateSudoku({ symmetric: true })!.getCluesString();
      for (let i = 0; i < 81; i++) {
        const opposite = 80 - i; // rotation by 180 degrees
        expect(p[i] === '.', `cell ${i} of ${p}`).toBe(p[opposite] === '.');
      }
    }
  });

  it('counts solutions of ambiguous and invalid puzzles', () => {
    const gen = new SudokuGenerator(seededRng(1));
    // (like the original, a completely empty grid is reported as 0: no cell has fewer than 9 candidates)
    expect(gen.solveString('1' + '.'.repeat(80))).toBeGreaterThan(1);
    // two 1s in the first row
    expect(gen.solveString('11' + '.'.repeat(79))).toBe(0);
  });

  it('honors a pattern of givens', () => {
    const gen = new SudokuGenerator(seededRng(3));
    // a pattern with many givens always has a unique solution
    const pattern = Array.from({ length: 81 }, (_, i) => i % 3 !== 0);
    const s = gen.generateSudoku({ pattern })!;
    for (let i = 0; i < 81; i++) expect(s.fixed[i]).toBe(pattern[i]);
    expect(countSolutions(s.getCluesString())).toBe(1);
  });
});

describe('generatePuzzle', () => {
  it.each([1, 2, 3])('creates puzzles of level %i that the solver rates the same', (level) => {
    const rng = seededRng(100 + level);
    for (let n = 0; n < 3; n++) {
      const g = generatePuzzle(level, { rng })!;
      expect(g).not.toBeNull();
      expect(countSolutions(g.puzzle)).toBe(1);
      // rate it again from scratch
      const s = new Sudoku2();
      s.setSudoku(g.puzzle);
      const solver = new SudokuSolver();
      solver.setSudoku(s);
      expect(solver.solve()).toBe(true);
      expect(solver.getLevel().ordinal).toBe(level);
      expect(solver.getScore()).toBe(g.score);
    }
  });
});

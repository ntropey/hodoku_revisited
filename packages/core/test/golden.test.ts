/*
 * Compares the TypeScript solver with the ORIGINAL HoDoKu 2.2.0 (Java) on 200
 * generated puzzles. The expected results in fixtures/golden.jsonl were produced
 * by tools/golden/Golden.java.
 *
 * Only the techniques that are ported so far are compared: for every puzzle the
 * steps up to the first step that needs a not-yet-ported technique must match
 * exactly (type, cells, digits and eliminated candidates, in order). When the
 * Java solution uses only ported techniques, score, level and result must match too.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Sudoku2, SudokuSolver, type SolutionType } from '../src/index.js';

interface GoldenStep {
  type: SolutionType;
  indices: number[];
  values: number[];
  delete: [number, number][];
}
interface Golden {
  puzzle: string;
  solved: boolean;
  score: number;
  level: number;
  steps: GoldenStep[];
}

/** Techniques that are implemented in the TypeScript solver. */
const PORTED = new Set<SolutionType>([
  'FULL_HOUSE',
  'NAKED_SINGLE',
  'HIDDEN_SINGLE',
  'LOCKED_PAIR',
  'LOCKED_TRIPLE',
  'LOCKED_CANDIDATES_1',
  'LOCKED_CANDIDATES_2',
  'NAKED_PAIR',
  'NAKED_TRIPLE',
  'NAKED_QUADRUPLE',
  'HIDDEN_PAIR',
  'HIDDEN_TRIPLE',
  'HIDDEN_QUADRUPLE',
]);

const golden: Golden[] = readFileSync(new URL('./fixtures/golden.jsonl', import.meta.url), 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as Golden);

describe('golden data from HoDoKu 2.2.0', () => {
  it('has the expected fixtures', () => {
    expect(golden).toHaveLength(200);
  });

  it('matches the Java solver step by step for the ported techniques', () => {
    let fullyPorted = 0;
    let stepsCompared = 0;
    for (const g of golden) {
      const sudoku = new Sudoku2();
      sudoku.setSudoku(g.puzzle);
      const solver = new SudokuSolver();
      solver.setSudoku(sudoku);
      const solved = solver.solve();

      const firstUnported = g.steps.findIndex((s) => !PORTED.has(s.type));
      const expected = firstUnported === -1 ? g.steps : g.steps.slice(0, firstUnported);
      const actual = solver.getSteps().map((s) => ({
        type: s.type,
        indices: s.indices,
        values: s.values,
        delete: s.candidatesToDelete.map((c) => [c.index, c.value]),
      }));
      expect(actual, `puzzle ${g.puzzle}`).toEqual(expected);
      stepsCompared += expected.length;

      if (firstUnported === -1) {
        fullyPorted++;
        expect(solved, `solved ${g.puzzle}`).toBe(g.solved);
        expect(solver.getScore(), `score ${g.puzzle}`).toBe(g.score);
        expect(solver.getLevel().ordinal, `level ${g.puzzle}`).toBe(g.level);
        expect(sudoku.isSolved()).toBe(true);
      } else {
        expect(solved).toBe(false);
      }
    }
    // make sure the test actually exercises something
    expect(fullyPorted).toBe(144);
    expect(stepsCompared).toBe(9410);
  });
});

/*
 * Compares the TypeScript solver with the ORIGINAL HoDoKu 2.2.0 (Java) on 200
 * generated puzzles. The expected results in fixtures/golden.jsonl were produced
 * by tools/golden/Golden.java.
 *
 * The solver is run in lockstep with the recorded Java solution: for every Java
 * step whose technique is ported, the TypeScript solver must find exactly the same
 * step (type, cells, digits, eliminated candidates) in the same state. The comparison
 * of a puzzle stops at the first Java step that needs a not-yet-ported technique.
 * When all steps of a puzzle are ported, the TypeScript solver must also find no
 * further step, and score, level and result of a full run must match.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Sudoku2, SudokuSolver, type SolutionStep, type SolutionType } from '../src/index.js';

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
  'SKYSCRAPER',
  'TWO_STRING_KITE',
  'EMPTY_RECTANGLE',
  'XY_WING',
  'XYZ_WING',
  'W_WING',
  'UNIQUENESS_1',
  'UNIQUENESS_2',
  'UNIQUENESS_3',
  'UNIQUENESS_4',
  'UNIQUENESS_5',
  'UNIQUENESS_6',
  'HIDDEN_RECTANGLE',
  'AVOIDABLE_RECTANGLE_1',
  'AVOIDABLE_RECTANGLE_2',
  'BUG_PLUS_1',
  'SIMPLE_COLORS_TRAP',
  'SIMPLE_COLORS_WRAP',
  'MULTI_COLORS_1',
  'MULTI_COLORS_2',
  'SUE_DE_COQ',
  'REMOTE_PAIR',
  'TURBOT_FISH',
  'X_CHAIN',
  'XY_CHAIN',
  'BRUTE_FORCE',
  'GIVE_UP',
  'DISCONTINUOUS_NICE_LOOP',
  'CONTINUOUS_NICE_LOOP',
  'AIC',
  'GROUPED_DISCONTINUOUS_NICE_LOOP',
  'GROUPED_CONTINUOUS_NICE_LOOP',
  'GROUPED_AIC',
  'FORCING_CHAIN_CONTRADICTION',
  'FORCING_CHAIN_VERITY',
  'FORCING_NET_CONTRADICTION',
  'FORCING_NET_VERITY',
  'ALS_XZ',
  'ALS_XY_WING',
  'ALS_XY_CHAIN',
  'DEATH_BLOSSOM',
  'X_WING',
  'SWORDFISH',
  'JELLYFISH',
  'FINNED_X_WING',
  'SASHIMI_X_WING',
  'FINNED_SWORDFISH',
  'SASHIMI_SWORDFISH',
  'FINNED_JELLYFISH',
  'SASHIMI_JELLYFISH',
  'FRANKEN_X_WING',
  'FRANKEN_SWORDFISH',
  'FINNED_FRANKEN_X_WING',
  'FINNED_FRANKEN_SWORDFISH',
]);

/** Puzzles from HoDoKu's own generator, and from the generator of this port, both solved by the Java jar. */
const FIXTURES = ['./fixtures/golden.jsonl', './fixtures/golden-ts.jsonl', './fixtures/golden-hard.jsonl'];
const golden: Golden[] = FIXTURES.flatMap((f) =>
  readFileSync(new URL(f, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Golden),
);

describe('golden data from HoDoKu 2.2.0', () => {
  it('has the expected fixtures', () => {
    expect(golden.length).toBeGreaterThan(500);
  });

  it('finds the same steps as the Java solver (lockstep)', () => {
    let fullyPorted = 0;
    let stepsCompared = 0;
    for (const g of golden) {
      const sudoku = new Sudoku2();
      sudoku.setSudoku(g.puzzle);
      const solver = new SudokuSolver();
      solver.setSudoku(sudoku);

      let allPorted = true;
      for (let i = 0; i < g.steps.length; i++) {
        const expected = g.steps[i];
        if (!PORTED.has(expected.type)) {
          allPorted = false;
          break;
        }
        const step = solver.step();
        expect(step === null ? null : summarize(step), `puzzle ${g.puzzle}, step ${i}`).toEqual(expected);
        stepsCompared++;
      }
      if (!allPorted) continue;

      fullyPorted++;
      if (g.steps[g.steps.length - 1]?.type !== 'GIVE_UP') {
        expect(solver.step(), `extra step in ${g.puzzle}`).toBeNull();
        expect(sudoku.isSolved()).toBe(true);
      }

      // a full run must agree on result, score and level
      const full = new Sudoku2();
      full.setSudoku(g.puzzle);
      const fullSolver = new SudokuSolver();
      fullSolver.setSudoku(full);
      expect(fullSolver.solve(), `solved ${g.puzzle}`).toBe(g.solved);
      expect(fullSolver.getScore(), `score ${g.puzzle}`).toBe(g.score);
      expect(fullSolver.getLevel().ordinal, `level ${g.puzzle}`).toBe(g.level);
    }
    console.log(`golden: ${stepsCompared} steps compared, ${fullyPorted}/${golden.length} puzzles fully ported`);
    expect(fullyPorted).toBeGreaterThan(0);
  });
});

function summarize(s: SolutionStep): GoldenStep {
  return {
    type: s.type,
    indices: s.indices,
    values: s.values,
    delete: s.candidatesToDelete.map((c) => [c.index, c.value] as [number, number]),
  };
}

/*
 * "Find all steps": compares the lists of ALL steps of every technique with the original HoDoKu 2.2.0
 * (SudokuStepFinder.findAll... / getAll...) on several states of 30 puzzles: stuck after singles and
 * after a few harder steps. The states are read in the HoDoKu library format. Expected data comes from
 * `java Golden all` (tools/golden/Golden.java).
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { Sudoku2, SudokuStepFinder, type SolutionStep, type SolutionType } from '../src/index.js';

interface GoldenStep {
  type: SolutionType;
  indices: number[];
  values: number[];
  delete: [number, number][];
}
interface State {
  puzzle: string;
  state: string;
  all: Record<string, GoldenStep[] | string>;
}

const states: State[] = gunzipSync(readFileSync(new URL('./fixtures/golden-all.jsonl.gz', import.meta.url)))
  .toString('utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as State);

/** The find-all functions that are ported, by the name used in the golden data. */
const IMPLEMENTED: Record<string, (f: SudokuStepFinder, s: Sudoku2) => SolutionStep[]> = {
  fullHouses: (f, s) => f.findAllFullHouses(s),
  nakedSingles: (f, s) => f.findAllNakedSingles(s),
  hiddenSingles: (f, s) => f.findAllHiddenSingles(s),
  nakedXle: (f, s) => f.findAllNakedXle(s),
  hiddenXle: (f, s) => f.findAllHiddenXle(s),
  lockedCandidates: (f, s) => f.findAllLockedCandidates(s),
  lc1: (f, s) => f.findAllLockedCandidates1(s),
  lc2: (f, s) => f.findAllLockedCandidates2(s),
  emptyRectangles: (f, s) => f.findAllEmptyRectangles(s),
  skyscrapers: (f, s) => f.findAllSkyScrapers(s),
  twoStringKites: (f, s) => f.findAllTwoStringKites(s),
  uniqueness: (f, s) => f.getAllUniqueness(s),
  wings: (f, s) => f.getAllWings(s),
  simpleColors: (f, s) => f.findAllSimpleColors(s),
  multiColors: (f, s) => f.findAllMultiColors(s),
  sueDeCoqs: (f, s) => f.getAllSueDeCoqs(s),
  templates: (f, s) => f.getAllTemplates(s),
};

function summarize(s: SolutionStep): GoldenStep {
  return {
    type: s.type,
    indices: s.indices,
    values: s.values,
    delete: s.candidatesToDelete.map((c) => [c.index, c.value] as [number, number]),
  };
}

describe('find all steps (golden data from HoDoKu 2.2.0)', () => {
  it('has states', () => {
    expect(states.length).toBeGreaterThan(30);
  });

  for (const [name, find] of Object.entries(IMPLEMENTED)) {
    it(`${name}: same steps in the same order`, () => {
      let steps = 0;
      for (const g of states) {
        const expected = g.all[name];
        if (typeof expected === 'string') continue; // the Java call failed
        const sudoku = new Sudoku2();
        sudoku.setSudoku(g.state);
        const finder = new SudokuStepFinder();
        finder.setSudoku(sudoku);
        const actual = find(finder, sudoku.clone()).map(summarize);
        expect(actual, `${name} in ${g.state}`).toEqual(expected);
        steps += expected.length;
      }
      console.log(`${name}: ${steps} steps compared`);
    });
  }
});

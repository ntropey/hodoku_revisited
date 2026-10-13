/*
 * "Find all steps": compares the lists of ALL steps of every technique with the original HoDoKu 2.2.0
 * (SudokuStepFinder.findAll... / getAll...) on several states of 30 puzzles: stuck after singles and
 * after a few harder steps. The states are read in the HoDoKu library format. Expected data comes from
 * `java Golden all` (tools/golden/Golden.java).
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { Sudoku2, SudokuSolver, SudokuStepFinder, type SolutionStep, type SolutionType } from '../src/index.js';

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

/**
 * Lists whose order is not compared. The comparators of the original for ALS, forcing chains/nets
 * and Kraken fish are not consistent orderings (e.g. they return 1 for "equal" index sums in both
 * directions), so the order of steps that rank equal depends on the details of the sort algorithm of
 * the Java runtime. The steps themselves must be the same.
 */
const UNORDERED = new Set(['alses', 'forcingChains', 'forcingNets', 'kraken']);

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
  chains: (f, s) => f.getAllChains(s),
  alses: (f, s) => f.getAllAlses(s, true, true, true),
  deathBlossoms: (f, s) => f.getAllDeathBlossoms(s),
  niceLoops: (f, s) => f.getAllNiceLoops(s),
  groupedNiceLoops: (f, s) => f.getAllGroupedNiceLoops(s),
  forcingChains: (f, s) => f.getAllForcingChains(s),
  forcingNets: (f, s) => f.getAllForcingNets(s),
  fishBasic: (f, s) => f.getAllFishes(s, 2, 4, 5, 2, -1, 0),
  fishFranken: (f, s) => f.getAllFishes(s, 2, 3, 5, 2, -1, 1),
  fishMutant: (f, s) => f.getAllFishes(s, 2, 3, 5, 2, -1, 2),
  kraken: (f, s) => f.getAllKrakenFishes(s, 2, 3, 2, 0, -1, 1),
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

/**
 * The Kraken lists are huge (36,000 steps) and take about 90 s; they are only compared with
 * GOLDEN_FULL=1 (they pass; see docs/PORT-PLAN.md).
 */
const FULL = process.env.GOLDEN_FULL === '1';

/** The order in which the original harness (tools/golden/Golden.java) calls the functions. */
const ORDER = [
  'fullHouses', 'nakedSingles', 'hiddenSingles', 'nakedXle', 'hiddenXle', 'lockedCandidates', 'lc1', 'lc2',
  'emptyRectangles', 'skyscrapers', 'twoStringKites', 'uniqueness', 'wings', 'simpleColors', 'multiColors', 'chains',
  'alses', 'deathBlossoms', 'sueDeCoqs', 'niceLoops', 'groupedNiceLoops', 'forcingChains', 'forcingNets', 'templates',
  'fishBasic', 'fishFranken', 'fishMutant', 'kraken',
];

describe('find all steps (golden data from HoDoKu 2.2.0)', () => {
  it('has states', () => {
    expect(states.length).toBeGreaterThan(30);
  });

  it('finds the same steps as the original for every technique', { timeout: 600_000 }, () => {
    // The original harness solves every puzzle with one solver: stuck after singles, then a few harder
    // steps, and it calls the find-all functions on every state. The fish search of the original keeps
    // arrays between searches and the Kraken search (which has fish with more cover units than base
    // units) reads stale entries from them, so its result depends on everything that ran before. To get
    // the same results the same sequence is replayed here, with one solver.
    const solver = new SudokuSolver();
    const compared: Record<string, number> = {};
    let replayed = 0;
    let i = 0;
    while (i < states.length) {
      const puzzle = states[i].puzzle;
      const group: State[] = [];
      while (i < states.length && states[i].puzzle === puzzle) group.push(states[i++]);
      const s = new Sudoku2();
      s.setSudoku(puzzle);
      solver.setSudoku(s);
      let k = 0;
      for (const g of group) {
        // advance to the next state like the harness: k harder steps (cumulative), singles in between
        for (;;) {
          let ok = true;
          for (let round = 0; round < 3 && ok; round++) {
            let st: SolutionStep | null;
            while ((st = solver.getHint(s, true)) !== null) solver.doStep(s, st);
            if (round < k) {
              st = solver.getHint(s, false);
              if (st === null || s.isSolved()) {
                ok = false;
                break;
              }
              solver.doStep(s, st);
            }
          }
          if (ok && !s.isSolved() && s.getSudoku('LIBRARY') === g.state) break;
          k++;
          if (k > 3) throw new Error(`cannot reproduce the state ${g.state}`);
        }
        replayed++;
        k++;
        for (const name of ORDER) {
          const find = IMPLEMENTED[name];
          const expected = g.all[name];
          if (!find || typeof expected === 'string') continue; // not ported, or the Java call failed
          if (name === 'kraken' && !FULL) continue;
          const copy = s.clone();
          let actual = find(solver.getStepFinder(), copy).map(summarize);
          let wanted = expected;
          if (UNORDERED.has(name)) {
            const key = (x: GoldenStep) => JSON.stringify(x);
            actual = actual.sort((a, b) => key(a).localeCompare(key(b)));
            wanted = [...expected].sort((a, b) => key(a).localeCompare(key(b)));
          }
          expect(actual, `${name} in ${g.state}`).toEqual(wanted);
          compared[name] = (compared[name] ?? 0) + expected.length;
        }
      }
    }
    console.log('find all steps compared:', JSON.stringify(compared));
    expect(replayed).toBe(states.length);
    expect(Object.keys(compared).length).toBe(Object.keys(IMPLEMENTED).length - (FULL ? 0 : 1));
  });
});

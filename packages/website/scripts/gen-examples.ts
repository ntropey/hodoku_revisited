/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Finds a worked example for every technique guide: the solver is run over a corpus of puzzles
 * and the simplest step of each wanted type is recorded, together with the board before the step.
 * Because the examples come from the solver itself, the diagrams are correct by construction.
 *   pnpm --filter @hodoku/website gen-examples
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOLUTION_TYPE_INFO, Sudoku2, SudokuSolver, describeStep, type SolutionType, type StepMarks } from '@hodoku/core';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');

/** guide slug -> solution types to show (one example each) */
const WANTED: Record<string, SolutionType[]> = {
  'full-house': ['FULL_HOUSE'],
  'naked-single': ['NAKED_SINGLE'],
  'hidden-single': ['HIDDEN_SINGLE'],
  'locked-candidates': ['LOCKED_CANDIDATES_1', 'LOCKED_CANDIDATES_2'],
  'naked-subsets': ['NAKED_PAIR', 'NAKED_TRIPLE'],
  'hidden-subsets': ['HIDDEN_PAIR', 'HIDDEN_TRIPLE'],
  'x-wing': ['X_WING'],
  swordfish: ['SWORDFISH'],
  skyscraper: ['SKYSCRAPER'],
  'two-string-kite': ['TWO_STRING_KITE'],
  'empty-rectangle': ['EMPTY_RECTANGLE'],
  'xy-wing': ['XY_WING'],
  'xyz-wing': ['XYZ_WING'],
  'w-wing': ['W_WING'],
  'simple-colors': ['SIMPLE_COLORS_TRAP', 'SIMPLE_COLORS_WRAP'],
  'unique-rectangle': ['UNIQUENESS_1'],
  'xy-chain': ['XY_CHAIN', 'REMOTE_PAIR'],
  'als-xz': ['ALS_XZ'],
  'nice-loops': ['CONTINUOUS_NICE_LOOP', 'DISCONTINUOUS_NICE_LOOP', 'AIC'],
  'forcing-chains': ['FORCING_CHAIN_CONTRADICTION'],
};

interface Example extends StepMarks {
  slug: string;
  type: SolutionType;
  name: string;
  puzzle: string;
  /** values (0 = empty) and candidate bitmasks (bit d = digit d) before the step */
  values: number[];
  cands: number[];
  score: number;
}

const describe = describeStep;

// ---- corpus
const corpus: string[] = [];
for (const f of ['golden.jsonl', 'golden-ts.jsonl', 'golden-hard.jsonl']) {
  for (const line of readFileSync(join(root, 'packages/core/test/fixtures', f), 'utf8').split('\n').filter(Boolean)) {
    corpus.push(JSON.parse(line).puzzle as string);
  }
}
const bank = JSON.parse(readFileSync(join(root, 'packages/app/src/bank/bank.json'), 'utf8')) as Record<string, string[]>;
for (const list of Object.values(bank)) corpus.push(...list);
const puzzles = [...new Set(corpus)];

const wantedTypes = new Set<SolutionType>(Object.values(WANTED).flat());
const best = new Map<SolutionType, Example>();
const slugOf = (t: SolutionType) => Object.entries(WANTED).find(([, ts]) => ts.includes(t))![0];

const solver = new SudokuSolver();
let n = 0;
for (const puzzle of puzzles) {
  const s = new Sudoku2();
  s.setSudoku(puzzle);
  solver.setSudoku(s);
  for (let guard = 0; guard < 200; guard++) {
    const before = s.clone();
    const step = solver.step();
    if (step === null || step.type === 'GIVE_UP' || step.type === 'BRUTE_FORCE') break;
    if (!wantedTypes.has(step.type)) continue;
    if (step.candidatesToDelete.length === 0 && !['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE'].includes(step.type)) continue;
    const d = describe(step, before);
    const size = d.key.length + d.fins.length + d.colors.length + d.chains.reduce((a, c) => a + c.length, 0);
    const score = size * 3 + d.elim.length * 2;
    const old = best.get(step.type);
    if (old && old.score <= score) continue;
    best.set(step.type, {
      slug: slugOf(step.type),
      type: step.type,
      name: SOLUTION_TYPE_INFO[step.type].stepName,
      puzzle,
      values: Array.from(before.values),
      cands: Array.from({ length: 81 }, (_, i) => {
        let mask = 0;
        for (let d = 1; d <= 9; d++) if (before.isCandidate(i, d)) mask |= 1 << d;
        return mask;
      }),
      ...d,
      score,
    });
  }
  if (++n % 200 === 0) console.log(`${n}/${puzzles.length} puzzles, ${best.size}/${wantedTypes.size} types`);
}

// every example is checked against the real solution of its puzzle
for (const e of best.values()) {
  const s = new Sudoku2();
  s.setSudoku(e.puzzle);
  const check = new SudokuSolver();
  check.setSudoku(s);
  check.solve();
  if (!s.isSolved()) throw new Error(`cannot solve ${e.puzzle}`);
  for (const m of e.elim) if (s.values[m.cell] === m.digit) throw new Error(`${e.type}: removes the solution digit in ${e.puzzle}`);
  for (const m of e.place) if (s.values[m.cell] !== m.digit) throw new Error(`${e.type}: wrong placement in ${e.puzzle}`);
}

const missing = [...wantedTypes].filter((t) => !best.has(t));
console.log('missing:', missing.join(', ') || 'none');
const out = Object.entries(WANTED).flatMap(([, types]) => types.filter((t) => best.has(t)).map((t) => best.get(t)!));
writeFileSync(join(here, '..', 'src', 'examples.json'), JSON.stringify(out) + '\n');
for (const e of out) console.log(e.slug, e.type, 'key', e.key.length, 'elim', e.elim.length, 'chains', e.chains.map((c) => c.length).join('/'), 'score', e.score);

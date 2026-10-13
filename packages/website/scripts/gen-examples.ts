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
import { SOLUTION_TYPE_INFO, Sudoku2, SudokuSolver, tables, type SolutionStep, type SolutionType } from '@hodoku/core';

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

interface Mark {
  cell: number;
  digit: number;
  /** chains: the flag the solver keeps for this node (see Chain.isStrong) */
  strong?: boolean;
}
interface Example {
  slug: string;
  type: SolutionType;
  name: string;
  puzzle: string;
  /** values (0 = empty) and candidate bitmasks (bit d = digit d) before the step */
  values: number[];
  cands: number[];
  /** candidates that form the pattern */
  key: Mark[];
  /** fins / endo fins / second group of the pattern */
  fins: Mark[];
  /** candidates that can be removed */
  elim: Mark[];
  /** digits that can be placed */
  place: Mark[];
  /** colors for coloring steps and ALS: cell -> color index */
  colors: { cell: number; digit: number; color: number }[];
  /** cells to tint (base units of fish, ALS cells, the unit of a hidden single, ...) */
  tint: { cells: number[]; tone: 'a' | 'b' }[];
  /** chains: ordered nodes */
  chains: Mark[][];
  digits: number[];
  score: number;
}

const UNITS = [...tables.LINES, ...tables.COLS, ...tables.BLOCKS];

function unitCells(type: number, n: number): number[] {
  const list = type === tables.LINE ? tables.LINES : type === tables.COL ? tables.COLS : tables.BLOCKS;
  return [...list[n - 1]];
}

function describe(step: SolutionStep, before: Sudoku2): Omit<Example, 'slug' | 'type' | 'name' | 'puzzle' | 'values' | 'cands' | 'score'> {
  const key: Mark[] = [];
  const fins: Mark[] = [];
  const colors: Example['colors'] = [];
  const tint: Example['tint'] = [];
  const chains: Mark[][] = [];
  const place: Mark[] = [];
  const elim = step.candidatesToDelete.map((c) => ({ cell: c.index, digit: c.value }));
  const digits = [...new Set(step.values)];
  const has = (cell: number, d: number) => before.isCandidate(cell, d);

  const t = step.type;
  if (t === 'FULL_HOUSE' || t === 'NAKED_SINGLE' || t === 'HIDDEN_SINGLE') {
    place.push({ cell: step.indices[0], digit: step.values[0] });
    if (t !== 'NAKED_SINGLE') {
      const cell = step.indices[0];
      const d = step.values[0];
      for (const unit of UNITS.filter((u) => u.includes(cell))) {
        const free = unit.filter((c) => before.values[c] === 0);
        if ((t === 'FULL_HOUSE' && free.length === 1) || (t === 'HIDDEN_SINGLE' && free.filter((c) => has(c, d)).length === 1)) {
          tint.push({ cells: [...unit], tone: 'a' });
          break;
        }
      }
    }
  } else if (step.chains.length > 0) {
    for (const chain of step.chains) {
      const nodes: Mark[] = [];
      for (let i = chain.start; i <= chain.end; i++) nodes.push({ cell: chain.getCellIndex(i), digit: chain.getCandidate(i), strong: chain.isStrong(i) });
      chains.push(nodes);
      for (const n of nodes) key.push(n);
    }
  } else if (step.baseEntities.length > 0) {
    const d = step.values[0];
    for (const e of step.baseEntities) {
      const cells = unitCells(e.type, e.number);
      tint.push({ cells, tone: 'a' });
      for (const c of cells) if (has(c, d)) key.push({ cell: c, digit: d });
    }
    for (const e of step.coverEntities) tint.push({ cells: unitCells(e.type, e.number), tone: 'b' });
    for (const f of step.fins) fins.push({ cell: f.index, digit: f.value });
    for (const f of step.endoFins) fins.push({ cell: f.index, digit: f.value });
  } else if (step.alses.length > 0) {
    step.alses.forEach((als, i) => {
      tint.push({ cells: als.indices, tone: i % 2 === 0 ? 'a' : 'b' });
      for (const c of als.indices) for (let d = 1; d <= 9; d++) if ((als.candidates & (1 << (d - 1))) !== 0 && has(c, d)) colors.push({ cell: c, digit: d, color: i });
    });
    for (const rc of step.restrictedCommons) {
      for (const [alsIndex, digit] of [[rc.als1, rc.cand1], [rc.als2, rc.cand1], [rc.als1, rc.cand2], [rc.als2, rc.cand2]] as const) {
        if (digit === 0) continue;
        for (const c of step.alses[alsIndex]?.indices ?? []) if (has(c, digit)) key.push({ cell: c, digit });
      }
    }
  } else if (step.colorCandidates.size > 0) {
    for (const [cell, color] of step.colorCandidates) colors.push({ cell, digit: step.values[0], color });
  } else {
    // subsets, locked candidates, wings, kites, skyscrapers, rectangles
    const ds = step.values.length > 0 ? step.values : [];
    for (const c of step.indices) {
      for (const d of ds) if (has(c, d)) key.push({ cell: c, digit: d });
      if (ds.length === 0) for (let d = 1; d <= 9; d++) if (has(c, d)) key.push({ cell: c, digit: d });
    }
    for (const f of step.fins) fins.push({ cell: f.index, digit: f.value });
    for (const f of step.endoFins) fins.push({ cell: f.index, digit: f.value });
  }
  return { key, fins, elim, place, colors, tint, chains, digits };
}

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

/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE.
 *
 * New code (not part of the original HoDoKu): turns a solution step into plain data that a user
 * interface can draw, for hints in the app and for the diagrams on the website.
 */
import { Sudoku2 } from './sudoku2.js';
import type { SolutionStep } from './solutionStep.js';
import { BLOCKS, COLS, LINES, LINE, COL } from './tables.js';

export interface StepMark {
  cell: number;
  digit: number;
  /** chains: the flag the solver keeps for this node; a link is strong if the node it leads to has this set */
  strong?: boolean;
}

export interface StepMarks {
  /** candidates that form the pattern */
  key: StepMark[];
  /** fins, endo fins, or the cells that connect the pattern (kites, empty rectangles) */
  fins: StepMark[];
  /** candidates that can be removed */
  elim: StepMark[];
  /** digits that can be placed */
  place: StepMark[];
  /** colors of coloring steps and almost locked sets: one entry per colored candidate */
  colors: { cell: number; digit: number; color: number }[];
  /** cells to tint: base units of fish (a), cover units (b), almost locked sets, the unit of a single */
  tint: { cells: number[]; tone: 'a' | 'b' }[];
  /** chains, as ordered nodes */
  chains: StepMark[][];
  /** the digits of the step */
  digits: number[];
}

const ALL = [...LINES, ...COLS, ...BLOCKS];

function unitCells(type: number, n: number): number[] {
  const list = type === LINE ? LINES : type === COL ? COLS : BLOCKS;
  return [...list[n - 1]];
}

/** Describe `step`, found in the state `before` (a clone taken before the step was applied). */
export function describeStep(step: SolutionStep, before: Sudoku2): StepMarks {
  const key: StepMark[] = [];
  const fins: StepMark[] = [];
  const colors: StepMarks['colors'] = [];
  const tint: StepMarks['tint'] = [];
  const chains: StepMark[][] = [];
  const place: StepMark[] = [];
  const elim = step.candidatesToDelete.map((c) => ({ cell: c.index, digit: c.value }));
  const digits = [...new Set(step.values)];
  const has = (cell: number, d: number) => before.isCandidate(cell, d);
  const t = step.type;

  if (t === 'BRUTE_FORCE') {
    step.indices.forEach((cell, i) => place.push({ cell, digit: step.values[i] ?? step.values[0] }));
  } else if (t === 'FULL_HOUSE' || t === 'NAKED_SINGLE' || t === 'HIDDEN_SINGLE') {
    const cell = step.indices[0];
    const d = step.values[0];
    place.push({ cell, digit: d });
    if (t !== 'NAKED_SINGLE') {
      for (const unit of ALL.filter((u) => u.includes(cell))) {
        const free = unit.filter((c) => before.values[c] === 0);
        if ((t === 'FULL_HOUSE' && free.length === 1) || (t === 'HIDDEN_SINGLE' && free.filter((c) => has(c, d)).length === 1)) {
          tint.push({ cells: [...unit], tone: 'a' });
          break;
        }
      }
    }
  } else if (step.chains.length > 0) {
    for (const chain of step.chains) {
      const nodes: StepMark[] = [];
      for (let i = chain.start; i <= chain.end; i++) {
        nodes.push({ cell: chain.getCellIndex(i), digit: chain.getCandidate(i), strong: chain.isStrong(i) });
      }
      chains.push(nodes);
      key.push(...nodes);
    }
  } else if (step.baseEntities.length > 0) {
    const d = step.values[0];
    for (const e of step.baseEntities) {
      const cells = unitCells(e.type, e.number);
      tint.push({ cells, tone: 'a' });
      for (const c of cells) if (has(c, d)) key.push({ cell: c, digit: d });
    }
    for (const e of step.coverEntities) tint.push({ cells: unitCells(e.type, e.number), tone: 'b' });
    for (const f of [...step.fins, ...step.endoFins]) fins.push({ cell: f.index, digit: f.value });
  } else if (step.alses.length > 0) {
    step.alses.forEach((als, i) => {
      tint.push({ cells: als.indices, tone: i % 2 === 0 ? 'a' : 'b' });
      for (const c of als.indices) {
        for (let d = 1; d <= 9; d++) {
          if ((als.candidates & (1 << (d - 1))) !== 0 && has(c, d)) colors.push({ cell: c, digit: d, color: i });
        }
      }
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
    for (const c of step.indices) {
      if (step.values.length === 0) {
        for (let d = 1; d <= 9; d++) if (has(c, d)) key.push({ cell: c, digit: d });
      } else {
        for (const d of step.values) if (has(c, d)) key.push({ cell: c, digit: d });
      }
    }
    for (const f of [...step.fins, ...step.endoFins]) fins.push({ cell: f.index, digit: f.value });
  }
  return { key, fins, elim, place, colors, tint, chains, digits };
}

export const cellName = (i: number): string => `r${Math.floor(i / 9) + 1}c${(i % 9) + 1}`;

/** A chain in the usual notation: `3r1c1 = 3r1c5 - 3r2c5 = ...` (`=` strong link, `-` weak link). */
export function chainNotation(nodes: readonly StepMark[]): string {
  let out = '';
  nodes.forEach((n, i) => {
    if (i > 0) out += n.strong ? ' = ' : ' - ';
    out += `${n.digit}${cellName(n.cell)}`;
  });
  return out;
}

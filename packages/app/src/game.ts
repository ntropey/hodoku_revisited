/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Game state: pure functions, no React, no DOM.
 */
import { tables } from '@hodoku/core';
import type { PathEntry, PuzzleInfo } from './protocol';

const PEERS: readonly (readonly number[])[] = tables.BUDDIES.map((b) => [...b.values()]);
export const ALL_CANDS = 0b1111111110;

interface Snapshot {
  values: number[];
  cands: number[];
  notes: number[];
  /** cell/candidate colours (missing in older saves) */
  cellColors?: number[];
  candColors?: number[];
}

export interface GameState {
  /** 81 chars, the original puzzle */
  givens: string;
  values: number[];
  /** candidate bitmasks per cell, bit d set = digit d is still possible */
  cands: number[];
  /** the player's own pencil marks (bit d = digit d); separate from `cands`, which the solver uses. Missing in older saves. */
  notes?: number[];
  /** the player's own colours: one palette index per cell (0 = none). Missing in older saves. */
  cellColors?: number[];
  /** the player's own colours: one palette index per cell/digit (index `cell * 9 + digit - 1`, 0 = none). */
  candColors?: number[];
  solution: number[];
  level: number;
  score: number;
  /** techniques of the solve path (missing in games saved by older versions) */
  path?: PathEntry[];
  /** hints applied (missing in older saves) */
  hints?: number;
  past: Snapshot[];
  future: Snapshot[];
}

/** All candidates that do not conflict with the values already placed. */
export function validCands(values: readonly number[]): number[] {
  return values.map((v, i) => {
    if (v !== 0) return 0;
    let mask = ALL_CANDS;
    for (const p of PEERS[i]) if (values[p] !== 0) mask &= ~(1 << values[p]);
    return mask;
  });
}

export function newGame(info: PuzzleInfo): GameState {
  const values = [...info.puzzle].map((c) => (c === '.' || c === '0' ? 0 : Number(c)));
  return {
    givens: info.puzzle,
    values,
    cands: validCands(values),
    solution: info.solution,
    level: info.level,
    score: info.score,
    path: info.path,
    past: [],
    future: [],
  };
}

export const notesOf = (g: GameState): number[] => g.notes ?? new Array<number>(81).fill(0);
export const isGiven = (g: GameState, i: number): boolean => g.givens[i] !== '.' && g.givens[i] !== '0';
export const isSolved = (g: GameState): boolean => g.values.every((v, i) => v === g.solution[i]);

function snapshot(g: GameState): Snapshot {
  return {
    values: g.values.slice(),
    cands: g.cands.slice(),
    notes: notesOf(g).slice(),
    cellColors: g.cellColors?.slice(),
    candColors: g.candColors?.slice(),
  };
}

function push(g: GameState, values: number[], cands: number[], notes: number[] = notesOf(g)): GameState {
  // spreading `g` also carries the colours over, so a normal move never drops them
  return { ...g, values, cands, notes, past: [...g.past, snapshot(g)].slice(-200), future: [] };
}

/** A change that touches only the colours; values and candidates are kept as they are. */
function pushState(g: GameState, patch: Partial<GameState>): GameState {
  return { ...g, ...patch, past: [...g.past, snapshot(g)].slice(-200), future: [] };
}

const candIndex = (cell: number, digit: number) => cell * 9 + (digit - 1);

/** Colour a cell (0 clears it); the colour is an index into the app's palette. */
export function paintCell(g: GameState, i: number, color: number): GameState {
  if ((g.cellColors?.[i] ?? 0) === color) return g;
  const cellColors = g.cellColors ? g.cellColors.slice() : new Array<number>(81).fill(0);
  cellColors[i] = color;
  return pushState(g, { cellColors });
}

/** Colour one candidate of a cell (0 clears it). */
export function paintCand(g: GameState, i: number, d: number, color: number): GameState {
  const idx = candIndex(i, d);
  if ((g.candColors?.[idx] ?? 0) === color) return g;
  const candColors = g.candColors ? g.candColors.slice() : new Array<number>(81 * 9).fill(0);
  candColors[idx] = color;
  return pushState(g, { candColors });
}

/** Remove every colour from the board. */
export function clearColors(g: GameState): GameState {
  return g.cellColors || g.candColors ? pushState(g, { cellColors: undefined, candColors: undefined }) : g;
}

/** The colour index of a cell (0 = none). */
export const cellColorAt = (g: GameState, i: number): number => g.cellColors?.[i] ?? 0;
/** The colour index of a candidate (0 = none). */
export const candColorAt = (g: GameState, i: number, d: number): number => g.candColors?.[candIndex(i, d)] ?? 0;

/** Place a digit. Removes the digit from the candidates of all peers. */
export function setValue(g: GameState, i: number, d: number): GameState {
  if (isGiven(g, i) || g.values[i] === d) return g;
  const values = g.values.slice();
  const cands = g.cands.slice();
  values[i] = d;
  cands[i] = 0;
  const notes = notesOf(g).slice();
  notes[i] = 0;
  for (const p of PEERS[i]) {
    cands[p] &= ~(1 << d);
    notes[p] &= ~(1 << d);
  }
  return push(g, values, cands, notes);
}

/** Remove a placed digit. Candidates of the cell and its peers are recalculated. */
export function erase(g: GameState, i: number): GameState {
  if (isGiven(g, i)) return g;
  if (g.values[i] === 0) return g.cands[i] === 0 ? g : push(g, g.values.slice(), withCands(g.cands, i, 0));
  const values = g.values.slice();
  values[i] = 0;
  const valid = validCands(values);
  const cands = g.cands.slice();
  for (const c of [i, ...PEERS[i]]) if (values[c] === 0) cands[c] = c === i ? valid[c] : cands[c] | (valid[c] & (1 << g.values[i]));
  return push(g, values, cands);
}

function withCands(cands: number[], i: number, mask: number): number[] {
  const out = cands.slice();
  out[i] = mask;
  return out;
}

/** Turn one candidate on or off (pencil marks). */
export function toggleCand(g: GameState, i: number, d: number): GameState {
  if (g.values[i] !== 0) return g;
  return push(g, g.values.slice(), withCands(g.cands, i, g.cands[i] ^ (1 << d)));
}

/** Turn one pencil mark on or off. */
export function toggleNote(g: GameState, i: number, d: number): GameState {
  if (g.values[i] !== 0) return g;
  const notes = notesOf(g).slice();
  notes[i] ^= 1 << d;
  return push(g, g.values.slice(), g.cands.slice(), notes);
}

/** Remove the pencil marks of one cell. */
export function clearNotesAt(g: GameState, i: number): GameState {
  if (notesOf(g)[i] === 0) return g;
  const notes = notesOf(g).slice();
  notes[i] = 0;
  return push(g, g.values.slice(), g.cands.slice(), notes);
}

/** Remove all pencil marks. */
export function clearNotes(g: GameState): GameState {
  return notesOf(g).every((n) => n === 0) ? g : push(g, g.values.slice(), g.cands.slice(), new Array<number>(81).fill(0));
}

/** Remove candidates (used when a hint is applied). */
export function removeCands(g: GameState, list: { cell: number; digit: number }[]): GameState {
  const cands = g.cands.slice();
  for (const { cell, digit } of list) cands[cell] &= ~(1 << digit);
  return push(g, g.values.slice(), cands);
}

/** Reset all candidates to what the placed values allow. */
export function fillCands(g: GameState): GameState {
  return push(g, g.values.slice(), validCands(g.values));
}

export function undo(g: GameState): GameState {
  const prev = g.past[g.past.length - 1];
  if (!prev) return g;
  return { ...g, ...prev, past: g.past.slice(0, -1), future: [snapshot(g), ...g.future] };
}

export function redo(g: GameState): GameState {
  const next = g.future[0];
  if (!next) return g;
  return { ...g, ...next, past: [...g.past, snapshot(g)], future: g.future.slice(1) };
}

/** Cells whose value contradicts the solution. */
export function wrongCells(g: GameState): number[] {
  const out: number[] = [];
  g.values.forEach((v, i) => {
    if (v !== 0 && v !== g.solution[i]) out.push(i);
  });
  return out;
}

/** How many times each digit is still needed (9 minus correctly placed). */
export function remaining(g: GameState): number[] {
  const left = new Array<number>(10).fill(9);
  left[0] = 0;
  // only a placement that matches the solution counts. A wrong value would otherwise complete a digit
  // while its correct cell is still empty, and the DigitPad would disable the key for it.
  g.values.forEach((v, i) => {
    if (v !== 0 && v === g.solution[i]) left[v]--;
  });
  return left;
}

/** The one empty cell of a unit and the single digit missing from it, or null if nothing is forced. */
function lastDigitOf(unit: readonly number[], values: readonly number[]): { cell: number; digit: number } | null {
  let empty = -1;
  let seen = 0;
  for (const c of unit) {
    const v = values[c];
    if (v === 0) {
      if (empty !== -1) return null; // more than one empty cell
      empty = c;
    } else seen |= 1 << v;
  }
  if (empty === -1) return null; // the unit is full
  let missing = 0;
  let digit = 0;
  for (let d = 1; d <= 9; d++)
    if ((seen & (1 << d)) === 0) {
      missing++;
      digit = d;
    }
  // if the unit already holds a duplicate, more than one digit is missing: nothing is forced
  return missing === 1 ? { cell: empty, digit } : null;
}

/**
 * Fill every cell that is the last empty one of a row, column or box ("auto-fill last digit").
 * Each fill goes through `setValue`, so it is an ordinary, undoable move; repeats until nothing is forced.
 */
export function autoFillLastDigit(g: GameState): GameState {
  let next = g;
  for (;;) {
    let filled = false;
    for (const unit of tables.ALL_UNITS) {
      const forced = lastDigitOf(unit, next.values);
      if (forced) {
        next = setValue(next, forced.cell, forced.digit);
        filled = true;
      }
    }
    if (!filled) return next;
  }
}

/** The givens of a state as values (0 where the given is `.` or `0`). */
function givensValues(g: GameState): number[] {
  return [...g.givens].map((c) => (c === '.' || c === '0' ? 0 : Number(c)));
}

/**
 * Start the same puzzle again: your values, notes, colours and hint counter back to the start.
 * The givens, solution, level, score, path and bank index are kept. Like the original's
 * "Restart Game", the undo history is dropped, so Undo/Redo does not reach across the restart.
 * Returns `g` unchanged when the board is already at the start.
 */
export function restart(g: GameState): GameState {
  const values = givensValues(g);
  const atStart =
    values.every((v, i) => v === g.values[i]) &&
    notesOf(g).every((n) => n === 0) &&
    !g.cellColors &&
    !g.candColors &&
    (g.hints ?? 0) === 0;
  if (atStart) return g;
  return {
    ...g,
    values,
    cands: validCands(values),
    notes: undefined,
    cellColors: undefined,
    candColors: undefined,
    hints: 0,
    past: [],
    future: [],
  };
}

/** Make every placed digit a given: it can no longer be erased, and it prints as a given. */
export function setGivens(g: GameState): GameState {
  const givens = g.values.map((v) => (v === 0 ? '.' : String(v))).join('');
  return givens === g.givens ? g : pushState(g, { givens });
}

/**
 * Every hidden single right now: a candidate that is the only one for its digit in a row, column or box.
 * `blocked` is optional; a `true` entry means that cell is skipped (useful for callers that want to
 * ignore cells, e.g. a selected one). Cells that already hold a value are never reported, and the same
 * cell/digit is not reported twice even when it is hidden in two units at once.
 */
export function hiddenSingles(values: readonly number[], cands: readonly number[], blocked?: readonly boolean[]): { cell: number; digit: number }[] {
  const out: { cell: number; digit: number }[] = [];
  const seen = new Set<number>();
  for (const unit of tables.ALL_UNITS) {
    for (let d = 1; d <= 9; d++) {
      let found = -1;
      let count = 0;
      for (const c of unit) {
        if (values[c] !== 0 || blocked?.[c]) continue;
        if ((cands[c] & (1 << d)) !== 0) {
          found = c;
          if (++count > 1) break;
        }
      }
      if (count === 1 && !seen.has(found * 10 + d)) {
        seen.add(found * 10 + d);
        out.push({ cell: found, digit: d });
      }
    }
  }
  return out;
}

/**
 * Place every hidden single at once, as one undoable move. Each placement clears the candidates of the
 * placed cell and of its peers, exactly as `setValue` does. Returns `g` when there is no hidden single.
 */
export function fillHiddenSingles(g: GameState): GameState {
  const singles = hiddenSingles(g.values, g.cands);
  if (singles.length === 0) return g;
  const values = g.values.slice();
  const cands = g.cands.slice();
  const notes = notesOf(g).slice();
  for (const { cell, digit } of singles) {
    values[cell] = digit;
    cands[cell] = 0;
    notes[cell] = 0;
    for (const p of PEERS[cell]) {
      cands[p] &= ~(1 << digit);
      notes[p] &= ~(1 << digit);
    }
  }
  return push(g, values, cands, notes);
}

/** Cells where your candidate marks differ from what the placed values allow (Options → Show deviations). */
export function deviations(g: GameState): number[] {
  const valid = validCands(g.values);
  const out: number[] = [];
  g.values.forEach((v, i) => {
    if (v === 0 && g.cands[i] !== valid[i]) out.push(i);
  });
  return out;
}

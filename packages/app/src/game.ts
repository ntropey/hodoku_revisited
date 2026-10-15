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
}

export interface GameState {
  /** 81 chars, the original puzzle */
  givens: string;
  values: number[];
  /** candidate bitmasks per cell, bit d set = digit d is still possible */
  cands: number[];
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

export const isGiven = (g: GameState, i: number): boolean => g.givens[i] !== '.' && g.givens[i] !== '0';
export const isSolved = (g: GameState): boolean => g.values.every((v, i) => v === g.solution[i]);

function snapshot(g: GameState): Snapshot {
  return { values: g.values.slice(), cands: g.cands.slice() };
}

function push(g: GameState, values: number[], cands: number[]): GameState {
  return { ...g, values, cands, past: [...g.past, snapshot(g)].slice(-200), future: [] };
}

/** Place a digit. Removes the digit from the candidates of all peers. */
export function setValue(g: GameState, i: number, d: number): GameState {
  if (isGiven(g, i) || g.values[i] === d) return g;
  const values = g.values.slice();
  const cands = g.cands.slice();
  values[i] = d;
  cands[i] = 0;
  for (const p of PEERS[i]) cands[p] &= ~(1 << d);
  return push(g, values, cands);
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

/** How many times each digit is still needed (9 minus placed). */
export function remaining(g: GameState): number[] {
  const left = new Array<number>(10).fill(9);
  left[0] = 0;
  for (const v of g.values) if (v !== 0) left[v]--;
  return left;
}

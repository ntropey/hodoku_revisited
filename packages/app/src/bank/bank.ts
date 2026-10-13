/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Puzzle bank: puzzles generated offline with this project's own generator (scripts/gen-bank.ts),
 * grouped by difficulty level. Each pick is disguised by a random isomorphism, so the same
 * entry rarely looks the same twice.
 */
import data from './bank.json';

export type Rng = () => number;

const BANK = data as Record<string, string[]>;

export function bankSize(level: number): number {
  return BANK[String(level)]?.length ?? 0;
}

export function bankPuzzle(level: number, index: number): string {
  return BANK[String(level)][index];
}

/** A random index of the level's puzzles, avoiding `seen` while any unseen puzzle is left. */
export function pickBankIndex(level: number, seen: readonly number[], rng: Rng): number | null {
  const n = bankSize(level);
  if (n === 0) return null;
  const seenSet = new Set(seen);
  const free: number[] = [];
  for (let i = 0; i < n; i++) if (!seenSet.has(i)) free.push(i);
  const pool = free.length > 0 ? free : Array.from({ length: n }, (_, i) => i);
  return pool[Math.floor(rng() * pool.length)];
}

function shuffle<T>(a: T[], rng: Rng): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A line permutation that keeps the band/stack structure: bands shuffled, and lines within each band shuffled. */
function linePermutation(rng: Rng): number[] {
  const bands = shuffle([0, 1, 2], rng);
  return bands.flatMap((b) => shuffle([0, 1, 2], rng).map((k) => b * 3 + k));
}

/**
 * Relabel digits, permute rows (within bands and the bands themselves), columns (same) and
 * optionally transpose. The result has the same structure, so it has one solution as well.
 */
export function isomorph(puzzle: string, rng: Rng): string {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  const rows = linePermutation(rng);
  const cols = linePermutation(rng);
  const transpose = rng() < 0.5;
  let out = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const [sr, sc] = transpose ? [cols[c], rows[r]] : [rows[r], cols[c]];
      const ch = puzzle[sr * 9 + sc];
      out += ch === '.' || ch === '0' ? '.' : String(digits[Number(ch) - 1]);
    }
  }
  return out;
}

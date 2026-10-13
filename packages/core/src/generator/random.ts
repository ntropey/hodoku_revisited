/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE.
 */

/** A source of random numbers in [0, 1), like Math.random. */
export type Rng = () => number;

/** A small seedable generator (mulberry32) so that puzzles can be reproduced in tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random integer in [0, max). */
export function nextInt(rng: Rng, max: number): number {
  return Math.floor(rng() * max);
}

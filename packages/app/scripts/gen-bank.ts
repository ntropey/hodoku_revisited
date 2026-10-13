/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Generates puzzles for the puzzle bank with the engine's own generator.
 *   node scripts/gen-bank.mjs <level> <count> <seed> <out.jsonl> [maxTries]
 * (build the .mjs with `pnpm --filter @hodoku/app gen-bank:build`). Puzzles are original, made by this project.
 */
import { appendFileSync } from 'node:fs';
import { generatePuzzle, seededRng } from '@hodoku/core';

const [levelArg, countArg, seedArg, out, triesArg] = process.argv.slice(2);
const level = Number(levelArg);
const count = Number(countArg);
const rng = seededRng(Number(seedArg));
const maxTries = triesArg ? Number(triesArg) : 20000;
let made = 0;
const start = Date.now();
while (made < count) {
  const p = generatePuzzle(level, { rng, maxTries });
  if (p === null) {
    console.log(`level ${level}: no puzzle within ${maxTries} tries`);
    continue;
  }
  appendFileSync(out, JSON.stringify({ p: p.puzzle, l: p.level, s: p.score }) + '\n');
  made++;
  console.log(`level ${level}: ${made}/${count} (${((Date.now() - start) / 1000).toFixed(0)}s)`);
}

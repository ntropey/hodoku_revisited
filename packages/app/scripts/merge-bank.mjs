// Merge the .jsonl files written by gen-bank into src/bank/bank.json: { "<level>": ["puzzle", ...] }.
// usage: node scripts/merge-bank.mjs <dir with .jsonl files>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = process.argv[2];
const bank = {};
const seen = new Set();
for (const f of readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()) {
  for (const line of readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean)) {
    const { p, l } = JSON.parse(line);
    if (seen.has(p) || !/^[.1-9]{81}$/.test(p)) continue;
    seen.add(p);
    (bank[l] ??= []).push(p);
  }
}
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'bank', 'bank.json');
writeFileSync(out, JSON.stringify(bank) + '\n');
console.log(Object.entries(bank).map(([l, a]) => `level ${l}: ${a.length}`).join(', '));

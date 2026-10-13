#!/usr/bin/env python3
"""Pick a compact golden corpus from a large pool solved by the original HoDoKu.

Usage: python3 select.py pool-solved.jsonl base-golden.jsonl out.jsonl

Keeps, for every technique that occurs in the pool, the 6 puzzles with the fewest
steps that use it, plus 100 random ordinary puzzles from the base file.
"""
import collections, json, random, sys

pool, base, out = sys.argv[1:4]
random.seed(1)
rows, by_type = [], collections.defaultdict(list)
for ln, line in enumerate(open(pool)):
    g = json.loads(line)
    rows.append(line)
    for t in set(s["type"] for s in g["steps"]):
        by_type[t].append((len(line), ln))
chosen = set()
for lst in by_type.values():
    lst.sort()
    chosen.update(ln for _, ln in lst[:6])
result = [rows[i] for i in sorted(chosen)]
seen = set(json.loads(l)["puzzle"] for l in result)
base_rows = open(base).readlines()
for i in random.sample(range(len(base_rows)), 100):
    g = json.loads(base_rows[i])
    if g["puzzle"] not in seen:
        result.append(base_rows[i])
        seen.add(g["puzzle"])
open(out, "w").writelines(result)
print(len(result), "puzzles")

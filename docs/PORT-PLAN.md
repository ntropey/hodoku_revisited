# Port plan

Source: HoDoKu 2.2.0 (78 Java files). Sizes: `solver` 22 files / ~15.9k lines,
`generator` 5 / ~1.6k, `sudoku` 71 / ~42k (mostly Swing UI, which we replace).

## Architecture

```
packages/
  core/      pure TypeScript engine, no DOM, no Node APIs. Runs in Electron and in the browser.
  app/       Electron + React + Vite desktop app (Windows installer via electron-builder)
  website/   static site: docs, downloads, in-browser demo using packages/core
```

Monorepo with pnpm workspaces, TypeScript strict mode, Vitest for tests.

## Core module map

| Java | TypeScript module | Notes |
|---|---|---|
| `sudoku/Sudoku2`, `SudokuSet`, `SudokuSetBase`, `SolutionStep`, `Candidate`, `Chain` | `core/model/*` | Bitmask-heavy. Java `long` bitsets need `BigInt` or paired 32-bit ints. Use the latter for speed. |
| `solver/SimpleSolver` | `core/solver/simple.ts` | Singles, locked candidates, subsets. Port first. |
| `solver/SingleDigitPatternSolver`, `ColoringSolver`, `WingSolver`, `UniquenessSolver`, `MiscellaneousSolver` | `core/solver/*` | |
| `solver/FishSolver` | `core/solver/fish.ts` | Includes finned, Franken, Mutant, Kraken. |
| `solver/AlsSolver`, `Als`, `RestrictedCommon` | `core/solver/als.ts` | |
| `solver/ChainSolver`, `TablingSolver`, `TableEntry`, `GroupNode` | `core/solver/chains.ts`, `tabling.ts` | Largest and riskiest (`TablingSolver` alone is ~4.4k lines in trunk). Port last. |
| `solver/TemplateSolver`, `BruteForceSolver`, `GiveUpSolver` | `core/solver/*` | |
| `solver/SudokuStepFinder`, `SudokuSolver`, `SudokuSolverFactory` | `core/solver/index.ts` | Public API. |
| `generator/*` | `core/generator/*` | See `LICENSE-AUDIT.md` item 5. |
| `sudoku/Options`, `StepConfig`, `DifficultyLevel`, `GameMode` | `core/config/*` | Replace Java Preferences with JSON settings. |
| Swing panels/dialogs (~50 files) | `app/` React components | Redesign, don't transliterate. |
| `*.properties` (en/de) | `app/i18n/*.json` | Keep English and German. |

## Verification strategy

Behavior must match the original. Strategy:

1. Run the original 2.2.0 jar headless on a corpus of puzzles (sample from public
   puzzle sets we have verified rights to, plus generated ones).
2. Record per puzzle: solution, difficulty score and level, and the ordered list
   of solution steps (type, eliminations, placements).
3. Port modules in the order below, and compare TypeScript output with the
   recorded Java output as golden tests.

Port order: model, simple solver, single-digit patterns/coloring, wings,
uniqueness, fish, ALS, chains, tabling, templates, brute force, generator,
rating.

## Milestones

1. **M0** Repo, license files, CI. *(done)*
2. **M1** Model and simple solver with golden tests. *(done)*
3. **M2** Remaining solvers up to fish and ALS.
4. **M3** Chains and tabling, difficulty rating, generator.
5. **M4** Electron app: board, hints, candidates, undo, settings, print, import/export.
6. **M5** Windows installer, code signing, auto-update, website.

## Reproducing the reference source

`python3 scripts/fetch-reference.py HoDoKu/tags/release2.2.0 <output-dir>`
downloads the original source from SourceForge's web file browser. The reference
source is not committed to this repo.

## Status (M1)

Ported and verified against 404 puzzles solved by the original 2.2.0 jar
(`packages/core/test/golden.test.ts`; 9,410 of 11,582 steps compared in order; 144 of the 200 puzzles are solved entirely with ported techniques):
`SudokuSet`, `Sudoku2` (board, candidates, queues), `SimpleSolver` (Full House, Naked/Hidden
Single, Locked Pair/Triple, Locked Candidates 1/2, Naked/Hidden Pair/Triple/Quadruple),
solve loop with scoring and level.

Known gaps in M1:
- `setSudoku` reads 81-character and 9-line puzzles only; PM-grid and library formats are TODO.
- The "find all steps" variants and `SolutionStep` ordering/formatting are TODO.
- The golden corpus does not exercise the Naked/Locked subset step cache.

The big constant tables (all 111 solution types with their English names, and the 92 default
solver steps with scores) are generated from the original source by `scripts/gen-tables.py`.

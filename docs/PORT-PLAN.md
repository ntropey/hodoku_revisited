# Port plan

Source: HoDoKu 2.2.0 (78 Java files). Sizes: `solver` 22 files / ~15.9k lines,
`generator` 5 / ~1.6k, `sudoku` 71 / ~42k (mostly Swing UI, which we replace).

## Architecture

```
packages/
  core/      pure TypeScript engine, no DOM, no Node APIs. Runs in the browser (and Node).
  app/       PWA (React + Vite): installable on phones and desktops, solver in a Web Worker
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
3. **M2** All solvers of the default configuration. *(done)*
4. **M3** Generator, last-resort solvers (templates, brute force, Kraken), remaining formats, "find all steps".
5. **M4** PWA (React + Vite): board, hints, candidates, undo, settings, print, import/export.
   The solver runs in a Web Worker; a service worker makes it work offline. It installs as an app
   on phones and as a desktop app on Windows (Chrome/Edge) without an installer or code signing.
6. **M5** Website with technique guides (also the basis for search traffic and ads), then ads,
   then an optional paid tier (no ads, cloud sync, puzzle packs, themes). Electron/Tauri or a
   Capacitor wrapper stay possible later but are not planned.

## Reproducing the reference source

`python3 scripts/fetch-reference.py HoDoKu/tags/release2.2.0 <output-dir>`
downloads the original source from SourceForge's web file browser. The reference
source is not committed to this repo.

## Status (M2)

Ported and verified against 404 puzzles solved by the original 2.2.0 jar
(`packages/core/test/golden.test.ts`, run in lockstep: 23,658 steps compared, all 404 puzzles
solved identically including score and difficulty level):

- model: `SudokuSet`, `Sudoku2`, singles queues, `Chain`, `SolutionStep` with the original's ordering
- `SimpleSolver`: singles, locked candidates, locked/naked/hidden subsets
- `FishSolver`: basic, finned, sashimi, Franken and mutant fish of every size
- `SingleDigitPatternSolver`: Skyscraper, 2-String Kite, Empty Rectangle
- `WingSolver`: XY-, XYZ-, W-Wing
- `UniquenessSolver`: Uniqueness 1-6, Hidden Rectangle, Avoidable Rectangles, BUG+1
- `ColoringSolver`: Simple Colors, Multi Colors
- `ChainSolver`: Remote Pair, Turbot Fish, X-Chain, XY-Chain
- `AlsSolver`: ALS-XZ, ALS-XY-Wing, ALS-Chain, Death Blossom
- `MiscellaneousSolver`: Sue de Coq
- `TablingSolver`: Nice Loops, AICs (also grouped), Forcing Chains and Forcing Nets
- solve loop with scoring and difficulty level

Known gaps:
- Not ported: Kraken Fish, Template Set/Delete, Brute Force and Give Up (these are last-resort
  steps; the generator-produced test puzzles never need them), Siamese/dual variants
  (`allowDualsAndSiamese`), ALS nodes in tabling chains (`allowAlsInTablingChains`),
  and the "find all steps" API. Options that need them throw instead of giving wrong answers.
- `setSudoku` reads 81-character and 9-line puzzles only; PM-grid and library formats are TODO.
- The golden corpus has no Death Blossom, Simple Colors Wrap or Franken X-Wing steps
  (HoDoKu's generator rarely produces them), and the Naked/Locked subset step cache is not exercised.
- The template check that prunes large fish searches is not ported (it cannot change results).

The big constant tables (all 111 solution types with their English names, and the 92 default
solver steps with scores) are generated from the original source by `scripts/gen-tables.py`.

## Business notes (GPL)

The project is GPL-3.0-or-later, which allows ads and charging money but not hiding code:
keep the repository public and link it from the site. Paid extras should be things a copy of the
code does not give you: an ad-free tier, cloud sync (server side), original puzzle packs and
themes (separately licensed content), support. Start on the web (Apple's App Store terms have
historically conflicted with the GPL). AdSense needs real content pages and a consent banner for
EU/UK visitors; check its policy for installed PWAs before relying on it.

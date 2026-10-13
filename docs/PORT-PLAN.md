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
4. **M3** Generator, last-resort solvers, remaining formats, Kraken fish, templates, "find all steps". *(done; see Status)*
5. **M4** PWA (React + Vite): board, hints, candidates, undo, settings, print, import/export. *(first version done, see below)*
   The solver runs in a Web Worker; a service worker makes it work offline. It installs as an app
   on phones and as a desktop app on Windows (Chrome/Edge) without an installer or code signing.
6. **M5** *(first version done, see below)* Website with technique guides (also the basis for search traffic and ads), then ads,
   then an optional paid tier (no ads, cloud sync, puzzle packs, themes). Electron/Tauri or a
   Capacitor wrapper stay possible later but are not planned.

## Reproducing the reference source

`python3 scripts/fetch-reference.py HoDoKu/tags/release2.2.0 <output-dir>`
downloads the original source from SourceForge's web file browser. The reference
source is not committed to this repo.

## Status (M3)

Ported and verified against 587 puzzles solved by the original 2.2.0 jar
(`packages/core/test/golden.test.ts`, run in lockstep: 34,672 steps compared, every puzzle
solved identically including score and difficulty level; 404 puzzles from the Java generator,
173 from the TypeScript generator, 10 hard ones such as AI Escargot and Easter Monster):

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
- Brute Force, Incomplete and Give Up
- solve loop with scoring and difficulty level
- generator: `SudokuGenerator` (random solved grids, clue removal with optional symmetry and
  pattern) and `generatePuzzle(level)`, which mirrors HoDoKu's background generator. Puzzles are
  re-rated by the Java solver in the test corpus. Seeded RNG for reproducible puzzles.
  Level 2 takes about 2.7 s per puzzle, so the app will use a Web Worker and a precomputed bank.
- puzzle input (`formats.ts`): 81 characters (with `#` comments), grids with borders, PM grids,
  SimpleSudoku exports, the HoDoKu library format (`+` for solved non-givens, eliminated candidates)
  and gsf's taxonomy lines. Output via `Sudoku2.getSudoku(mode)`: library, clues only, values only,
  PM grid and the formatted variants. Unlike the original, input with other than 81 cells is rejected.

Update after M3 (all verified against HoDoKu 2.2.0):
- Template Set/Delete: the 46,656 templates are computed on first use (the original reads them from a
  data file of unclear origin). Checked with a Java run that had only singles, templates and brute
  force enabled (`Golden solve TYPE,...`, `golden-templates.jsonl`).
- Kraken Fish type 1 and 2: 1,079 Kraken steps match (`golden-kraken.jsonl`, run with only singles,
  Kraken Fish and brute force enabled).
- "Find all steps": `SudokuStepFinder.findAllFullHouses/NakedSingles/HiddenSingles/NakedXle/HiddenXle/
  LockedCandidates(1,2)/EmptyRectangles/SkyScrapers/TwoStringKites/SimpleColors/MultiColors`,
  `getAllUniqueness/Wings/Chains/Alses/DeathBlossoms/SueDeCoqs/NiceLoops/GroupedNiceLoops/ForcingChains/
  ForcingNets/Templates/Fishes/KrakenFishes` (`golden-all.jsonl.gz`: 56 states of 30 puzzles, every
  technique; about 66,000 steps in the default run and 36,000 more Kraken steps with `GOLDEN_FULL=1`).
  Same steps as the original. The order of steps that rank equal can differ for ALS, forcing chains/nets
  and Kraken fish: the comparators of the original are not consistent orderings (they return 1 for
  equal index sums in both directions), so such orders depend on the details of Java's sort, and the
  test compares those lists as sets.
- The original's Kraken search reads stale array entries (a fish with more cover units than base
  units, bounds `numberOfCoverUnits - baseLevel + coverLevel`), so its all-steps result depends on what
  ran before. The port has the same arrays and the same bounds; the test replays the original harness
  sequence to get identical results.

Known gaps:
- Not ported: Siamese/dual variants (`allowDualsAndSiamese`), ALS nodes in tabling chains
  (`allowAlsInTablingChains`). Options that need them throw instead of giving wrong answers.
- Export of a PM grid or library string *with a step* (`PM_GRID_WITH_STEP`, step type in the library
  format) is not ported.
- The golden corpus has no Death Blossom, Simple Colors Wrap or Franken X-Wing steps
  (HoDoKu's generator rarely produces them), and the Naked/Locked subset step cache is not exercised.
- The template check that prunes large fish searches is not ported (it cannot change results).

The big constant tables (all 111 solution types with their English names, and the 92 default
solver steps with scores) are generated from the original source by `scripts/gen-tables.py`.

## Status (M4, first version)

`packages/app` is an installable PWA: React + Vite, the solver and generator run in a Web Worker
(`worker.ts`, started and cancelled by `solverClient.ts`), `public/sw.js` caches the app so it works
offline, and `manifest.webmanifest` makes it installable. Features: new puzzles by level
(Easy to Unfair), keyboard and number-pad input, pencil marks, undo/redo, logical hints
(technique name, highlighted cells, struck-out eliminations, "Apply"), mistake marking, import of
any format `@hodoku/core` reads, copy, dark mode, autosave in localStorage. Game logic is in
`game.ts` (pure, unit tested); a browser run with Playwright covered hint, import and offline reload.

Update: new puzzles now come from a bank of 1,300 puzzles (Easy to Extreme) generated with this project's own
generator (`packages/app/scripts/gen-bank.ts`, merged by `merge-bank.mjs`). Each pick is disguised by a random
isomorphism (digit relabeling, row/column permutations, transpose) and re-rated, and the app avoids repeats until a
level is exhausted. Starting a game is instant; the generator is the fallback.

Trainer update: hints can be limited to a technique level (singles only ... everything), show the pattern
(fish base/cover units, ALS, colors, fins, chains with strong/weak links drawn on the board), print the chain in
AIC notation, give a one-sentence reason and link to the guide page; Print button (givens only). `describeStep`
in core turns any step into drawable data and is shared with the website diagrams.

Not yet: a "Show solution path" trainer, settings for which
techniques the hints may use, print, German translation, PNG icons for older browsers.

## Status (M5, first version)

`packages/website` is a dependency-free static site generator (`src/build.mjs`): start page,
19 technique guides (`src/techniques.mjs`, original text, grouped by difficulty), about/license,
privacy and 404 pages, and the app copied to `/play/`. With `SITE_URL` set it also writes
`sitemap.xml` and `robots.txt`. `.github/workflows/pages.yml` deploys it to GitHub Pages (manual run).
Tests check that every guide exists and that internal links resolve.

Update: every guide has a worked example diagram (inline SVG, light and dark). The examples are not drawn by
hand: `packages/website/scripts/gen-examples.ts` runs the solver over ~1,900 puzzles, keeps the simplest step of
each technique, and checks it against the puzzle's real solution before writing `src/examples.json`. Gap: no
Simple Colors Wrap example (not in the corpus yet).

Not yet: a German version, a custom domain, ads. Ads need a consent banner (EU/UK) and a privacy page
update first; the privacy page currently promises no tracking, so change it in the same commit
that adds ads.

## Business notes (GPL)

The project is GPL-3.0-or-later, which allows ads and charging money but not hiding code:
keep the repository public and link it from the site. Paid extras should be things a copy of the
code does not give you: an ad-free tier, cloud sync (server side), original puzzle packs and
themes (separately licensed content), support. Start on the web (Apple's App Store terms have
historically conflicted with the GPL). AdSense needs real content pages and a consent banner for
EU/UK visitors; check its policy for installed PWAs before relying on it.

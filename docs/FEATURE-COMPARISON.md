# Feature comparison: HoDoKu 2.2.0 vs the port

How the port's app surface compares with the original Java application, and what is still missing.
The engine is a separate question (see [PORT-PLAN.md](PORT-PLAN.md)); this file is about the *app*.

Sources: the original's menus and dialogs, taken from `MainFrame.java` (tag `release2.2.0`) and the
`src/sudoku/` file list, plus the screenshots in `hodoku_legacy_captures/`. The interactive
references are the original's menu bar, which was **File / Edit / Mode / Options / Puzzle / View / Help**.

Two framing notes:

- The port **redesigns** the UI on purpose ("redesign, don't transliterate" — PORT-PLAN): no menu bar,
  a command search, a phone-first layout. Divergence in *presentation* is intended.
- The gaps below are **capabilities that were not rebuilt**, not presentation differences.

## The original's menu surface

| Menu | Items |
|---|---|
| File | New · Load puzzle · Save puzzle · Save puzzle as · Load config · Save config as · Page setup · Print · **Extended print** · **Save as image (PNG)** · Enter game · Edit game · Play game · Quit |
| Edit | Undo · Redo · Copy clues · Copy filled · Copy PM grid · **Copy PM grid with step** · Copy library · Copy SimpleSudoku · Paste · Restart game · Reset game · Config |
| Mode | **Playing · Learning · Practising** |
| Options | Show candidates · Show wrong values · **Show deviations** · Show ColorKu · Color cells · Color candidates · Level |
| Puzzle | Hint · **Solution step** · **Backdoor search** · **History** · Create save point · Restore save point · Set givens · Set all hidden singles |
| View | Sudoku only · Summary · **Solution** · All steps · Cell zoom · Show hint panel · Show tool bar · Show hint buttons · Fullscreen · Reset view |
| Help | Keys (keyboard layout) · User manual · Solving guide · Project home page · Report error · Ask question · About |

## Colour and display

| Feature | Original | Port |
|---|---|---|
| ColorKu (digits/candidates as coloured balls) | ✅ `showColorKu`, `ColorKuImage`, `ConfigColorkuPanel` | ✅ **done** — Settings → ColorKu, per-digit colours |
| Manual colouring of **cells** | ✅ Options → *Color cells*, palette (screenshot 3: *Choose Color for Cell*) | ✅ **done** — Colour mode → Cells |
| Manual colouring of **candidates** | ✅ Options → *Color candidates* (*Choose Color for Candidates*) | ✅ **done** — Colour mode → Candidates |
| Configure the palette | ✅ `ConfigColorPanel` | ~ fixed six-colour palette; the ColorKu colours are configurable |
| Draw the solver's pattern (key/cover/fin/removed/placed, chain links) | ✅ | ✅ |
| Show deviations (your candidates vs the solver's) | ✅ `showDeviations` | ✅ **done** — Settings → Show deviations; a dot marks the cells |
| Cell zoom (enlarged active cell) | ✅ `CellZoomPanel` | ✅ **done** — Settings → Cell zoom |
| Show wrong values | ✅ | ✅ (Mark mistakes) |
| Show candidates | ✅ | ✅ |

The port colours **hints**; the original also let you colour the board **yourself**. That is now possible
in the port too, with its own palette (Colour mode).

## Trainer and modes

| Feature | Original | Port |
|---|---|---|
| Game modes (Playing / Learning / Practising) | ✅ `GameMode` | ✅ **done** — the **Mode** menu (Playing, Learning, Practising) with a Training dialog |
| Training configuration (which techniques you drill) | ✅ `ConfigTrainingDialog`, `StepConfig.isEnabledTraining()` | ~ **done in part** — the training technique set the modes use exists (Training dialog); the per-technique solver/step/training config panels are still not exposed |
| Solution path, stepped (Next step / All easy steps / Solve up to) | ✅ `SolutionPanel` | ✅ **done** — the **Path** tab |
| Summary (techniques used, counts, score) | ✅ `SummaryPanel` | ✅ **done** — the **Summary** tab |
| All possible steps | ✅ | ✅ (All steps) |
| Set all hidden singles | ✅ | ✅ **done** — *Fill all hidden singles* |

## Puzzle management

| Feature | Original | Port |
|---|---|---|
| Puzzle library (save/load named puzzles, categories, *Copy library*) | ✅ | ✅ **done** — Puzzles dialog → Library (the port still reads the library format on import) |
| History of played puzzles | ✅ `HistoryDialog` | ✅ **done** — Puzzles dialog → History |
| Named save points (create / restore) | ✅ `RestoreSavePointDialog` | ✅ **done** — Puzzles dialog → Saves |
| Restart game | ✅ *Restart game* / *Reset game* | ✅ **done** — command *Restart game*; the port has one action where the original split *Restart game* and *Reset game* |
| Set givens (freeze the placed digits as clues) | ✅ `SetGivensDialog` | ✅ **done** — command *Set givens* |
| Load / save puzzle to a file, Save as | ✅ | ✅ **done** — *Open a file* in the Import dialog and the *Save* menu (the browser's file picker and download; there is no in-place *Save*) |
| Load / save configuration | ✅ | ~ settings in `localStorage` |

## Output

| Feature | Original | Port |
|---|---|---|
| Print the board | ✅ | ✅ (givens only) |
| Extended print (booklets, several puzzles per page) | ✅ `ExtendedPrintDialog` | ✅ **done** — *Extended print*: up to five sections of puzzles (level, mode, candidates), five layouts, a rating line and booklet imposition on the landscape layouts |
| Print the solution | ✅ `PrintSolutionDialog` | ✅ **done** — *Print solution* (the board, then the solved grid) |
| Save as image (PNG) | ✅ `WriteAsPNGDialog` | ✅ **done** — *Export PNG* |
| Copy clues / filled | ✅ | ✅ **done** — the Copy menu (givens) |
| Copy PM grid, library, SimpleSudoku (formatted grid) | ✅ | ✅ **done** — the Copy menu (puzzle with candidates, library line, formatted grid) |
| Copy PM grid with step | ✅ | ❌ (the *with step* format is also a known core gap) |

## Generation and configuration

| Feature | Original | Port |
|---|---|---|
| Generate by level | ✅ | ✅ |
| Generator patterns / symmetry | ✅ `GeneratorPatternPanel` (supported in `core`, not exposed) | ❌ |
| Per-technique config (solver, step scores, enabled, training) | ✅ `ConfigSolverPanel`, `ConfigStepPanel` | ~ *Techniques a hint may use* only |
| Find-all-steps config, progress, colour, ColorKu, level-font panels | ✅ | ~ simpler settings sheet; ColorKu colours done |
| Keyboard layout | ✅ `KeyboardLayoutFrame` | ❌ |
| Fonts (cell, level) | ✅ `ConfigLevelFontPanel` | ❌ (theme only) |

## Other

| Feature | Original | Port |
|---|---|---|
| Backdoor search | ✅ `BackdoorSearchDialog` | ❌ |
| Interactive fish candidate chooser | ✅ `FishChooseCandidatesDialog` | ❌ |
| Check a puzzle as you enter it | ✅ `CheckNode` / `CheckRenderer`, `SetGivensDialog` | ~ mark mistakes |
| Progress | ✅ `ProgressChecker` (percent) | ~ filled-count and score |
| Sudoku-only view, fullscreen, toolbar/hint-panel toggles | ✅ (View menu) | ~ responsive layout instead |
| Localisation (German and others) | ✅ | ❌ (dropped; i18n is a separate future task) |

## Where the port leads

Not in the original: installable **PWA with offline use**, **command search** (Ctrl/Cmd+K),
responsive desktop/sheet layout, ARIA-labelled board, a timer, mistake marking, `?p=`/`?level=` links,
a **precomputed puzzle bank** for instant starts, technique guides with solver-verified diagrams, an
`analyze()`-driven Summary, and the site layer (downloads, ads, EU/UK consent banner).

## Status of the gaps

Done since this comparison was first made: **ColorKu** (with per-digit colours), the **solution-path
trainer** (Path tab), **cell zoom**, **manual colouring** of cells and candidates, **show deviations**,
the **puzzle tools** (*Restart game*, *Set givens* and *Fill all hidden singles*), puzzle management
(a **library**, a **history** and named **save points**, in the Puzzles dialog), loading a puzzle from a
file and saving one to a file, the copy formats
(**givens**, **puzzle with candidates**, **library line** and **formatted grid**), the two
outputs, **print solution** and **PNG**, **extended print** (a book of up to five sections, five
layouts, a rating line and booklet imposition), and the **game modes** (Playing / Learning / Practising,
with a Training dialog for the techniques).

Still open, roughly by value: the *with step* format; generator
patterns/symmetry in the app; backdoor search; and the per-technique solver/step/training config
panels (the training technique set itself is in the Training dialog). The
original's separate *Reset game* is not a distinct action in the port; *Restart game* covers it.

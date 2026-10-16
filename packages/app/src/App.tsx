import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultSolverSteps, SOLUTION_TYPE_INFO } from '@hodoku/core';
import { Board } from './Board';
import { boardSvg, downloadSvg } from './boardImage';
import { AllSteps } from './components/AllSteps';
import { BookPrint } from './components/BookPrint';
import { BottomSheet, type Snap } from './components/BottomSheet';
import { CellZoom } from './components/CellZoom';
import { CommandMenu, type Command } from './components/CommandMenu';
import { DigitPad } from './components/DigitPad';
import { ExtendedPrintDialog } from './components/ExtendedPrintDialog';
import { HintView } from './components/HintView';
import { ImportDialog } from './components/ImportDialog';
import { PathView } from './components/PathView';
import { PrintSolution } from './components/PrintSolution';
import { PuzzlesDialog } from './components/PuzzlesDialog';
import { SolvedDialog } from './components/SolvedDialog';
import { SettingsSheet } from './components/SettingsSheet';
import { SidePanel } from './components/SidePanel';
import { Summary } from './components/Summary';
import { TopBar } from './components/TopBar';
import { TrainingDialog } from './components/TrainingDialog';
import {
  erase,
  fillCands,
  fillHiddenSingles,
  hiddenSingles,
  isGiven,
  isSolved,
  newGame,
  notesOf,
  redo,
  remaining,
  removeCands,
  restart,
  setGivens,
  setValue,
  toggleCand,
  toggleNote,
  clearNotes,
  clearNotesAt,
  clearColors,
  deviations,
  paintCand,
  paintCell,
  autoFillLastDigit,
  undo,
  wrongCells,
  type GameState,
} from './game';
import { imposePages } from './extendedPrint';
import { HINT_LEVEL_NAMES, LEVEL_NAMES, type CopyFormat, type HintLevel, type HintResult, type PrintSection, type PrintSudoku, type PuzzleInfo } from './protocol';
import { isCancelled, SolverClient } from './solverClient';
import {
  addCapped,
  loadJson,
  newId,
  removeById,
  saveJson,
  snapshotGame,
  HISTORY_CAP,
  HISTORY_KEY,
  LIBRARY_CAP,
  LIBRARY_KEY,
  SAVEPOINTS_CAP,
  SAVEPOINTS_KEY,
  type HistoryEntry,
  type LibraryEntry,
  type SavePoint,
  type Store,
} from './store';
import { DEFAULT_COLORKU_COLORS, DEFAULT_SETTINGS, PALETTE, type CopyWhat, type Mode, type Settings, type Tab } from './ui';
import { downloadText, readTextFile } from './files';

const SAVE_KEY = 'hodoku-revisited:game';
const SETTINGS_KEY = 'hodoku-revisited:settings';
const TIME_KEY = 'hodoku-revisited:time';

/** What each Copy/Save format is called, for the status line. */
const COPY_LABELS: Record<CopyWhat, string> = {
  givens: 'givens',
  pm: 'puzzle with candidates',
  library: 'library line',
  formatted: 'formatted grid',
};

/** localStorage in the shape the store helpers want; they swallow the failures (private mode, quota). */
const localStorageStore: Store = {
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
};

/** Stable fallback so the "no technique disabled" case keeps the same array reference across renders. */
const NO_TECHNIQUES: string[] = [];

/** How hard each technique is (0 singles ... 5 extreme), for "Solve up to". */
const STEP_LEVEL = new Map<string, number>(defaultSolverSteps().map((c) => [c.type, c.level]));

/** The readable name of a technique, for the training status line. */
const TECHNIQUE_NAMES = new Map<string, string>(defaultSolverSteps().map((c) => [c.type, SOLUTION_TYPE_INFO[c.type].stepName]));

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or full: the game just isn't remembered */
  }
}

/** A puzzle given in the address (?p=81 characters), used by the "open in app" links of the guides. */
function puzzleFromUrl(): string | null {
  const p = new URLSearchParams(window.location.search).get('p');
  return p && /^[.0-9]{81}$/.test(p) ? p : null;
}

/** A difficulty in the address (?level=1..5), used by the start page: begins a new puzzle of that level. */
function levelFromUrl(): number | null {
  const l = Number(new URLSearchParams(window.location.search).get('level'));
  return Number.isInteger(l) && l >= 1 && l <= 5 ? l : null;
}

export function App() {
  const [game, setGame] = useState<GameState | null>(() => load<GameState>(SAVE_KEY));
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...load<Settings>(SETTINGS_KEY) }));
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('value');
  const [filterDigit, setFilterDigit] = useState(0);
  const [paintColor, setPaintColor] = useState(1);
  const [paintTarget, setPaintTarget] = useState<'cell' | 'cand'>('cell');
  const [hint, setHint] = useState<HintResult | null>(null);
  const [allSteps, setAllSteps] = useState<{ results: HintResult[]; total: Record<string, number> } | null>(null);
  const [pathSteps, setPathSteps] = useState<HintResult[] | null>(null);
  const [pathDone, setPathDone] = useState(0);
  const [tab, setTab] = useState<Tab>('hint');
  const [snap, setSnap] = useState<Snap>('peek');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [puzzlesOpen, setPuzzlesOpen] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [printSolution, setPrintSolution] = useState(false);
  const [extendedPrintOpen, setExtendedPrintOpen] = useState(false);
  const [bookPages, setBookPages] = useState<{ pages: (PrintSudoku | null)[][]; layout: number; rating: boolean } | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[]>(() => loadJson(localStorageStore, LIBRARY_KEY, []));
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadJson(localStorageStore, HISTORY_KEY, []));
  const [saves, setSaves] = useState<SavePoint[]>(() => loadJson(localStorageStore, SAVEPOINTS_KEY, []));
  const [seconds, setSeconds] = useState(() => {
    const t = load<{ givens: string; seconds: number }>(TIME_KEY);
    const g = load<GameState>(SAVE_KEY);
    return t && g && t.givens === g.givens ? t.seconds : 0;
  });
  // leaving Filter mode switches the filter off
  const prevMode = useRef(mode);
  useEffect(() => {
    if (prevMode.current === 'filter' && mode !== 'filter') setFilterDigit(0);
    prevMode.current = mode;
  }, [mode]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const secondsRef = useRef(seconds);
  secondsRef.current = seconds;
  const solver = useRef(new SolverClient());

  useEffect(() => {
    if (game) save(SAVE_KEY, game);
  }, [game]);
  useEffect(() => save(SETTINGS_KEY, settings), [settings]);
  useEffect(() => saveJson(localStorageStore, LIBRARY_KEY, library), [library]);
  useEffect(() => saveJson(localStorageStore, HISTORY_KEY, history), [history]);
  useEffect(() => saveJson(localStorageStore, SAVEPOINTS_KEY, saves), [saves]);
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // print the board and the solution grid, then drop the grid again
  useEffect(() => {
    if (!printSolution) return;
    const done = () => setPrintSolution(false);
    window.addEventListener('afterprint', done);
    window.print();
    return () => window.removeEventListener('afterprint', done);
  }, [printSolution]);

  // print an imposed book: hide the normal page while the browser prints, then drop the book again
  useEffect(() => {
    if (!bookPages) return;
    document.body.classList.add('printing-book');
    const done = () => {
      document.body.classList.remove('printing-book');
      setBookPages(null);
    };
    window.addEventListener('afterprint', done);
    window.print();
    return () => {
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('printing-book');
    };
  }, [bookPages]);

  const solved = game ? isSolved(game) : false;
  const hintLevel = settings.hintLevel ?? 5;
  const disabledTechniques = settings.disabledTechniques ?? NO_TECHNIQUES;
  const colorKuColors = settings.colorKuColors ?? DEFAULT_COLORKU_COLORS;
  const trainingNames = (settings.trainingTechniques ?? []).map((t) => TECHNIQUE_NAMES.get(t) ?? t).join(', ');

  // the completion dialog opens when this session solves the puzzle, not when a finished game is reloaded
  const [solvedOpen, setSolvedOpen] = useState(false);
  const wasSolved = useRef(solved);
  useEffect(() => {
    if (solved && !wasSolved.current) {
      setSolvedOpen(true);
      // the newest matching history entry is marked solved, with the time it took
      setHistory((h) => {
        const i = h.findIndex((e) => e.puzzle === game?.givens);
        if (i === -1 || h[i].solved) return h;
        const next = h.slice();
        next[i] = { ...next[i], solved: true, seconds: secondsRef.current };
        return next;
      });
    }
    if (!solved) setSolvedOpen(false);
    wasSolved.current = solved;
  }, [solved]);

  // timer: counts while the page is visible and the puzzle is not solved; saved with the puzzle's givens
  useEffect(() => {
    if (!game || solved) return;
    const tick = window.setInterval(() => {
      if (!document.hidden) setSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(tick);
  }, [game?.givens, solved]);
  useEffect(() => {
    if (game && seconds % 5 === 0) save(TIME_KEY, { givens: game.givens, seconds });
  }, [seconds, game?.givens]);

  const clearPanel = useCallback(() => {
    setHint(null);
    setAllSteps(null);
    setPathSteps(null);
    setPathDone(0);
    setMessage(null);
  }, []);

  const update = useCallback(
    (fn: (g: GameState) => GameState, autoFill = false) => {
      setGame((g) => {
        if (!g) return g;
        const next = fn(g);
        // "auto-fill last digit": after a placement, fill any unit that is down to its last empty cell
        return autoFill && next !== g && settingsRef.current.autoFill ? autoFillLastDigit(next) : next;
      });
      clearPanel();
    },
    [clearPanel],
  );

  const startGame = useCallback((g: GameState) => {
    setGame(g);
    setSelected(null);
    setFilterDigit(0);
    setHint(null);
    setAllSteps(null);
    setPathSteps(null);
    setPathDone(0);
    setMessage(null);
    setSeconds(0);
    save(TIME_KEY, { givens: g.givens, seconds: 0 });
    // record the puzzle; the newest entry is not repeated when the same puzzle is started again
    setHistory((h) =>
      h[0]?.puzzle === g.givens
        ? h
        : addCapped(h, { id: newId(), puzzle: g.givens, level: g.level, score: g.score, seconds: 0, solved: false, at: Date.now() }, HISTORY_CAP),
    );
  }, []);

  const startNew = useCallback(
    async (level: number) => {
      solver.current.cancel();
      setSettings((s) => ({ ...s, level }));
      setMessage(null);
      const mode = settingsRef.current.gameMode;
      const techniques = settingsRef.current.trainingTechniques ?? [];
      const seen = settingsRef.current.seen?.[level] ?? [];
      // the bank index bookkeeping is the same for a plain and a training puzzle
      const remember = (info: PuzzleInfo) => {
        if (info.bankIndex === undefined) return;
        const seenNow = settingsRef.current.seen ?? {};
        // once every puzzle of the level was played the bank picks from all of them again
        const played = [...new Set([...(seenNow[level] ?? []), info.bankIndex])];
        setSettings((s) => ({ ...s, seen: { ...seenNow, [level]: played } }));
      };
      const names = techniques.map((t) => TECHNIQUE_NAMES.get(t) ?? t).join(', ');
      try {
        if (mode !== 'playing' && techniques.length > 0) {
          setBusy(`Looking for a ${names} puzzle...`);
          const info = await solver.current.train(level, techniques, mode === 'learning', seen);
          if (info === null) {
            setMessage(`No puzzle needing ${names} was found. Try another level or technique.`);
            return;
          }
          remember(info);
          startGame(newGame(info));
        } else {
          setBusy(`Getting a ${LEVEL_NAMES[level]} puzzle...`);
          const info = await solver.current.fromBank(level, seen);
          remember(info);
          startGame(newGame(info));
        }
      } catch (e) {
        if (!isCancelled(e)) setMessage((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [startGame],
  );

  // first start: a puzzle from the address, the saved game, or a new one
  useEffect(() => {
    const p = puzzleFromUrl();
    const lv = levelFromUrl();
    if (lv) {
      window.history.replaceState(null, '', window.location.pathname);
      void startNew(lv);
    } else if (p) {
      window.history.replaceState(null, '', window.location.pathname);
      setBusy('Checking puzzle...');
      solver.current
        .analyze(p)
        .then((info) => startGame(newGame(info)))
        .catch((e: Error) => {
          if (!isCancelled(e)) setMessage(e.message);
        })
        .finally(() => setBusy(null));
    } else if (!game) void startNew(settings.level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const input = useCallback(
    (d: number) => {
      if (!game) return;
      if (mode === 'filter') {
        setFilterDigit((f) => (f === d ? 0 : d));
        return;
      }
      if (mode === 'color') {
        // the digit keys pick a palette color while coloring
        if (d >= 0 && d <= PALETTE.length) setPaintColor(d);
        return;
      }
      if (selected === null) return;
      // pencil marks are what you see: the solver's candidates when they are shown, otherwise your own notes
      if (mode === 'notes' && game.values[selected] === 0) update((g) => (settingsRef.current.showCands ? toggleCand(g, selected, d) : toggleNote(g, selected, d)));
      else update((g) => setValue(g, selected, d), true);
    },
    [game, selected, mode, update],
  );

  const wrong = useMemo(() => new Set(game && settings.checkMistakes ? wrongCells(game) : []), [game, settings.checkMistakes]);
  const left = useMemo(() => (game ? remaining(game) : []), [game]);
  const filled = game ? game.values.filter((v) => v !== 0).length : 0;

  // puzzle tools: work out up front whether each command would do anything, so none is offered as a no-op
  const hasOwnValues = useMemo(() => !!game && game.values.some((v, i) => v !== 0 && !isGiven(game, i)), [game]);
  const hasProgress = useMemo(
    () =>
      !!game &&
      (game.values.some((v, i) => v !== 0 && !isGiven(game, i)) || notesOf(game).some((n) => n !== 0) || !!game.cellColors || !!game.candColors || (game.hints ?? 0) > 0),
    [game],
  );
  const hasHiddenSingle = useMemo(() => !!game && hiddenSingles(game.values, game.cands).length > 0, [game]);
  const deviate = useMemo(() => (game && settings.showDeviations ? new Set(deviations(game)) : undefined), [game, settings.showDeviations]);

  const askHint = useCallback(async () => {
    if (!game) return;
    setTab('hint');
    setSnap((s) => (s === 'peek' ? 'half' : s));
    setBusy('Looking for a hint...');
    setMessage(null);
    try {
      const h = await solver.current.hint(game.values, game.cands, hintLevel, disabledTechniques);
      setHint(h);
      setMessage(h ? null : hintLevel < 5 ? 'No hint at this hint level. Raise "Hints use" above.' : 'No logical hint found.');
    } catch (e) {
      if (!isCancelled(e)) setMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, [game, hintLevel, disabledTechniques]);

  const askAllSteps = useCallback(
    async (auto = false) => {
      if (!game) return;
      setTab('steps');
      if (!auto) setSnap((s) => (s === 'peek' ? 'half' : s));
      setBusy('Looking for all steps...');
      try {
        const data = await solver.current.allHints(game.values, game.cands, hintLevel, disabledTechniques);
        setAllSteps(data);
        // the top step is shown on the board right away
        setHint(data.results[0] ?? null);
        setMessage(null);
      } catch (e) {
        setAllSteps({ results: [], total: {} });
        if (!isCancelled(e)) setMessage((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [game, hintLevel, disabledTechniques],
  );

  /** The solver's remaining steps from the current board (the "solution path"). */
  const askPath = useCallback(async () => {
    if (!game) return;
    setBusy('Finding the solution path...');
    setMessage(null);
    try {
      setPathSteps(await solver.current.path(game.values, game.cands));
      setPathDone(0);
    } catch (e) {
      if (!isCancelled(e)) setMessage((e as Error).message);
      setPathSteps([]);
    } finally {
      setBusy(null);
    }
  }, [game]);

  // changing which techniques a hint may use throws away the current hint and the All steps list,
  // exactly like changing "Hints use" does; the steps tab then refreshes itself
  useEffect(() => {
    setAllSteps(null);
    setHint(null);
  }, [disabledTechniques]);

  // the All steps tab is always filled: opening it, making a move or changing "Hints use" refreshes the list
  useEffect(() => {
    if (tab === 'steps' && game && !solved && allSteps === null && busy === null) void askAllSteps(true);
  }, [tab, game, solved, allSteps, busy, askAllSteps]);

  // the Path tab is filled the first time it is opened (a move clears the path again)
  useEffect(() => {
    if (tab === 'path' && game && pathSteps === null && busy === null) void askPath();
  }, [tab, game, pathSteps, busy, askPath]);

  const applyHint = useCallback(() => {
    if (!hint) return;
    update((g) => {
      let next = g;
      for (const p of hint.marks.place) next = setValue(next, p.cell, p.digit);
      if (hint.marks.elim.length > 0) next = removeCands(next, hint.marks.elim);
      return { ...next, hints: (g.hints ?? 0) + 1 };
    }, true);
  }, [hint, update]);

  // apply the next `count` steps of the (cached) solution path; this does not clear the path, it advances it
  const applyPath = useCallback(
    (count: number) => {
      if (!game || !pathSteps) return;
      const n = Math.min(count, pathSteps.length - pathDone);
      if (n <= 0) return;
      let next = game;
      for (let k = 0; k < n; k++) {
        const h = pathSteps[pathDone + k];
        for (const p of h.marks.place) next = setValue(next, p.cell, p.digit);
        if (h.marks.elim.length > 0) next = removeCands(next, h.marks.elim);
      }
      setGame({ ...next, hints: (game.hints ?? 0) + n });
      setPathDone(pathDone + n);
    },
    [game, pathSteps, pathDone],
  );

  /** Apply every leading step whose technique is no harder than `level` ("Solve up to"). */
  const applyUpTo = useCallback(
    (level: HintLevel) => {
      if (!pathSteps) return;
      let n = 0;
      for (let k = pathDone; k < pathSteps.length; k++) {
        if ((STEP_LEVEL.get(pathSteps[k].type) ?? 5) <= level) n++;
        else break;
      }
      applyPath(n);
    },
    [pathSteps, pathDone, applyPath],
  );

  const doImport = async () => {
    setBusy('Checking puzzle...');
    setImportError(null);
    try {
      startGame(newGame(await solver.current.analyze(importText)));
      setImporting(false);
      setImportText('');
    } catch (e) {
      if (!isCancelled(e)) setImportError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  /** The text of one of the Copy/Save formats, or null when it could not be made. */
  const puzzleText = useCallback(
    async (what: CopyWhat): Promise<string | null> => {
      if (!game) return null;
      try {
        if (what === 'givens') return game.givens;
        const mode: CopyFormat = what === 'pm' ? 'PM_GRID' : what === 'library' ? 'LIBRARY' : 'CLUES_ONLY_FORMATTED';
        return await solver.current.format(game.values, game.cands, mode);
      } catch (e) {
        if (!isCancelled(e)) setMessage((e as Error).message);
        return null;
      }
    },
    [game],
  );

  /** The Copy menu: put one of the text formats on the clipboard. */
  const copyPuzzle = useCallback(
    async (what: CopyWhat) => {
      const text = await puzzleText(what);
      if (text === null) return;
      try {
        await navigator.clipboard.writeText(text);
        setMessage(`Copied the ${COPY_LABELS[what]}.`);
      } catch {
        // the clipboard can be blocked (insecure context): fall back to the text itself, but it is
        // only readable in the status line when it is short (the grid formats are many lines)
        setMessage(text.length <= 81 ? text : 'Copy failed.');
      }
    },
    [puzzleText],
  );

  /** Save one of the text formats to a file (the browser's own download). */
  const savePuzzle = useCallback(
    async (what: CopyWhat) => {
      const text = await puzzleText(what);
      if (text === null) return;
      downloadText(`hodoku-${what}.txt`, text);
      setMessage(`Saved the ${COPY_LABELS[what]} to a file.`);
    },
    [puzzleText],
  );

  /** Export the current board as a PNG (board only: grid, values, candidates, colors). */
  const exportPng = useCallback(async () => {
    if (!game) return;
    try {
      const svg = boardSvg(game.values, game.cands, {
        showCands: settingsRef.current.showCands,
        colorKu: settingsRef.current.colorKu,
        colorKuColors: settingsRef.current.colorKuColors,
        cellColors: game.cellColors,
        candColors: game.candColors,
        palette: PALETTE,
        givens: game.givens,
      });
      await downloadSvg(svg, 'hodoku.png');
      setMessage('Saved hodoku.png.');
    } catch (e) {
      setMessage((e as Error).message);
    }
  }, [game]);

  /** Build a book of puzzles for extended print: generate every section, impose the pages, then print. */
  const printBook = useCallback(async (sections: PrintSection[], layout: number, rating: boolean, booklet: boolean) => {
    setExtendedPrintOpen(false);
    setPrintSolution(false);
    setMessage(null);
    setBusy('Preparing the print job...');
    try {
      const puzzles = await solver.current.book(sections, settingsRef.current.trainingTechniques ?? []);
      if (puzzles.length === 0) {
        setMessage('No puzzles to print.');
        return;
      }
      const pages = imposePages(puzzles.length, layout, booklet).map((page) => page.map((i) => puzzles[i] ?? null));
      setBookPages({ pages, layout, rating });
    } catch (e) {
      if (!isCancelled(e)) setMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, []);

  /** Load a puzzle from the library or the history: rate it, then start a fresh game from it. */
  const openPuzzle = useCallback(
    (puzzle: string) => {
      setPuzzlesOpen(false);
      setBusy('Checking puzzle...');
      solver.current
        .analyze(puzzle)
        .then((info) => startGame(newGame(info)))
        .catch((e: Error) => {
          if (!isCancelled(e)) setMessage(e.message);
        })
        .finally(() => setBusy(null));
    },
    [startGame],
  );

  const saveToLibrary = useCallback(
    (name: string) => {
      if (!game) return;
      setLibrary((l) => addCapped(l, { id: newId(), name, puzzle: game.givens, at: Date.now() }, LIBRARY_CAP));
    },
    [game],
  );

  const createSave = useCallback(
    (name: string) => {
      if (!game) return;
      setSaves((s) => addCapped(s, { id: newId(), name, at: Date.now(), seconds, game: snapshotGame(game) }, SAVEPOINTS_CAP));
    },
    [game, seconds],
  );

  /** Restore a save point: a fresh game state, so undo cannot cross the restore. */
  const restoreSave = useCallback(
    (id: string) => {
      const sp = saves.find((s) => s.id === id);
      if (!sp) return;
      const restored = { ...sp.game, past: [], future: [] } as GameState;
      setGame(restored);
      wasSolved.current = isSolved(restored);
      setSeconds(sp.seconds);
      save(TIME_KEY, { givens: sp.game.givens, seconds: sp.seconds });
      clearPanel();
      setSelected(null);
      setPuzzlesOpen(false);
    },
    [saves, clearPanel],
  );

  const deleteLibrary = useCallback((id: string) => setLibrary((l) => removeById(l, id)), []);
  const deleteHistory = useCallback((id: string) => setHistory((h) => removeById(h, id)), []);
  const clearHistory = useCallback(() => setHistory([]), []);
  const deleteSave = useCallback((id: string) => setSaves((s) => removeById(s, id)), []);

  const eraseSelected = useCallback(() => {
    if (selected === null) return;
    // in Color mode Erase clears the color of the selected cell
    if (mode === 'color') {
      update((g) => paintCell(g, selected, 0));
      return;
    }
    // in Notes mode on an empty cell, Erase clears the pencil marks you typed
    if (mode === 'notes' && !settingsRef.current.showCands && game?.values[selected] === 0) update((g) => clearNotesAt(g, selected));
    else update((g) => erase(g, selected));
  }, [selected, update, mode, game]);

  // coloring: while in Color mode a click paints with the active color
  const paintTargetNow = mode === 'color' ? paintTarget : null;
  const onPaintCell = useCallback((i: number) => update((g) => paintCell(g, i, paintColor)), [update, paintColor]);
  const onPaintCand = useCallback((i: number, d: number) => update((g) => paintCand(g, i, d, paintColor)), [update, paintColor]);

  const commands: Command[] = useMemo(
    () => [
      ...[1, 2, 3, 4, 5].map((l) => ({ label: `New puzzle: ${LEVEL_NAMES[l]}`, run: () => void startNew(l) })),
      { label: 'Playing mode', run: () => setSettings((s) => ({ ...s, gameMode: 'playing' })) },
      { label: 'Learning mode…', run: () => setTrainingOpen(true) },
      { label: 'Practicing mode…', run: () => setTrainingOpen(true) },
      { label: 'Training techniques…', run: () => setTrainingOpen(true) },
      { label: 'Get a hint', hint: 'H', run: () => void askHint(), disabled: !game || solved },
      { label: 'Find all steps', run: () => void askAllSteps(), disabled: !game || solved },
      { label: 'Show the solution path', run: () => { setTab('path'); setSnap((s) => (s === 'peek' ? 'half' : s)); }, disabled: !game },
      { label: 'Apply step', hint: 'Enter', run: () => (tab === 'path' ? applyPath(1) : applyHint()), disabled: tab === 'path' ? !(pathSteps && pathDone < pathSteps.length) : !hint },
      { label: 'Undo', hint: 'Z', run: () => update(undo), disabled: !game?.past.length },
      { label: 'Redo', hint: 'Y', run: () => update(redo), disabled: !game?.future.length },
      { label: 'Restart game', run: () => update(restart), disabled: !hasProgress },
      { label: 'Set givens', run: () => update(setGivens), disabled: !hasOwnValues },
      { label: 'Fill all hidden singles', run: () => update(fillHiddenSingles), disabled: !hasHiddenSingle },
      { label: 'Erase cell', run: eraseSelected, disabled: selected === null },
      { label: 'Value mode', run: () => setMode('value') },
      { label: 'Notes mode', hint: 'N', run: () => setMode('notes') },
      { label: 'Filter mode', hint: 'F', run: () => setMode('filter') },
      { label: 'Color mode', hint: 'C', run: () => setMode('color') },
      { label: 'Clear colors', run: () => update(clearColors), disabled: !game?.cellColors && !game?.candColors },
      { label: 'Clear digit filter', run: () => setFilterDigit(0), disabled: filterDigit === 0 },
      { label: 'Clear pencil marks', run: () => update(clearNotes) },
      { label: 'Reset candidates', run: () => update(fillCands) },
      { label: `${settings.showCands ? 'Hide' : 'Show'} all candidates`, run: () => setSettings((s) => ({ ...s, showCands: !s.showCands })) },
      { label: `Mark mistakes: ${settings.checkMistakes ? 'turn off' : 'turn on'}`, run: () => setSettings((s) => ({ ...s, checkMistakes: !s.checkMistakes })) },
      { label: `Auto-fill last digit: ${settings.autoFill ? 'turn off' : 'turn on'}`, run: () => setSettings((s) => ({ ...s, autoFill: !s.autoFill })) },
      { label: `ColorKu: ${settings.colorKu ? 'turn off' : 'turn on'}`, run: () => setSettings((s) => ({ ...s, colorKu: !s.colorKu })) },
      { label: `Cell zoom: ${settings.cellZoom ? 'turn off' : 'turn on'}`, run: () => setSettings((s) => ({ ...s, cellZoom: !s.cellZoom })) },
      { label: 'Import puzzle', run: () => setImporting(true) },
      { label: 'Open puzzles…', run: () => setPuzzlesOpen(true) },
      { label: 'Copy givens', run: () => void copyPuzzle('givens') },
      { label: 'Copy puzzle with candidates', run: () => void copyPuzzle('pm') },
      { label: 'Copy library line', run: () => void copyPuzzle('library') },
      { label: 'Copy formatted grid', run: () => void copyPuzzle('formatted') },
      { label: 'Save puzzle: givens', run: () => void savePuzzle('givens') },
      { label: 'Save puzzle: candidates', run: () => void savePuzzle('pm') },
      { label: 'Save puzzle: library line', run: () => void savePuzzle('library') },
      { label: 'Save puzzle: formatted grid', run: () => void savePuzzle('formatted') },
      { label: 'Print', run: () => window.print() },
      { label: 'Print solution', run: () => setPrintSolution(true) },
      { label: 'Extended print…', run: () => setExtendedPrintOpen(true) },
      { label: 'Export PNG', run: () => void exportPng() },
      { label: 'Settings', run: () => setSettingsOpen(true) },
      ...['light', 'dark', 'system'].map((t) => ({ label: `Theme: ${t}`, run: () => setSettings((s) => ({ ...s, theme: t as Settings['theme'] })) })),
    ],
    [askAllSteps, askHint, applyHint, applyPath, copyPuzzle, savePuzzle, eraseSelected, exportPng, filterDigit, game, hasHiddenSingle, hasOwnValues, hasProgress, hint, pathDone, pathSteps, selected, settings.checkMistakes, settings.showCands, settings.autoFill, settings.colorKu, settings.cellZoom, solved, startNew, tab, update],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandsOpen((o) => !o);
        return;
      }
      if (importing || settingsOpen || commandsOpen || puzzlesOpen || trainingOpen || extendedPrintOpen || e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.altKey && e.code.startsWith('Digit') && e.code !== 'Digit0') {
        e.preventDefault();
        const d = Number(e.code.slice(5));
        setFilterDigit((f) => (f === d ? 0 : d));
        return;
      }
      if (e.altKey) return;
      if (e.key >= '1' && e.key <= '9') input(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') eraseSelected();
      else if (e.key === 'n') setMode((m) => (m === 'notes' ? 'value' : 'notes'));
      else if (e.key === 'f') setMode((m) => (m === 'filter' ? 'value' : 'filter'));
      else if (e.key === 'c') setMode((m) => (m === 'color' ? 'value' : 'color'));
      else if (e.key === 'h') void askHint();
      else if (e.key === 'Enter') {
        if (tab === 'path') applyPath(1);
        else if (hint) applyHint();
      } else if (e.key === 'Escape') {
        setHint(null);
        setFilterDigit(0);
      } else if (e.key === 'z') update(undo);
      else if (e.key === 'y') update(redo);
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const s = selected ?? 40;
        const r = Math.floor(s / 9) + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0);
        const c = (s % 9) + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
        setSelected(Math.min(8, Math.max(0, r)) * 9 + Math.min(8, Math.max(0, c)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [input, selected, update, importing, settingsOpen, commandsOpen, puzzlesOpen, trainingOpen, extendedPrintOpen, askHint, applyHint, applyPath, hint, eraseSelected, tab]);

  const panel = (
    <SidePanel
      tab={tab}
      onTab={(t) => {
        setTab(t);
        setSnap((sn) => (sn === 'peek' ? 'half' : sn));
      }}
      hintLevel={hintLevel}
      onHintLevel={(l) => {
        setSettings((s) => ({ ...s, hintLevel: l }));
        setAllSteps(null);
        setHint(null);
      }}
    >
      {tab === 'hint' && (
        <HintView
          hint={hint}
          message={message}
          busy={busy}
          solved={solved}
          disabled={!game}
          onHint={() => void askHint()}
          onApply={applyHint}
          onDismiss={() => setHint(null)}
        />
      )}
      {tab === 'steps' && (
        <AllSteps
          data={allSteps}
          hintLevelName={hintLevel === 5 ? 'Everything' : HINT_LEVEL_NAMES[hintLevel]}
          selected={hint}
          busy={busy}
          disabled={!game || solved}
          onRefresh={() => void askAllSteps()}
          onSelect={setHint}
          onApply={applyHint}
        />
      )}
      {tab === 'path' && (
        <PathView
          steps={pathSteps}
          done={pathDone}
          busy={busy}
          disabled={!game}
          onNext={() => applyPath(1)}
          onSolveUpTo={applyUpTo}
          onRefresh={() => void askPath()}
        />
      )}
      {tab === 'summary' && <Summary game={game} />}
    </SidePanel>
  );

  const selCands = selected !== null && game && game.values[selected] === 0 ? [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => (game.cands[selected] & (1 << d)) !== 0) : [];
  // on the Path tab the board previews the next step of the solution path
  const boardHint = tab === 'path' ? (pathSteps?.[pathDone] ?? null) : hint;
  // coloring candidates needs to see them, so color mode turns them on for that target
  const showCandsNow = settings.showCands || (mode === 'color' && paintTarget === 'cand');

  return (
    <div className="shell">
      <TopBar
        badge={game ? { level: game.level, score: game.score } : null}
        filled={filled}
        seconds={seconds}
        busy={!!busy}
        canUndo={!!game?.past.length}
        canRedo={!!game?.future.length}
        mode={settings.gameMode}
        onMode={(m) => setSettings((s) => ({ ...s, gameMode: m }))}
        onTraining={() => setTrainingOpen(true)}
        onNew={(l) => void startNew(l)}
        onCancel={() => (solver.current.cancel(), setBusy(null))}
        onImport={() => (setImportError(null), setImporting(true))}
        onPuzzles={() => setPuzzlesOpen(true)}
        onCopy={(what) => void copyPuzzle(what)}
        onSave={(what) => void savePuzzle(what)}
        onPrint={() => window.print()}
        onPrintSolution={() => setPrintSolution(true)}
        onExtendedPrint={() => setExtendedPrintOpen(true)}
        onExportPng={() => void exportPng()}
        onUndo={() => update(undo)}
        onRedo={() => update(redo)}
        onRestart={() => update(restart)}
        canRestart={hasProgress}
        onSettings={() => setSettingsOpen(true)}
        onCommands={() => setCommandsOpen(true)}
      />

      <main className="stage">
        <section className="boardcol">
          {game && (
            <Board
              game={game}
              selected={selected}
              showCands={showCandsNow}
              hint={boardHint}
              wrong={wrong}
              filter={filterDigit}
              deviate={deviate}
              colorKu={settings.colorKu}
              colors={colorKuColors}
              cellColors={game.cellColors}
              candColors={game.candColors}
              palette={PALETTE}
              paintTarget={paintTargetNow}
              onPaintCell={onPaintCell}
              onPaintCand={onPaintCand}
              onSelect={setSelected}
            />
          )}
          {printSolution && game && <PrintSolution game={game} />}
          {bookPages && <BookPrint pages={bookPages.pages} layout={bookPages.layout} rating={bookPages.rating} />}
          {settings.cellZoom && game && (
            <CellZoom game={game} selected={selected} showCands={showCandsNow} colorKu={settings.colorKu} colors={colorKuColors} />
          )}
          <DigitPad
            mode={mode}
            onMode={setMode}
            left={left}
            filterDigit={filterDigit}
            disabled={!game}
            canErase={selected !== null && !!game && !isGiven(game, selected)}
            colorKu={settings.colorKu}
            colors={colorKuColors}
            palette={PALETTE}
            paintColor={paintColor}
            paintTarget={paintTarget}
            onPaintColor={setPaintColor}
            onPaintTarget={setPaintTarget}
            onClearColors={() => update(clearColors)}
            onDigit={input}
            onFilter={(d) => setFilterDigit((f) => (f === d ? 0 : d))}
            onErase={eraseSelected}
          />
          <div className="statusline" aria-live="polite">
            <span>
              {busy ?? (selected !== null ? `r${Math.floor(selected / 9) + 1}c${(selected % 9) + 1}${selCands.length ? ` · candidates ${selCands.join(' ')}` : ''}` : (message ?? 'Select a cell'))}
            </span>
            <span className="dim">
              Mark mistakes {settings.checkMistakes ? 'on' : 'off'} · show candidates {settings.showCands ? 'on' : 'off'}{mode === 'notes' ? ' · notes mode' : ''}{mode === 'color' ? ` · color mode (${paintTarget === 'cell' ? 'cells' : 'candidates'})` : ''}{settings.gameMode !== 'playing' ? ` · ${settings.gameMode} mode${trainingNames ? ` · training: ${trainingNames}` : ''}` : ''} · autosaved
            </span>
          </div>
        </section>
        <div className="sidecol">{panel}</div>
      </main>

      <div className="sheetcol">
        <BottomSheet snap={snap} onSnap={setSnap}>
          {panel}
        </BottomSheet>
      </div>

      {importing && (
        <ImportDialog
          text={importText}
          onText={setImportText}
          onFile={(file) => {
            setImportError(null);
            void readTextFile(file).then(setImportText, (e: unknown) => setImportError(e instanceof Error ? e.message : String(e)));
          }}
          error={importError}
          busy={!!busy}
          onLoad={() => void doImport()}
          onClose={() => setImporting(false)}
        />
      )}
      {settingsOpen && (
        <SettingsSheet
          settings={settings}
          onChange={setSettings}
          onResetNotes={() => update(fillCands)}
          onClearNotes={() => update(clearNotes)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {puzzlesOpen && (
        <PuzzlesDialog
          library={library}
          history={history}
          saves={saves}
          hasGame={!!game}
          suggestedName={game ? `${LEVEL_NAMES[game.level]} ${game.score}` : ''}
          onSaveCurrent={saveToLibrary}
          onOpen={openPuzzle}
          onDeleteLibrary={deleteLibrary}
          onDeleteHistory={deleteHistory}
          onClearHistory={clearHistory}
          onCreateSave={createSave}
          onRestoreSave={restoreSave}
          onDeleteSave={deleteSave}
          onClose={() => setPuzzlesOpen(false)}
        />
      )}
      {trainingOpen && <TrainingDialog settings={settings} onChange={setSettings} onClose={() => setTrainingOpen(false)} />}
      {extendedPrintOpen && (
        <ExtendedPrintDialog
          settings={settings}
          busy={!!busy}
          onPrint={(sections, layout, rating, booklet) => void printBook(sections, layout, rating, booklet)}
          onClose={() => setExtendedPrintOpen(false)}
        />
      )}
      {solvedOpen && game && (
        <SolvedDialog
          seconds={seconds}
          level={game.level}
          score={game.score}
          hints={game.hints ?? 0}
          busy={busy !== null}
          onNew={(l) => {
            setSolvedOpen(false);
            void startNew(l);
          }}
          onClose={() => setSolvedOpen(false)}
        />
      )}
      {commandsOpen && <CommandMenu commands={commands} onClose={() => setCommandsOpen(false)} />}
    </div>
  );
}

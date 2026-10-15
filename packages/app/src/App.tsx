import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultSolverSteps } from '@hodoku/core';
import { Board } from './Board';
import { boardSvg, downloadSvg } from './boardImage';
import { AllSteps } from './components/AllSteps';
import { BottomSheet, type Snap } from './components/BottomSheet';
import { CellZoom } from './components/CellZoom';
import { CommandMenu, type Command } from './components/CommandMenu';
import { DigitPad } from './components/DigitPad';
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
import {
  erase,
  fillCands,
  isGiven,
  isSolved,
  newGame,
  redo,
  remaining,
  removeCands,
  setValue,
  toggleCand,
  toggleNote,
  clearNotes,
  clearNotesAt,
  clearColors,
  paintCand,
  paintCell,
  autoFillLastDigit,
  undo,
  wrongCells,
  type GameState,
} from './game';
import { HINT_LEVEL_NAMES, LEVEL_NAMES, type CopyFormat, type HintLevel, type HintResult } from './protocol';
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

const SAVE_KEY = 'hodoku-revisited:game';
const SETTINGS_KEY = 'hodoku-revisited:settings';
const TIME_KEY = 'hodoku-revisited:time';

/** localStorage in the shape the store helpers want; they swallow the failures (private mode, quota). */
const localStorageStore: Store = {
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
};

/** Stable fallback so the "no technique disabled" case keeps the same array reference across renders. */
const NO_TECHNIQUES: string[] = [];

/** How hard each technique is (0 singles ... 5 extreme), for "Solve up to". */
const STEP_LEVEL = new Map<string, number>(defaultSolverSteps().map((c) => [c.type, c.level]));

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
  const [printSolution, setPrintSolution] = useState(false);
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

  const solved = game ? isSolved(game) : false;
  const hintLevel = settings.hintLevel ?? 5;
  const disabledTechniques = settings.disabledTechniques ?? NO_TECHNIQUES;
  const colorKuColors = settings.colorKuColors ?? DEFAULT_COLORKU_COLORS;

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
      setBusy(`Getting a ${LEVEL_NAMES[level]} puzzle...`);
      setMessage(null);
      try {
        const info = await solver.current.fromBank(level, settingsRef.current.seen?.[level] ?? []);
        if (info.bankIndex !== undefined) {
          const seen = settingsRef.current.seen ?? {};
          // once every puzzle of the level was played the bank picks from all of them again
          const played = [...new Set([...(seen[level] ?? []), info.bankIndex])];
          setSettings((s) => ({ ...s, seen: { ...seen, [level]: played } }));
        }
        startGame(newGame(info));
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
        // the digit keys pick a palette colour while colouring
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

  /** The Copy menu: put one of the text formats on the clipboard. Only the givens are made here. */
  const copyPuzzle = useCallback(
    async (what: CopyWhat) => {
      if (!game) return;
      const label: Record<CopyWhat, string> = {
        givens: 'givens',
        pm: 'puzzle with candidates',
        library: 'library line',
        formatted: 'formatted grid',
      };
      let text: string;
      try {
        if (what === 'givens') {
          text = game.givens;
        } else {
          const mode: CopyFormat = what === 'pm' ? 'PM_GRID' : what === 'library' ? 'LIBRARY' : 'CLUES_ONLY_FORMATTED';
          text = await solver.current.format(game.values, game.cands, mode);
        }
      } catch (e) {
        if (!isCancelled(e)) setMessage((e as Error).message);
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        setMessage(`Copied the ${label[what]}.`);
      } catch {
        // the clipboard can be blocked (insecure context): fall back to the text itself, but it is
        // only readable in the status line when it is short (the grid formats are many lines)
        setMessage(text.length <= 81 ? text : 'Copy failed.');
      }
    },
    [game],
  );

  /** Export the current board as a PNG (board only: grid, values, candidates, colours). */
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
    // in Colour mode Erase clears the colour of the selected cell
    if (mode === 'color') {
      update((g) => paintCell(g, selected, 0));
      return;
    }
    // in Notes mode on an empty cell, Erase clears the pencil marks you typed
    if (mode === 'notes' && !settingsRef.current.showCands && game?.values[selected] === 0) update((g) => clearNotesAt(g, selected));
    else update((g) => erase(g, selected));
  }, [selected, update, mode, game]);

  // colouring: while in Colour mode a click paints with the active colour
  const paintTargetNow = mode === 'color' ? paintTarget : null;
  const onPaintCell = useCallback((i: number) => update((g) => paintCell(g, i, paintColor)), [update, paintColor]);
  const onPaintCand = useCallback((i: number, d: number) => update((g) => paintCand(g, i, d, paintColor)), [update, paintColor]);

  const commands: Command[] = useMemo(
    () => [
      ...[1, 2, 3, 4, 5].map((l) => ({ label: `New puzzle: ${LEVEL_NAMES[l]}`, run: () => void startNew(l) })),
      { label: 'Get a hint', hint: 'H', run: () => void askHint(), disabled: !game || solved },
      { label: 'Find all steps', run: () => void askAllSteps(), disabled: !game || solved },
      { label: 'Show the solution path', run: () => { setTab('path'); setSnap((s) => (s === 'peek' ? 'half' : s)); }, disabled: !game },
      { label: 'Apply step', hint: 'Enter', run: () => (tab === 'path' ? applyPath(1) : applyHint()), disabled: tab === 'path' ? !(pathSteps && pathDone < pathSteps.length) : !hint },
      { label: 'Undo', hint: 'Z', run: () => update(undo), disabled: !game?.past.length },
      { label: 'Redo', hint: 'Y', run: () => update(redo), disabled: !game?.future.length },
      { label: 'Erase cell', run: eraseSelected, disabled: selected === null },
      { label: 'Value mode', run: () => setMode('value') },
      { label: 'Notes mode', hint: 'N', run: () => setMode('notes') },
      { label: 'Filter mode', hint: 'F', run: () => setMode('filter') },
      { label: 'Colour mode', hint: 'C', run: () => setMode('color') },
      { label: 'Clear colours', run: () => update(clearColors), disabled: !game?.cellColors && !game?.candColors },
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
      { label: 'Print', run: () => window.print() },
      { label: 'Print solution', run: () => setPrintSolution(true) },
      { label: 'Export PNG', run: () => void exportPng() },
      { label: 'Settings', run: () => setSettingsOpen(true) },
      ...['light', 'dark', 'system'].map((t) => ({ label: `Theme: ${t}`, run: () => setSettings((s) => ({ ...s, theme: t as Settings['theme'] })) })),
    ],
    [askAllSteps, askHint, applyHint, applyPath, copyPuzzle, eraseSelected, exportPng, filterDigit, game, hint, pathDone, pathSteps, selected, settings.checkMistakes, settings.showCands, settings.autoFill, settings.colorKu, settings.cellZoom, solved, startNew, tab, update],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandsOpen((o) => !o);
        return;
      }
      if (importing || settingsOpen || commandsOpen || puzzlesOpen || e.ctrlKey || e.metaKey) return;
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
  }, [input, selected, update, importing, settingsOpen, commandsOpen, puzzlesOpen, askHint, applyHint, applyPath, hint, eraseSelected, tab]);

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
  // colouring candidates needs to see them, so colour mode turns them on for that target
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
        onNew={(l) => void startNew(l)}
        onCancel={() => (solver.current.cancel(), setBusy(null))}
        onImport={() => (setImportError(null), setImporting(true))}
        onPuzzles={() => setPuzzlesOpen(true)}
        onCopy={(what) => void copyPuzzle(what)}
        onPrint={() => window.print()}
        onPrintSolution={() => setPrintSolution(true)}
        onExportPng={() => void exportPng()}
        onUndo={() => update(undo)}
        onRedo={() => update(redo)}
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
              Mark mistakes {settings.checkMistakes ? 'on' : 'off'} · show candidates {settings.showCands ? 'on' : 'off'}{mode === 'notes' ? ' · notes mode' : ''}{mode === 'color' ? ` · colour mode (${paintTarget === 'cell' ? 'cells' : 'candidates'})` : ''} · autosaved
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

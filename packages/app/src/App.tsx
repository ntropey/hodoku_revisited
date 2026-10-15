import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Board } from './Board';
import { AllSteps } from './components/AllSteps';
import { BottomSheet, type Snap } from './components/BottomSheet';
import { CommandMenu, type Command } from './components/CommandMenu';
import { DigitPad } from './components/DigitPad';
import { HintView } from './components/HintView';
import { ImportDialog } from './components/ImportDialog';
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
  undo,
  wrongCells,
  type GameState,
} from './game';
import { HINT_LEVEL_NAMES, LEVEL_NAMES, type HintResult } from './protocol';
import { SolverClient } from './solverClient';
import { DEFAULT_SETTINGS, type Mode, type Settings, type Tab } from './ui';

const SAVE_KEY = 'hodoku-revisited:game';
const SETTINGS_KEY = 'hodoku-revisited:settings';
const TIME_KEY = 'hodoku-revisited:time';

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
  const [hint, setHint] = useState<HintResult | null>(null);
  const [allSteps, setAllSteps] = useState<{ results: HintResult[]; total: Record<string, number> } | null>(null);
  const [tab, setTab] = useState<Tab>('hint');
  const [snap, setSnap] = useState<Snap>('peek');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [seconds, setSeconds] = useState(() => {
    const t = load<{ givens: string; seconds: number }>(TIME_KEY);
    const g = load<GameState>(SAVE_KEY);
    return t && g && t.givens === g.givens ? t.seconds : 0;
  });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const solver = useRef(new SolverClient());

  useEffect(() => {
    if (game) save(SAVE_KEY, game);
  }, [game]);
  useEffect(() => save(SETTINGS_KEY, settings), [settings]);
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const solved = game ? isSolved(game) : false;
  const hintLevel = settings.hintLevel ?? 5;

  // the completion dialog opens when this session solves the puzzle, not when a finished game is reloaded
  const [solvedOpen, setSolvedOpen] = useState(false);
  const wasSolved = useRef(solved);
  useEffect(() => {
    if (solved && !wasSolved.current) setSolvedOpen(true);
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
    setMessage(null);
  }, []);

  const update = useCallback(
    (fn: (g: GameState) => GameState) => {
      setGame((g) => (g ? fn(g) : g));
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
    setMessage(null);
    setSeconds(0);
    save(TIME_KEY, { givens: g.givens, seconds: 0 });
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
        if ((e as Error).message !== 'cancelled') setMessage((e as Error).message);
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
        .catch((e: Error) => setMessage(e.message))
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
      if (selected === null) return;
      if (mode === 'notes' && game.values[selected] === 0) update((g) => toggleCand(g, selected, d));
      else update((g) => setValue(g, selected, d));
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
      const h = await solver.current.hint(game.values, game.cands, hintLevel);
      setHint(h);
      setMessage(h ? null : hintLevel < 5 ? 'No hint at this hint level. Raise "Hints use" above.' : 'No logical hint found.');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, [game, hintLevel]);

  const askAllSteps = useCallback(async () => {
    if (!game) return;
    setTab('steps');
    setSnap((s) => (s === 'peek' ? 'half' : s));
    setBusy('Looking for all steps...');
    setHint(null);
    try {
      setAllSteps(await solver.current.allHints(game.values, game.cands, hintLevel));
      setMessage(null);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, [game, hintLevel]);

  const applyHint = useCallback(() => {
    if (!hint) return;
    update((g) => {
      let next = g;
      for (const p of hint.marks.place) next = setValue(next, p.cell, p.digit);
      if (hint.marks.elim.length > 0) next = removeCands(next, hint.marks.elim);
      return { ...next, hints: (g.hints ?? 0) + 1 };
    });
  }, [hint, update]);

  const doImport = async () => {
    setBusy('Checking puzzle...');
    setImportError(null);
    try {
      startGame(newGame(await solver.current.analyze(importText)));
      setImporting(false);
      setImportText('');
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const copyPuzzle = useCallback(async () => {
    if (!game) return;
    try {
      await navigator.clipboard.writeText(game.givens);
      setMessage('Puzzle copied.');
    } catch {
      setMessage(game.givens);
    }
  }, [game]);

  const eraseSelected = useCallback(() => {
    if (selected !== null) update((g) => erase(g, selected));
  }, [selected, update]);

  const commands: Command[] = useMemo(
    () => [
      ...[1, 2, 3, 4, 5].map((l) => ({ label: `New puzzle: ${LEVEL_NAMES[l]}`, run: () => void startNew(l) })),
      { label: 'Get a hint', hint: 'H', run: () => void askHint(), disabled: !game || solved },
      { label: 'Find all steps', run: () => void askAllSteps(), disabled: !game || solved },
      { label: 'Apply step', hint: 'Enter', run: applyHint, disabled: !hint },
      { label: 'Undo', hint: 'Z', run: () => update(undo), disabled: !game?.past.length },
      { label: 'Redo', hint: 'Y', run: () => update(redo), disabled: !game?.future.length },
      { label: 'Erase cell', run: eraseSelected, disabled: selected === null },
      { label: 'Value mode', run: () => setMode('value') },
      { label: 'Notes mode', hint: 'N', run: () => setMode('notes') },
      { label: 'Filter mode', hint: 'F', run: () => setMode('filter') },
      { label: 'Clear digit filter', run: () => setFilterDigit(0), disabled: filterDigit === 0 },
      { label: 'Reset notes', run: () => update(fillCands) },
      { label: `${settings.showCands ? 'Hide' : 'Show'} all candidates`, run: () => setSettings((s) => ({ ...s, showCands: !s.showCands })) },
      { label: `Mark mistakes: ${settings.checkMistakes ? 'turn off' : 'turn on'}`, run: () => setSettings((s) => ({ ...s, checkMistakes: !s.checkMistakes })) },
      { label: 'Import puzzle', run: () => setImporting(true) },
      { label: 'Copy puzzle', run: () => void copyPuzzle() },
      { label: 'Print', run: () => window.print() },
      { label: 'Settings', run: () => setSettingsOpen(true) },
      ...['light', 'dark', 'system'].map((t) => ({ label: `Theme: ${t}`, run: () => setSettings((s) => ({ ...s, theme: t as Settings['theme'] })) })),
    ],
    [askAllSteps, askHint, applyHint, copyPuzzle, eraseSelected, filterDigit, game, hint, selected, settings.checkMistakes, settings.showCands, solved, startNew, update],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandsOpen((o) => !o);
        return;
      }
      if (importing || settingsOpen || commandsOpen || e.ctrlKey || e.metaKey) return;
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
      else if (e.key === 'h') void askHint();
      else if (e.key === 'Enter' && hint) applyHint();
      else if (e.key === 'Escape') {
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
  }, [input, selected, update, importing, settingsOpen, commandsOpen, askHint, applyHint, hint, eraseSelected]);

  const panel = (
    <SidePanel tab={tab} onTab={setTab} hintLevel={hintLevel} onHintLevel={(l) => setSettings((s) => ({ ...s, hintLevel: l }))}>
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
      {tab === 'summary' && <Summary game={game} />}
    </SidePanel>
  );

  const selCands = selected !== null && game && game.values[selected] === 0 ? [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => (game.cands[selected] & (1 << d)) !== 0) : [];

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
        onCopy={() => void copyPuzzle()}
        onPrint={() => window.print()}
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
              showCands={settings.showCands}
              hint={hint}
              wrong={wrong}
              filter={filterDigit}
              onSelect={setSelected}
            />
          )}
          <DigitPad
            mode={mode}
            onMode={setMode}
            left={left}
            filterDigit={filterDigit}
            disabled={!game}
            canErase={selected !== null && !!game && !isGiven(game, selected)}
            onDigit={input}
            onFilter={(d) => setFilterDigit((f) => (f === d ? 0 : d))}
            onErase={eraseSelected}
          />
          <div className="statusline" aria-live="polite">
            <span>
              {busy ?? (selected !== null ? `r${Math.floor(selected / 9) + 1}c${(selected % 9) + 1}${selCands.length ? ` · candidates ${selCands.join(' ')}` : ''}` : (message ?? 'Select a cell'))}
            </span>
            <span className="dim">
              Mark mistakes {settings.checkMistakes ? 'on' : 'off'} · show candidates {settings.showCands ? 'on' : 'off'} · autosaved
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
          onClose={() => setSettingsOpen(false)}
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

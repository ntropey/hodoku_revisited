/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * The app shell: it owns the game, the settings and which dialog is open, and wires them to the pieces below.
 *   hooks/useNewGame      getting a puzzle (new by level, for training, from text, from the address)
 *   hooks/useSolverPanel  the side panel: hint, All steps, solution path, and the solver calls behind them
 *   hooks/useTimer        the play timer, saved with the puzzle
 *   hooks/useCollections  puzzle library, history and save points (localStorage)
 *   hooks/usePrinting     print solution, extended print and PNG export
 *   hooks/usePuzzleText   the Copy and Save formats
 *   hooks/useHotkeys      the keyboard shortcuts
 *   commands.ts           the Ctrl/Cmd+K command list;  game.ts: the pure game rules;  storage.ts: localStorage keys
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Board } from './Board';
import { BookPrint } from './components/BookPrint';
import { BottomSheet } from './components/BottomSheet';
import { CellZoom } from './components/CellZoom';
import { CommandMenu } from './components/CommandMenu';
import { DigitPad } from './components/DigitPad';
import { ExtendedPrintDialog } from './components/ExtendedPrintDialog';
import { ImportDialog } from './components/ImportDialog';
import { PrintSolution } from './components/PrintSolution';
import { PuzzlesDialog } from './components/PuzzlesDialog';
import { SettingsSheet } from './components/SettingsSheet';
import { SolvedDialog } from './components/SolvedDialog';
import { SolverPanel } from './components/SolverPanel';
import { StatusLine } from './components/StatusLine';
import { TopBar } from './components/TopBar';
import { TrainingDialog } from './components/TrainingDialog';
import { buildCommands } from './commands';
import { readTextFile } from './files';
import {
  autoFillLastDigit,
  clearColors,
  clearNotes,
  clearNotesAt,
  deviations,
  erase,
  fillCands,
  hiddenSingles,
  isGiven,
  isSolved,
  notesOf,
  paintCand,
  paintCell,
  redo,
  remaining,
  removeCands,
  restart,
  setValue,
  toggleCand,
  toggleNote,
  undo,
  wrongCells,
  type GameState,
} from './game';
import { useCollections } from './hooks/useCollections';
import { useHotkeys } from './hooks/useHotkeys';
import { useNewGame } from './hooks/useNewGame';
import { usePrinting } from './hooks/usePrinting';
import { usePuzzleText } from './hooks/usePuzzleText';
import { useSolverPanel } from './hooks/useSolverPanel';
import { useTimer } from './hooks/useTimer';
import { LEVEL_NAMES, type HintLevel, type HintResult } from './protocol';
import { isCancelled, SolverClient } from './solverClient';
import { load, save, SAVE_KEY, SETTINGS_KEY } from './storage';
import { STEP_LEVEL, TECHNIQUE_NAMES } from './techniqueLookup';
import { DEFAULT_COLORKU_COLORS, DEFAULT_SETTINGS, PALETTE, type Mode, type Settings } from './ui';

/** Stable fallback so the "no technique disabled" case keeps the same array reference across renders. */
const NO_TECHNIQUES: string[] = [];

export function App() {
  const [game, setGame] = useState<GameState | null>(() => load<GameState>(SAVE_KEY));
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...load<Settings>(SETTINGS_KEY) }));
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('value');
  const [filterDigit, setFilterDigit] = useState(0);
  const [paintColor, setPaintColor] = useState(1);
  const [paintTarget, setPaintTarget] = useState<'cell' | 'cand'>('cell');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [puzzlesOpen, setPuzzlesOpen] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [solvedOpen, setSolvedOpen] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const solver = useRef(new SolverClient());

  const solved = game ? isSolved(game) : false;
  const hintLevel = settings.hintLevel ?? 5;
  const disabledTechniques = settings.disabledTechniques ?? NO_TECHNIQUES;
  const colorKuColors = settings.colorKuColors ?? DEFAULT_COLORKU_COLORS;
  const trainingNames = (settings.trainingTechniques ?? []).map((t) => TECHNIQUE_NAMES.get(t) ?? t).join(', ');

  const { seconds, secondsRef, resetTimer } = useTimer(game, solved);
  const collections = useCollections();
  const panel = useSolverPanel({ game, solved, solver, hintLevel, disabledTechniques, busy, setBusy, setMessage });
  const { hint, setHint, coachStep, setCoachStep, proof, setProof, proofStep, setProofStep, pathSteps, pathDone, setPathDone, tab, clearPanel } = panel;
  const printing = usePrinting({ solver, settingsRef, setBusy, setMessage });
  const { copyPuzzle, savePuzzle } = usePuzzleText(game, solver, setMessage);

  // autosave the game and the settings; the theme setting is applied to the page
  useEffect(() => {
    if (game) save(SAVE_KEY, game);
  }, [game]);
  useEffect(() => save(SETTINGS_KEY, settings), [settings]);
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // leaving Filter mode switches the filter off
  const prevMode = useRef(mode);
  useEffect(() => {
    if (prevMode.current === 'filter' && mode !== 'filter') setFilterDigit(0);
    prevMode.current = mode;
  }, [mode]);

  // the completion dialog opens when this session solves the puzzle, not when a finished game is reloaded
  const wasSolved = useRef(solved);
  useEffect(() => {
    if (solved && !wasSolved.current) {
      setSolvedOpen(true);
      collections.markSolved(game?.givens, secondsRef.current);
    }
    if (!solved) setSolvedOpen(false);
    wasSolved.current = solved;
  }, [solved]);

  /** Change the game (a move, an undo, a tool); the side panel starts over because its steps no longer fit. */
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

  const startGame = useCallback(
    (g: GameState) => {
      setGame(g);
      setSelected(null);
      setFilterDigit(0);
      clearPanel();
      resetTimer(g.givens);
      collections.recordStart(g);
    },
    [clearPanel, resetTimer, collections.recordStart],
  );

  const { startNew, startFromText } = useNewGame({ solver, settingsRef, setSettings, setBusy, setMessage, startGame, hasGame: !!game });

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
    [game, pathSteps, pathDone, setPathDone],
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
      await startFromText(importText);
      setImporting(false);
      setImportText('');
    } catch (e) {
      if (!isCancelled(e)) setImportError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  /** Load a puzzle from the library or the history: rate it, then start a fresh game from it. */
  const openPuzzle = useCallback(
    (puzzle: string) => {
      setPuzzlesOpen(false);
      setBusy('Checking puzzle...');
      startFromText(puzzle)
        .catch((e: Error) => {
          if (!isCancelled(e)) setMessage(e.message);
        })
        .finally(() => setBusy(null));
    },
    [startFromText],
  );

  /** Restore a save point: a fresh game state, so undo cannot cross the restore. */
  const restoreSave = useCallback(
    (id: string) => {
      const sp = collections.saves.find((s) => s.id === id);
      if (!sp) return;
      const restored = { ...sp.game, past: [], future: [] } as GameState;
      setGame(restored);
      wasSolved.current = isSolved(restored);
      resetTimer(sp.game.givens, sp.seconds);
      clearPanel();
      setSelected(null);
      setPuzzlesOpen(false);
    },
    [collections.saves, clearPanel, resetTimer],
  );

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

  const toggleFilter = useCallback((d: number) => setFilterDigit((f) => (f === d ? 0 : d)), []);
  const applyStep = () => (tab === 'path' ? applyPath(1) : applyHint());
  const pathHasNext = !!(pathSteps && pathDone < pathSteps.length);

  useHotkeys({
    blocked: importing || settingsOpen || commandsOpen || puzzlesOpen || trainingOpen || printing.extendedPrintOpen,
    tab,
    selected,
    hasHint: !!(hint || proof),
    toggleCommands: () => setCommandsOpen((o) => !o),
    input,
    eraseSelected,
    setMode,
    toggleFilter,
    clearFilter: () => setFilterDigit(0),
    dismissHint: () => {
      setHint(null);
      setCoachStep(null);
      setProof(null);
    },
    askHint: () => void panel.askHint(),
    applyHint,
    applyPathStep: () => applyPath(1),
    undo: () => update(undo),
    redo: () => update(redo),
    select: setSelected,
  });

  const panelNode = (
    <SolverPanel
      tab={tab}
      onTab={panel.openTab}
      game={game}
      selected={selected}
      solved={solved}
      busy={busy}
      message={message}
      hintLevel={hintLevel}
      onHintLevel={(l) => {
        setSettings((s) => ({ ...s, hintLevel: l }));
        panel.invalidateSteps();
      }}
      hint={hint}
      coachStep={coachStep}
      onCoachStep={setCoachStep}
      proof={proof}
      proofStep={proofStep}
      onProofStep={setProofStep}
      onDismissProof={() => setProof(null)}
      onProve={(cell, d) => void panel.askProof(cell, d)}
      onHint={(startInCoach) => void panel.askHint(startInCoach)}
      onApplyHint={applyHint}
      onDismissHint={() => {
        setHint(null);
        setCoachStep(null);
      }}
      onSelectStep={(h) => {
        setHint(h);
        setCoachStep(null);
      }}
      allSteps={panel.allSteps}
      onRefreshSteps={() => void panel.askAllSteps()}
      pathSteps={pathSteps}
      pathDone={pathDone}
      onNextStep={() => applyPath(1)}
      onSolveUpTo={applyUpTo}
      onRefreshPath={() => void panel.askPath()}
    />
  );

  // What the board highlights: on the Path tab the next path step; during an AI Coach proof or walkthrough, that stage's marks
  const boardHint = useMemo<HintResult | null>(() => {
    if (tab === 'path') return pathSteps?.[pathDone] ?? null;
    if (tab === 'hint' && proof) {
      const stage = proof.stages[proofStep] ?? proof.stages[proof.stages.length - 1];
      if (!stage) return null;
      return { name: stage.label, type: 'PROOF', text: stage.text, summary: '', slug: null, marks: stage.marks, notation: [] };
    }
    if (hint && coachStep !== null && hint.coach?.[coachStep]) {
      return { ...hint, marks: hint.coach[coachStep].marks };
    }
    return hint;
  }, [tab, pathSteps, pathDone, proof, proofStep, hint, coachStep]);

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
        onPrintSolution={() => printing.setPrintSolution(true)}
        onExtendedPrint={() => printing.setExtendedPrintOpen(true)}
        onExportPng={() => void printing.exportPng(game)}
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
          {printing.printSolution && game && <PrintSolution game={game} />}
          {printing.bookPages && <BookPrint pages={printing.bookPages.pages} layout={printing.bookPages.layout} rating={printing.bookPages.rating} />}
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
            onFilter={toggleFilter}
            onErase={eraseSelected}
          />
          <StatusLine game={game} selected={selected} busy={busy} message={message} mode={mode} paintTarget={paintTarget} settings={settings} trainingNames={trainingNames} />
        </section>
        <div className="sidecol">{panelNode}</div>
      </main>

      <div className="sheetcol">
        <BottomSheet snap={panel.snap} onSnap={panel.setSnap}>
          {panelNode}
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
          library={collections.library}
          history={collections.history}
          saves={collections.saves}
          hasGame={!!game}
          suggestedName={game ? `${LEVEL_NAMES[game.level]} ${game.score}` : ''}
          onSaveCurrent={(name) => game && collections.saveToLibrary(game, name)}
          onOpen={openPuzzle}
          onDeleteLibrary={collections.deleteLibrary}
          onDeleteHistory={collections.deleteHistory}
          onClearHistory={collections.clearHistory}
          onCreateSave={(name) => game && collections.createSave(game, seconds, name)}
          onRestoreSave={restoreSave}
          onDeleteSave={collections.deleteSave}
          onClose={() => setPuzzlesOpen(false)}
        />
      )}
      {trainingOpen && <TrainingDialog settings={settings} onChange={setSettings} onClose={() => setTrainingOpen(false)} />}
      {printing.extendedPrintOpen && (
        <ExtendedPrintDialog
          settings={settings}
          busy={!!busy}
          onPrint={(sections, layout, rating, booklet) => void printing.printBook(sections, layout, rating, booklet)}
          onClose={() => printing.setExtendedPrintOpen(false)}
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
      {commandsOpen && (
        <CommandMenu
          commands={buildCommands({
            game,
            solved,
            settings,
            tab,
            hint,
            pathHasNext,
            selected,
            filterDigit,
            hasProgress,
            hasOwnValues,
            hasHiddenSingle,
            update,
            setSettings,
            setMode,
            clearFilter: () => setFilterDigit(0),
            startNew: (l) => void startNew(l),
            openTraining: () => setTrainingOpen(true),
            askHint: () => void panel.askHint(false),
            askCoach: () => void panel.askHint(true),
            askAllSteps: () => void panel.askAllSteps(),
            showPath: () => panel.openTab('path'),
            applyStep,
            eraseSelected,
            openImport: () => setImporting(true),
            openPuzzles: () => setPuzzlesOpen(true),
            copyPuzzle: (w) => void copyPuzzle(w),
            savePuzzle: (w) => void savePuzzle(w),
            printBoard: () => window.print(),
            printSolution: () => printing.setPrintSolution(true),
            openExtendedPrint: () => printing.setExtendedPrintOpen(true),
            exportPng: () => void printing.exportPng(game),
            openSettings: () => setSettingsOpen(true),
          })}
          onClose={() => setCommandsOpen(false)}
        />
      )}
    </div>
  );
}

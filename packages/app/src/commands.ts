import type { Command } from './components/CommandMenu';
import { clearColors, clearNotes, fillCands, fillHiddenSingles, redo, restart, setGivens, undo, type GameState } from './game';
import { LEVEL_NAMES, type HintResult } from './protocol';
import type { CopyWhat, GameMode, Mode, Settings, Tab } from './ui';

/** What the command list needs to know and to do; App provides it. */
export interface CommandContext {
  game: GameState | null;
  solved: boolean;
  settings: Settings;
  tab: Tab;
  hint: HintResult | null;
  /** the solution path has a step left to apply */
  pathHasNext: boolean;
  selected: number | null;
  filterDigit: number;
  hasProgress: boolean;
  hasOwnValues: boolean;
  hasHiddenSingle: boolean;
  update: (fn: (g: GameState) => GameState) => void;
  setSettings: (fn: (s: Settings) => Settings) => void;
  setMode: (m: Mode) => void;
  clearFilter: () => void;
  startNew: (level: number) => void;
  startDaily?: () => void;
  openTraining: () => void;
  askHint: () => void;
  askCoach?: () => void;
  askAllSteps: () => void;
  showPath: () => void;
  applyStep: () => void;
  eraseSelected: () => void;
  openImport: () => void;
  openPuzzles: () => void;
  copyPuzzle: (what: CopyWhat) => void;
  savePuzzle: (what: CopyWhat) => void;
  printBoard: () => void;
  printSolution: () => void;
  openExtendedPrint: () => void;
  exportPng: () => void;
  openSettings: () => void;
}

const FORMATS: [CopyWhat, string][] = [
  ['givens', 'givens'],
  ['pm', 'puzzle with candidates'],
  ['library', 'library line'],
  ['formatted', 'formatted grid'],
];
const SAVE_LABELS: Record<CopyWhat, string> = { givens: 'givens', pm: 'candidates', library: 'library line', formatted: 'formatted grid' };

/** The command search (Ctrl/Cmd+K): every action of the app, with its shortcut where it has one. */
export function buildCommands(c: CommandContext): Command[] {
  const { game, settings } = c;
  const toggle = (label: string, on: boolean, key: 'showCands' | 'checkMistakes' | 'autoFill' | 'colorKu' | 'cellZoom'): Command => ({
    label: label.replace('{state}', on ? 'turn off' : 'turn on'),
    run: () => c.setSettings((s) => ({ ...s, [key]: !s[key] })),
  });
  return [
    { label: 'Daily puzzle (today)', run: () => (c.startDaily ? c.startDaily() : c.startNew(2)) },
    ...[1, 2, 3, 4, 5].map((l) => ({ label: `New puzzle: ${LEVEL_NAMES[l]}`, run: () => c.startNew(l) })),
    { label: 'Playing mode', run: () => c.setSettings((s) => ({ ...s, gameMode: 'playing' as GameMode })) },
    { label: 'Learning mode…', run: c.openTraining },
    { label: 'Practicing mode…', run: c.openTraining },
    { label: 'Training techniques…', run: c.openTraining },
    { label: 'Get a hint', hint: 'H', run: c.askHint, disabled: !game || c.solved },
    { label: 'Coach me (step-by-step hint)', run: () => (c.askCoach ? c.askCoach() : c.askHint()), disabled: !game || c.solved },
    { label: 'Find all steps', run: c.askAllSteps, disabled: !game || c.solved },
    { label: 'Show the solution path', run: c.showPath, disabled: !game },
    { label: 'Apply step', hint: 'Enter', run: c.applyStep, disabled: c.tab === 'path' ? !c.pathHasNext : !c.hint },
    { label: 'Undo', hint: 'Z', run: () => c.update(undo), disabled: !game?.past.length },
    { label: 'Redo', hint: 'Y', run: () => c.update(redo), disabled: !game?.future.length },
    { label: 'Restart game', run: () => c.update(restart), disabled: !c.hasProgress },
    { label: 'Set givens', run: () => c.update(setGivens), disabled: !c.hasOwnValues },
    { label: 'Fill all hidden singles', run: () => c.update(fillHiddenSingles), disabled: !c.hasHiddenSingle },
    { label: 'Erase cell', run: c.eraseSelected, disabled: c.selected === null },
    { label: 'Value mode', run: () => c.setMode('value') },
    { label: 'Notes mode', hint: 'N', run: () => c.setMode('notes') },
    { label: 'Filter mode', hint: 'F', run: () => c.setMode('filter') },
    { label: 'Color mode', hint: 'C', run: () => c.setMode('color') },
    { label: 'Clear colors', run: () => c.update(clearColors), disabled: !game?.cellColors && !game?.candColors },
    { label: 'Clear digit filter', run: c.clearFilter, disabled: c.filterDigit === 0 },
    { label: 'Clear pencil marks', run: () => c.update(clearNotes) },
    { label: 'Reset candidates', run: () => c.update(fillCands) },
    { label: `${settings.showCands ? 'Hide' : 'Show'} all candidates`, run: () => c.setSettings((s) => ({ ...s, showCands: !s.showCands })) },
    toggle('Mark mistakes: {state}', settings.checkMistakes, 'checkMistakes'),
    toggle('Auto-fill last digit: {state}', !!settings.autoFill, 'autoFill'),
    toggle('ColorKu: {state}', !!settings.colorKu, 'colorKu'),
    toggle('Cell zoom: {state}', !!settings.cellZoom, 'cellZoom'),
    { label: 'Import puzzle', run: c.openImport },
    { label: 'Open puzzles…', run: c.openPuzzles },
    ...FORMATS.map(([w, l]) => ({ label: `Copy ${l}`, run: () => c.copyPuzzle(w) })),
    ...FORMATS.map(([w]) => ({ label: `Save puzzle: ${SAVE_LABELS[w]}`, run: () => c.savePuzzle(w) })),
    { label: 'Print', run: c.printBoard },
    { label: 'Print solution', run: c.printSolution },
    { label: 'Extended print…', run: c.openExtendedPrint },
    { label: 'Export PNG', run: c.exportPng },
    { label: 'Settings', run: c.openSettings },
    ...(['light', 'dark', 'system'] as const).map((t) => ({ label: `Theme: ${t}`, run: () => c.setSettings((s) => ({ ...s, theme: t })) })),
  ];
}

import { describe, expect, it } from 'vitest';
import { buildCommands, type CommandContext } from '../src/commands';
import { newGame } from '../src/game';
import { analyze } from '../src/solverApi';
import { DEFAULT_SETTINGS, type Settings } from '../src/ui';

const PUZZLE = '97....4..2..4718.3........5....5..8.5.1.4.2.9.4..8....8........3.9762..8..5....67';

function context(over: Partial<CommandContext> = {}): { ctx: CommandContext; calls: string[]; settings: () => Settings } {
  const calls: string[] = [];
  let settings = { ...DEFAULT_SETTINGS };
  const note = (name: string) => () => void calls.push(name);
  const ctx: CommandContext = {
    game: newGame(analyze(PUZZLE)),
    solved: false,
    get settings() {
      return settings;
    },
    tab: 'hint',
    hint: null,
    pathHasNext: false,
    selected: null,
    filterDigit: 0,
    hasProgress: false,
    hasOwnValues: false,
    hasHiddenSingle: true,
    update: note('update'),
    setSettings: (fn) => {
      settings = fn(settings);
    },
    setMode: (m) => void calls.push(`mode:${m}`),
    clearFilter: note('clearFilter'),
    startNew: (l) => void calls.push(`new:${l}`),
    startDaily: note('daily'),
    openTraining: note('training'),
    askHint: note('hint'),
    askCoach: note('coach'),
    askAllSteps: note('allSteps'),
    showPath: note('path'),
    applyStep: note('apply'),
    eraseSelected: note('erase'),
    openImport: note('import'),
    openPuzzles: note('puzzles'),
    copyPuzzle: (w) => void calls.push(`copy:${w}`),
    savePuzzle: (w) => void calls.push(`save:${w}`),
    printBoard: note('print'),
    printSolution: note('printSolution'),
    openExtendedPrint: note('extended'),
    exportPng: note('png'),
    openSettings: note('settings'),
    ...over,
  };
  return { ctx, calls, settings: () => settings };
}

const byLabel = (cmds: ReturnType<typeof buildCommands>, label: string) => {
  const c = cmds.find((x) => x.label === label);
  if (!c) throw new Error(`no command "${label}"`);
  return c;
};

describe('command list', () => {
  it('has unique labels, all runnable', () => {
    const cmds = buildCommands(context().ctx);
    expect(new Set(cmds.map((c) => c.label)).size).toBe(cmds.length);
    expect(cmds.every((c) => typeof c.run === 'function')).toBe(true);
  });

  it('offers a command only when it would do something', () => {
    const idle = buildCommands(context().ctx);
    expect(byLabel(idle, 'Restart game').disabled).toBe(true);
    expect(byLabel(idle, 'Set givens').disabled).toBe(true);
    expect(byLabel(idle, 'Erase cell').disabled).toBe(true);
    expect(byLabel(idle, 'Apply step').disabled).toBe(true);
    expect(byLabel(idle, 'Fill all hidden singles').disabled).toBe(false);
    const busy = buildCommands(context({ hasProgress: true, hasOwnValues: true, selected: 4, hint: {} as never }).ctx);
    expect(byLabel(busy, 'Restart game').disabled).toBe(false);
    expect(byLabel(busy, 'Set givens').disabled).toBe(false);
    expect(byLabel(busy, 'Erase cell').disabled).toBe(false);
    expect(byLabel(busy, 'Apply step').disabled).toBe(false);
    const solved = buildCommands(context({ solved: true }).ctx);
    expect(byLabel(solved, 'Get a hint').disabled).toBe(true);
    expect(byLabel(solved, 'Coach me (step-by-step hint)').disabled).toBe(true);
  });

  it('the apply command follows the open tab', () => {
    const onPath = buildCommands(context({ tab: 'path', pathHasNext: true }).ctx);
    expect(byLabel(onPath, 'Apply step').disabled).toBe(false);
    const onPathDone = buildCommands(context({ tab: 'path', pathHasNext: false, hint: {} as never }).ctx);
    expect(byLabel(onPathDone, 'Apply step').disabled).toBe(true);
  });

  it('runs what it says', () => {
    const { ctx, calls } = context();
    const cmds = buildCommands(ctx);
    byLabel(cmds, 'Daily puzzle (today)').run();
    byLabel(cmds, 'New puzzle: Hard').run();
    byLabel(cmds, 'Copy library line').run();
    byLabel(cmds, 'Save puzzle: candidates').run();
    byLabel(cmds, 'Notes mode').run();
    byLabel(cmds, 'Practicing mode…').run();
    byLabel(cmds, 'Coach me (step-by-step hint)').run();
    expect(calls).toEqual(['daily', 'new:3', 'copy:library', 'save:pm', 'mode:notes', 'training', 'coach']);
  });

  it('toggles settings and names the state it will switch to', () => {
    const { ctx, settings } = context();
    expect(byLabel(buildCommands(ctx), 'Auto-fill last digit: turn on')).toBeTruthy();
    byLabel(buildCommands(ctx), 'Auto-fill last digit: turn on').run();
    expect(settings().autoFill).toBe(true);
    expect(byLabel(buildCommands(ctx), 'Auto-fill last digit: turn off')).toBeTruthy();
    byLabel(buildCommands(ctx), 'Show all candidates').run();
    expect(settings().showCands).toBe(true);
    byLabel(buildCommands(ctx), 'Theme: dark').run();
    expect(settings().theme).toBe('dark');
  });
});

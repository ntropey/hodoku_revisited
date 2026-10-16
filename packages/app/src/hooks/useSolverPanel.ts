import { useCallback, useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Snap } from '../components/BottomSheet';
import type { GameState } from '../game';
import type { HintLevel, HintResult } from '../protocol';
import { isCancelled, type SolverClient } from '../solverClient';
import type { Tab } from '../ui';

interface Deps {
  game: GameState | null;
  solved: boolean;
  solver: RefObject<SolverClient>;
  hintLevel: HintLevel;
  disabledTechniques: string[];
  busy: string | null;
  setBusy: Dispatch<SetStateAction<string | null>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
}

type AllSteps = { results: HintResult[]; total: Record<string, number> };

/**
 * The side panel's state and the solver calls behind its tabs: the current hint, the All steps list and the
 * solution path, and which tab is open (and how far the phone's bottom sheet is pulled up).
 */
export function useSolverPanel({ game, solved, solver, hintLevel, disabledTechniques, busy, setBusy, setMessage }: Deps) {
  const [hint, setHint] = useState<HintResult | null>(null);
  const [allSteps, setAllSteps] = useState<AllSteps | null>(null);
  const [pathSteps, setPathSteps] = useState<HintResult[] | null>(null);
  const [pathDone, setPathDone] = useState(0);
  const [tab, setTab] = useState<Tab>('hint');
  const [snap, setSnap] = useState<Snap>('peek');

  /** Throw away everything the panel shows (after a move or a new game). */
  const clearPanel = useCallback(() => {
    setHint(null);
    setAllSteps(null);
    setPathSteps(null);
    setPathDone(0);
    setMessage(null);
  }, [setMessage]);

  /** Throw away the hint and the All steps list only (a setting that changes what a hint may be). */
  const invalidateSteps = useCallback(() => {
    setAllSteps(null);
    setHint(null);
  }, []);

  /** Open a tab; on a phone a collapsed sheet opens halfway so the content is visible. */
  const openTab = useCallback((t: Tab) => {
    setTab(t);
    setSnap((s) => (s === 'peek' ? 'half' : s));
  }, []);

  const askHint = useCallback(async () => {
    if (!game) return;
    openTab('hint');
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
  }, [game, hintLevel, disabledTechniques, solver, openTab, setBusy, setMessage]);

  const askAllSteps = useCallback(
    async (auto = false) => {
      if (!game) return;
      if (auto) setTab('steps');
      else openTab('steps');
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
    [game, hintLevel, disabledTechniques, solver, openTab, setBusy, setMessage],
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
  }, [game, solver, setBusy, setMessage]);

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

  return {
    hint,
    setHint,
    allSteps,
    pathSteps,
    pathDone,
    setPathDone,
    tab,
    snap,
    setSnap,
    openTab,
    clearPanel,
    invalidateSteps,
    askHint,
    askAllSteps,
    askPath,
  };
}

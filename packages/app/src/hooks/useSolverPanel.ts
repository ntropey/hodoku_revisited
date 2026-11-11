import { useCallback, useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Snap } from '../components/BottomSheet';
import { candidateContradictions, stepContradictsSolution, wrongCells, type GameState } from '../game';
import type { HintLevel, HintResult, ProofResult } from '../protocol';
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
 * The side panel's state and the solver calls behind its tabs: the current hint (and AI Coach walkthrough stage),
 * "Why not?" contradiction proofs, the All steps list and the solution path, and which tab is open.
 */
export function useSolverPanel({ game, solved, solver, hintLevel, disabledTechniques, busy, setBusy, setMessage }: Deps) {
  const [hint, setHint] = useState<HintResult | null>(null);
  const [coachStep, setCoachStep] = useState<number | null>(null);
  const [proof, setProof] = useState<ProofResult | null>(null);
  const [proofStep, setProofStep] = useState(0);
  const [allSteps, setAllSteps] = useState<AllSteps | null>(null);
  const [pathSteps, setPathSteps] = useState<HintResult[] | null>(null);
  const [pathDone, setPathDone] = useState(0);
  const [tab, setTab] = useState<Tab>('hint');
  const [snap, setSnap] = useState<Snap>('peek');

  /** Throw away everything the panel shows (after a move or a new game). */
  const clearPanel = useCallback(() => {
    setHint(null);
    setCoachStep(null);
    setProof(null);
    setProofStep(0);
    setAllSteps(null);
    setPathSteps(null);
    setPathDone(0);
    setMessage(null);
  }, [setMessage]);

  /** Throw away the hint and the All steps list only (a setting that changes what a hint may be). */
  const invalidateSteps = useCallback(() => {
    setAllSteps(null);
    setHint(null);
    setCoachStep(null);
    setProof(null);
  }, []);

  /** Open a tab; on a phone tapping the already-active tab toggles the sheet closed/open. */
  const openTab = useCallback(
    (t: Tab, toggleIfSame = false) => {
      setTab((prev) => {
        if (toggleIfSame && prev === t) {
          setSnap((s) => (s === 'peek' ? 'half' : 'peek'));
        } else {
          setSnap((s) => (s === 'peek' ? 'half' : s));
        }
        return t;
      });
    },
    [],
  );

  const askHint = useCallback(
    async (startInCoach = false) => {
      if (!game) return;
      openTab('hint');
      if (wrongCells(game).length > 0) {
        setHint(null);
        setCoachStep(null);
        setProof(null);
        setMessage('The board contains incorrect digits. Correct mistakes before requesting a hint.');
        return;
      }
      if (candidateContradictions(game).length > 0) {
        setHint(null);
        setCoachStep(null);
        setProof(null);
        setMessage('Candidate marks contradict the solution. Reset candidates to get accurate hints.');
        return;
      }
      setBusy(startInCoach ? 'AI Coach is analyzing the board...' : 'Looking for a hint...');
      setMessage(null);
      setProof(null);
      try {
        const h = await solver.current.hint(game.values, game.cands, hintLevel, disabledTechniques, game.solution);
        if (h && stepContradictsSolution(h, game.solution)) {
          setHint(null);
          setCoachStep(null);
          setMessage('Candidate marks contradict the solution. Reset candidates to get accurate hints.');
          return;
        }
        setHint(h);
        setCoachStep(h && startInCoach && h.coach?.length ? 0 : null);
        setMessage(h ? null : hintLevel < 5 ? 'No hint at this hint level. Raise "Hints use" above.' : 'No logical hint found.');
      } catch (e) {
        if (!isCancelled(e)) setMessage((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [game, hintLevel, disabledTechniques, solver, openTab, setBusy, setMessage],
  );

  /** Ask the AI Coach why `digit` cannot go in `cell` (or verify whether it is valid). */
  const askProof = useCallback(
    async (cell: number, digit: number) => {
      if (!game) return;
      openTab('hint');
      if (wrongCells(game).length > 0) {
        setMessage('The board contains incorrect digits. Correct mistakes before testing candidates.');
        return;
      }
      if (candidateContradictions(game).length > 0) {
        setMessage('Candidate marks contradict the solution. Reset candidates before testing candidates.');
        return;
      }
      setBusy('Tracing consequences...');
      setMessage(null);
      try {
        const p = await solver.current.prove(game.values, game.cands, cell, digit);
        setProof(p);
        setProofStep(Math.max(0, p.stages.length - 1));
      } catch (e) {
        if (!isCancelled(e)) setMessage((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [game, solver, openTab, setBusy, setMessage],
  );

  const askAllSteps = useCallback(
    async (auto = false) => {
      if (!game) return;
      if (auto) setTab('steps');
      else openTab('steps');
      if (wrongCells(game).length > 0) {
        setAllSteps({ results: [], total: {} });
        setHint(null);
        setMessage('The board contains incorrect digits. Correct mistakes before looking for steps.');
        return;
      }
      if (candidateContradictions(game).length > 0) {
        setAllSteps({ results: [], total: {} });
        setHint(null);
        setMessage('Candidate marks contradict the solution. Reset candidates to get accurate steps.');
        return;
      }
      setBusy('Looking for all steps...');
      try {
        const data = await solver.current.allHints(game.values, game.cands, hintLevel, disabledTechniques, game.solution);
        const validResults = data.results.filter((s) => !stepContradictsSolution(s, game.solution));
        const filteredTotal = { ...data.total };
        for (const r of data.results) {
          if (stepContradictsSolution(r, game.solution) && filteredTotal[r.name]) {
            filteredTotal[r.name]--;
            if (filteredTotal[r.name] <= 0) delete filteredTotal[r.name];
          }
        }
        setAllSteps({ results: validResults, total: filteredTotal });
        // the top step is shown on the board right away
        setHint(validResults[0] ?? null);
        setCoachStep(null);
        setProof(null);
        setMessage(validResults.length === 0 ? 'No logical steps found.' : null);
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
    if (wrongCells(game).length > 0) {
      setPathSteps(null);
      setMessage('The board contains incorrect digits. Correct mistakes to view the solution path.');
      return;
    }
    if (candidateContradictions(game).length > 0) {
      setPathSteps(null);
      setMessage('Candidate marks contradict the solution. Reset candidates to view the solution path.');
      return;
    }
    setBusy('Finding the solution path...');
    setMessage(null);
    try {
      const steps = await solver.current.path(game.values, game.cands, game.solution);
      if (steps.some((s) => stepContradictsSolution(s, game.solution))) {
        setPathSteps([]);
        setMessage('Candidate marks contradict the solution. Reset candidates to view the solution path.');
        return;
      }
      setPathSteps(steps);
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
    setCoachStep(null);
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
    coachStep,
    setCoachStep,
    proof,
    setProof,
    proofStep,
    setProofStep,
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
    askProof,
    askAllSteps,
    askPath,
  };
}

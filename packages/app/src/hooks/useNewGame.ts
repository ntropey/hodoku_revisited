import { useCallback, useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { newGame, type GameState } from '../game';
import { LEVEL_NAMES, type PuzzleInfo } from '../protocol';
import { isCancelled, type SolverClient } from '../solverClient';
import { TECHNIQUE_NAMES } from '../techniqueLookup';
import type { Settings } from '../ui';
import { levelFromSearch, puzzleFromSearch } from '../urlParams';

interface Deps {
  solver: RefObject<SolverClient>;
  settingsRef: RefObject<Settings>;
  setSettings: Dispatch<SetStateAction<Settings>>;
  setBusy: Dispatch<SetStateAction<string | null>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
  /** begin a game from a rated puzzle */
  startGame: (g: GameState) => void;
  /** the saved game that is already there, if any */
  hasGame: boolean;
}

/** Getting a puzzle: a new one by level (from the bank or built for training), one rated from text, and what to do on start. */
export function useNewGame({ solver, settingsRef, setSettings, setBusy, setMessage, startGame, hasGame }: Deps) {
  /** Rate a puzzle given as text, then start a game from it. */
  const startFromText = useCallback(
    async (text: string) => {
      startGame(newGame(await solver.current.analyze(text)));
    },
    [solver, startGame],
  );

  const startNew = useCallback(
    async (level: number) => {
      solver.current.cancel();
      setSettings((s) => ({ ...s, level }));
      setMessage(null);
      const gameMode = settingsRef.current.gameMode;
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
        if (gameMode !== 'playing' && techniques.length > 0) {
          setBusy(`Looking for a ${names} puzzle...`);
          const info = await solver.current.train(level, techniques, gameMode === 'learning', seen);
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
    [solver, settingsRef, setSettings, setBusy, setMessage, startGame],
  );

  // first start: a puzzle from the address, a level from the address, the saved game, or a new one
  useEffect(() => {
    const p = puzzleFromSearch(window.location.search);
    const lv = levelFromSearch(window.location.search);
    if (lv) {
      window.history.replaceState(null, '', window.location.pathname);
      void startNew(lv);
    } else if (p) {
      window.history.replaceState(null, '', window.location.pathname);
      setBusy('Checking puzzle...');
      startFromText(p)
        .catch((e: Error) => {
          if (!isCancelled(e)) setMessage(e.message);
        })
        .finally(() => setBusy(null));
    } else if (!hasGame) void startNew(settingsRef.current.level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { startNew, startFromText };
}

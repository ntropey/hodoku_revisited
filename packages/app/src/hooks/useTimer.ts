import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../game';
import { load, save, SAVE_KEY, TIME_KEY } from '../storage';

/**
 * The play timer: counts while the page is visible and the puzzle is not solved, and is saved with the
 * puzzle's givens so a reload continues where it left off.
 */
export function useTimer(game: GameState | null, solved: boolean) {
  const [seconds, setSeconds] = useState(() => {
    const t = load<{ givens: string; seconds: number }>(TIME_KEY);
    const g = load<GameState>(SAVE_KEY);
    return t && g && t.givens === g.givens ? t.seconds : 0;
  });
  const secondsRef = useRef(seconds);
  secondsRef.current = seconds;

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

  /** Set the time (a new game starts at 0, a restored save point at its own time) and remember it. */
  const resetTimer = useCallback((givens: string, to = 0) => {
    setSeconds(to);
    save(TIME_KEY, { givens, seconds: to });
  }, []);

  return { seconds, secondsRef, resetTimer };
}

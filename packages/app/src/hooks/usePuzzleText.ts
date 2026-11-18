import { useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { saveTextFile } from '../files';
import type { GameState } from '../game';
import type { CopyFormat } from '../protocol';
import { isCancelled, type SolverClient } from '../solverClient';
import type { CopyWhat } from '../ui';

/** What each Copy/Save format is called, for the status line. */
const COPY_LABELS: Record<CopyWhat, string> = {
  givens: 'givens',
  pm: 'puzzle with candidates',
  library: 'library line',
  formatted: 'formatted grid',
};

/** The Copy and Save menus: the puzzle as text in one of four formats, to the clipboard or to a file. */
export function usePuzzleText(game: GameState | null, solver: RefObject<SolverClient>, setMessage: Dispatch<SetStateAction<string | null>>) {
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
    [game, solver, setMessage],
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
    [puzzleText, setMessage],
  );

  /** Save one of the text formats: browser download on the web, native share/save sheet in the shell. */
  const savePuzzle = useCallback(
    async (what: CopyWhat) => {
      const text = await puzzleText(what);
      if (text === null) return;
      try {
        const outcome = await saveTextFile(`hodoku-${what}.txt`, text);
        setMessage(
          outcome === 'shared'
            ? `Shared the ${COPY_LABELS[what]} file.`
            : `Saved the ${COPY_LABELS[what]} to a file.`,
        );
      } catch (e) {
        setMessage((e as Error).message);
      }
    },
    [puzzleText, setMessage],
  );

  return { copyPuzzle, savePuzzle };
}

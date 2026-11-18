import { useCallback, useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { boardSvg, exportSvgPng } from '../boardImage';
import { imposePages } from '../extendedPrint';
import { exportOutcomeMessage } from '../files';
import { isNativeApp, PRINTING_NATIVE_MESSAGE } from '../platform';
import { exportReceiptPngs, type ReceiptExportOptions } from '../receiptPrint';
import type { GameState } from '../game';
import type { PrintSection, PrintSudoku } from '../protocol';
import { isCancelled, type SolverClient } from '../solverClient';
import { PALETTE, type Settings } from '../ui';

export interface BookPages {
  pages: (PrintSudoku | null)[][];
  layout: number;
  rating: boolean;
}

interface Deps {
  solver: RefObject<SolverClient>;
  settingsRef: RefObject<Settings>;
  setBusy: Dispatch<SetStateAction<string | null>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
}

/** Everything that ends in the browser's print dialog or a downloaded image: print solution, extended print, PNG. */
export function usePrinting({ solver, settingsRef, setBusy, setMessage }: Deps) {
  const [printSolution, setPrintSolution] = useState(false);
  const [extendedPrintOpen, setExtendedPrintOpen] = useState(false);
  const [bookPages, setBookPages] = useState<BookPages | null>(null);

  // print the board and the solution grid, then drop the grid again
  useEffect(() => {
    if (!printSolution) return;
    if (isNativeApp()) {
      setPrintSolution(false);
      setMessage(PRINTING_NATIVE_MESSAGE);
      return;
    }
    const done = () => setPrintSolution(false);
    window.addEventListener('afterprint', done);
    window.print();
    return () => window.removeEventListener('afterprint', done);
  }, [printSolution, setMessage]);

  // print an imposed book: hide the normal page while the browser prints, then drop the book again
  useEffect(() => {
    if (!bookPages) return;
    if (isNativeApp()) {
      setBookPages(null);
      setMessage(PRINTING_NATIVE_MESSAGE);
      return;
    }
    document.body.classList.add('printing-book');
    const done = () => {
      document.body.classList.remove('printing-book');
      setBookPages(null);
    };
    window.addEventListener('afterprint', done);
    window.print();
    return () => {
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('printing-book');
    };
  }, [bookPages]);

  /** The browser's print dialog; unavailable in the native shell. */
  const printBoard = useCallback(() => {
    if (isNativeApp()) {
      setMessage(PRINTING_NATIVE_MESSAGE);
      return;
    }
    window.print();
  }, [setMessage]);

  /** Show the solution grid for printing; unavailable in the native shell. */
  const printSolutionAction = useCallback(() => {
    if (isNativeApp()) {
      setMessage(PRINTING_NATIVE_MESSAGE);
      return;
    }
    setPrintSolution(true);
  }, [setMessage]);

  /** Build a book of puzzles for extended print: generate every section, impose the pages, then print. */
  const printBook = useCallback(
    async (sections: PrintSection[], layout: number, rating: boolean, booklet: boolean) => {
      setExtendedPrintOpen(false);
      setPrintSolution(false);
      setMessage(null);
      if (isNativeApp()) {
        setMessage(PRINTING_NATIVE_MESSAGE);
        return;
      }
      setBusy('Preparing the print job...');
      try {
        const puzzles = await solver.current.book(sections, settingsRef.current.trainingTechniques ?? []);
        if (puzzles.length === 0) {
          setMessage('No puzzles to print.');
          return;
        }
        const pages = imposePages(puzzles.length, layout, booklet).map((page) => page.map((i) => puzzles[i] ?? null));
        setBookPages({ pages, layout, rating });
      } catch (e) {
        if (!isCancelled(e)) setMessage((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [solver, settingsRef, setBusy, setMessage],
  );

  /** Export the current board as a PNG (board only: grid, values, candidates, colors). */
  const exportPng = useCallback(
    async (game: GameState | null) => {
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
        const outcome = await exportSvgPng(svg, 'hodoku.png');
        setMessage(exportOutcomeMessage('hodoku.png', outcome));
      } catch (e) {
        setMessage((e as Error).message);
      }
    },
    [settingsRef, setMessage],
  );

  /** Export a batch of compact receipt strips and its answer strips into one ZIP. */
  const exportReceiptBook = useCallback(
    async (sections: PrintSection[], shuffle: boolean, options: ReceiptExportOptions) => {
      setExtendedPrintOpen(false);
      setMessage(null);
      setBusy('Preparing the receipt PNGs...');
      try {
        const puzzles = await solver.current.book(sections, settingsRef.current.trainingTechniques ?? []);
        const outcome = await exportReceiptPngs(puzzles, shuffle, options);
        setMessage(exportOutcomeMessage('hodoku-receipt-384px.zip', outcome));
      } catch (e) {
        if (!isCancelled(e)) setMessage((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [solver, settingsRef, setBusy, setMessage],
  );

  /** Export the current puzzle's original givens, not the player's partial progress. */
  const exportReceiptCurrent = useCallback(
    async (game: GameState | null) => {
      if (!game) return;
      setMessage(null);
      setBusy('Preparing the receipt PNGs...');
      try {
        const outcome = await exportReceiptPngs([{
          givens: game.givens,
          values: [...game.givens].map((v) => (v === '.' || v === '0' ? 0 : Number(v))),
          cands: [],
          solution: game.solution,
          level: game.level,
          score: game.score,
          showCands: false,
        }], false);
        setMessage(exportOutcomeMessage('hodoku-receipt-384px.zip', outcome));
      } catch (e) {
        setMessage((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [setBusy, setMessage],
  );

  return {
    printSolution,
    setPrintSolution,
    printBoard,
    printSolutionAction,
    extendedPrintOpen,
    setExtendedPrintOpen,
    bookPages,
    printBook,
    exportPng,
    exportReceiptBook,
    exportReceiptCurrent,
  };
}

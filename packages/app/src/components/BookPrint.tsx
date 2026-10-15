/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Print-only render of an imposed book: every printed page with its puzzles in the visual slots.
 * Screen-hidden; everything lives in the print stylesheet.
 */
import { boardSvg } from '../boardImage';
import { LAYOUT_LANDSCAPE } from '../extendedPrint';
import { LEVEL_NAMES, type PrintSudoku } from '../protocol';

interface Props {
  pages: (PrintSudoku | null)[][];
  layout: number;
  rating: boolean;
}

export function BookPrint({ pages, layout, rating }: Props) {
  return (
    <div className="bookprint" aria-hidden="true">
      <style>{`@media print { @page { size: A4 ${LAYOUT_LANDSCAPE[layout] ? 'landscape' : 'portrait'}; margin: 10mm; } }`}</style>
      {pages.map((page, p) => (
        <div className={`bookpage slots-${layout}`} key={p} style={{ height: LAYOUT_LANDSCAPE[layout] ? '190mm' : '277mm' }}>
          {page.map((puzzle, i) => (
            <div className="bookcell" key={i}>
              {puzzle && (
                <>
                  <div
                    className="booksudoku"
                    dangerouslySetInnerHTML={{
                      __html: boardSvg(puzzle.values, puzzle.cands, {
                        showCands: puzzle.showCands,
                        colorKu: false,
                        colorKuColors: undefined,
                        givens: puzzle.givens,
                      }),
                    }}
                  />
                  {rating && (
                    <div className="bookrating">
                      {LEVEL_NAMES[puzzle.level]} ({puzzle.score})
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

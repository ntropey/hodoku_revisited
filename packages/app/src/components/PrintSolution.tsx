import { isGiven, type GameState } from '../game';

interface Props {
  game: GameState;
}

/** The solved grid, printed after the board. Screen-hidden; everything lives in the print stylesheet. */
export function PrintSolution({ game }: Props) {
  return (
    <div className="solutiongrid" aria-hidden="true">
      {game.solution.map((value, i) => (
        <div key={i} className={isGiven(game, i) ? 'given' : undefined}>
          {value}
        </div>
      ))}
    </div>
  );
}

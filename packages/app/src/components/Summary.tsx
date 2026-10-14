import type { GameState } from '../game';
import { LEVEL_NAMES } from '../protocol';

export function Summary({ game }: { game: GameState | null }) {
  if (!game) return <div className="hintview"><p>No puzzle yet.</p></div>;
  const hardest = game.path?.[0];
  return (
    <div className="summary">
      <div className="kicker">Rating</div>
      <div className="rating">
        <strong>{LEVEL_NAMES[game.level]}</strong>
        <span className="dim">score {game.score}</span>
      </div>
      <div className="levels" role="img" aria-label={`Difficulty ${LEVEL_NAMES[game.level]} of five levels`}>
        {[1, 2, 3, 4, 5].map((l) => (
          <span key={l} className={l === game.level ? 'on' : l < game.level ? 'passed' : ''}>
            {LEVEL_NAMES[l]}
          </span>
        ))}
      </div>
      <div className="kicker">Techniques used</div>
      {!game.path && <p className="note">This puzzle was saved before the solve path existed. Start a new puzzle to see it.</p>}
      {game.path && (
        <ul className="techlist">
          {game.path.map((p, i) => (
            <li key={p.type} className={i === 0 ? 'hardest' : ''}>
              {p.slug ? <a href={`../techniques/${p.slug}.html`} target="_blank" rel="noreferrer">{p.name}</a> : <span>{p.name}</span>}
              <span className="n">{p.count}</span>
              {i === 0 && hardest && <span className="tag">hardest</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="note">The path is the solver's own way from the givens to the solution, not yours.</p>
    </div>
  );
}

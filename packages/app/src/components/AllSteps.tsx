import type { HintResult } from '../protocol';

interface Props {
  data: { results: HintResult[]; total: Record<string, number> } | null;
  hintLevelName: string;
  selected: HintResult | null;
  busy: string | null;
  disabled: boolean;
  onRefresh: () => void;
  onSelect: (r: HintResult) => void;
  onApply: () => void;
}

export function AllSteps({ data, hintLevelName, selected, busy, disabled, onRefresh, onSelect, onApply }: Props) {
  if (!data) {
    return (
      <div className="hintview">
        <h3>All steps</h3>
        <p>List every step that is available right now, grouped by technique.</p>
        <button className="primary" onClick={onRefresh} disabled={disabled || !!busy}>
          Find all steps
        </button>
        {busy && <p className="note">{busy}</p>}
      </div>
    );
  }
  const groups = data.results.reduce<Record<string, HintResult[]>>((acc, r) => ((acc[r.name] ??= []).push(r), acc), {});
  const total = Object.values(data.total).reduce((a, b) => a + b, 0);
  return (
    <div className="allsteps">
      <div className="allhead">
        <span>
          Available now · Hints use: {hintLevelName}
        </span>
        <strong>{total} steps</strong>
      </div>
      {data.results.length === 0 && <p className="note">No step is available at this hint level.</p>}
      {Object.entries(groups).map(([name, list]) => (
        <section key={name} className="group">
          <h4>
            {name} <span className="count">{data.total[name]}</span>
          </h4>
          <ul>
            {list.map((r, i) => (
              <li key={i}>
                <button className={r === selected ? 'chipbtn on' : 'chipbtn'} onClick={() => onSelect(r)}>
                  {r.text.slice(r.name.length + 2)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="row sticky">
        <button className="primary" onClick={onApply} disabled={!selected}>
          Apply selected
        </button>
        <button onClick={onRefresh} disabled={disabled || !!busy}>
          Refresh
        </button>
      </div>
    </div>
  );
}

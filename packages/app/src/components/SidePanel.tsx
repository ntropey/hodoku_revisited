import { HINT_LEVEL_NAMES, type HintLevel } from '../protocol';
import type { Tab } from '../ui';

interface Props {
  tab: Tab;
  onTab: (t: Tab) => void;
  hintLevel: HintLevel;
  onHintLevel: (l: HintLevel) => void;
  children: React.ReactNode;
}

const TABS: [Tab, string][] = [
  ['hint', 'Hint'],
  ['steps', 'All steps'],
  ['path', 'Path'],
  ['summary', 'Summary'],
];

export function SidePanel({ tab, onTab, hintLevel, onHintLevel, children }: Props) {
  return (
    <aside className="panel" aria-label="Hints and steps">
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => onTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <label className="hintuse">
        Hints use
        <select value={hintLevel} onChange={(e) => onHintLevel(Number(e.target.value) as HintLevel)} aria-label="Hint level">
          {HINT_LEVEL_NAMES.map((n, i) => (
            <option key={n} value={i}>
              {i === 5 ? 'Everything' : n}
            </option>
          ))}
        </select>
      </label>
      <div className="panelbody" role="tabpanel">
        {children}
      </div>
    </aside>
  );
}

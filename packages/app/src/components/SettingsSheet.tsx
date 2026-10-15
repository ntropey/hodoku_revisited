import { SOLUTION_TYPE_INFO, defaultSolverSteps } from '@hodoku/core';
import { HINT_LEVEL_NAMES, LEVEL_NAMES } from '../protocol';
import { DEFAULT_COLORKU_COLORS, type Settings, type Theme } from '../ui';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onResetNotes: () => void;
  onClearNotes: () => void;
  onClose: () => void;
}

/** The techniques a hint may use, grouped by difficulty; INCOMPLETE and GIVE_UP are not real hints. */
const TECHNIQUES: [number, { type: string; name: string }[]][] = (() => {
  const byLevel = new Map<number, { type: string; name: string }[]>();
  for (const c of defaultSolverSteps()) {
    if (c.type === 'INCOMPLETE' || c.type === 'GIVE_UP') continue;
    const list = byLevel.get(c.level) ?? [];
    list.push({ type: c.type, name: SOLUTION_TYPE_INFO[c.type].stepName });
    byLevel.set(c.level, list);
  }
  return [...byLevel.entries()].sort((a, b) => a[0] - b[0]);
})();

export function SettingsSheet({ settings, onChange, onResetNotes, onClearNotes, onClose }: Props) {
  const disabled = new Set(settings.disabledTechniques);
  const toggle = (type: string, enabled: boolean) => {
    const next = new Set(disabled);
    if (enabled) next.delete(type);
    else next.add(type);
    onChange({ ...settings, disabledTechniques: [...next] });
  };
  const colors = settings.colorKuColors ?? DEFAULT_COLORKU_COLORS;
  const setColor = (i: number, value: string) => {
    const next = [...colors];
    next[i] = value;
    onChange({ ...settings, colorKuColors: next });
  };
  return (
    <div className="modal" role="dialog" aria-label="Settings" aria-modal="true">
      <div className="modal-card">
        <h2>Settings</h2>
        <label className="field">
          <input type="checkbox" checked={settings.showCands} onChange={(e) => onChange({ ...settings, showCands: e.target.checked })} />
          Show candidates in every cell
        </label>
        <label className="field">
          <input type="checkbox" checked={settings.checkMistakes} onChange={(e) => onChange({ ...settings, checkMistakes: e.target.checked })} />
          Mark mistakes (values that differ from the solution)
        </label>
        <label className="field">
          <input type="checkbox" checked={settings.autoFill} onChange={(e) => onChange({ ...settings, autoFill: e.target.checked })} />
          Auto-fill the last digit (a row, column or box with one empty cell)
        </label>
        <label className="field">
          <input type="checkbox" checked={settings.colorKu} onChange={(e) => onChange({ ...settings, colorKu: e.target.checked })} />
          ColorKu: draw digits and candidates as coloured balls
        </label>
        <details className="about colorku-colors">
          <summary>ColorKu colours</summary>
          <p className="note">One colour per digit, used when ColorKu is on.</p>
          <div className="kurow">
            {DEFAULT_COLORKU_COLORS.map((fallback, i) => (
              <label key={i}>
                <input type="color" value={colors[i] ?? fallback} onChange={(e) => setColor(i, e.target.value)} aria-label={`Colour for digit ${i + 1}`} />
                {i + 1}
              </label>
            ))}
          </div>
          <button onClick={() => onChange({ ...settings, colorKuColors: [...DEFAULT_COLORKU_COLORS] })}>Reset to the default colours</button>
        </details>
        <label className="field">
          Hints use
          <select value={settings.hintLevel} onChange={(e) => onChange({ ...settings, hintLevel: Number(e.target.value) as Settings['hintLevel'] })}>
            {HINT_LEVEL_NAMES.map((n, i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <details className="about techniques">
          <summary>Techniques a hint may use</summary>
          <p>Untick a technique to keep hints from using it. Every technique is on by default. The <em>Hints use</em> level above still caps how hard a hint may be.</p>
          <div className="techscroll">
            {TECHNIQUES.map(([level, list]) => (
              <div key={level}>
                <h3>{LEVEL_NAMES[level]}</h3>
                {list.map((t) => (
                  <label key={t.type} className="field">
                    <input type="checkbox" checked={!disabled.has(t.type)} onChange={(e) => toggle(t.type, e.target.checked)} />
                    {t.name}
                  </label>
                ))}
              </div>
            ))}
          </div>
          <button onClick={() => onChange({ ...settings, disabledTechniques: [] })}>Enable all techniques</button>
        </details>
        <label className="field">
          Difficulty of new puzzles
          <select value={settings.level} onChange={(e) => onChange({ ...settings, level: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>
                {LEVEL_NAMES[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Theme
          <select value={settings.theme} onChange={(e) => onChange({ ...settings, theme: e.target.value as Theme })}>
            <option value="system">Follow the device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <div className="row">
          <button onClick={onClearNotes}>Clear pencil marks</button>
          <button onClick={onResetNotes}>Reset candidates</button>
          <span className="spacer" />
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
        <details className="about">
          <summary>About and license</summary>
          <p>
            Hodoku Revisited is based on <a href="https://hodoku.sourceforge.net/">HoDoKu</a> by Bernhard Hobiger (2008-12).
            Copyright (C) 2026 Hodoku Revisited contributors. This program comes with ABSOLUTELY NO WARRANTY. It is free software
            under the GNU General Public License, version 3 or later; you may redistribute it under those terms. Not affiliated with
            or endorsed by the original author.
          </p>
          <p>
            <a href="https://www.gnu.org/licenses/gpl-3.0.html">License text</a> ·{' '}
            <a href="https://github.com/ntropey/hodoku_revisited">Source code</a>
          </p>
        </details>
      </div>
    </div>
  );
}

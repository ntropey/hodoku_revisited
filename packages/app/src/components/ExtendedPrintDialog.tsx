/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * The extended print dialog: build a book of up to five sections of puzzles (the original's
 * *Extended print*). The puzzles are generated when Print is pressed; the layout and the booklet
 * imposition are in `extendedPrint.ts`.
 */
import { useState } from 'react';
import { canBooklet, PRINT_LAYOUTS } from '../extendedPrint';
import { LEVEL_NAMES, type PrintSection } from '../protocol';
import type { Settings } from '../ui';

interface Props {
  settings: Settings;
  busy: boolean;
  onPrint: (sections: PrintSection[], layout: number, rating: boolean, booklet: boolean) => void;
  onClose: () => void;
}

const MODES: [PrintSection['mode'], string][] = [
  ['playing', 'Playing'],
  ['learning', 'Learning'],
  ['practising', 'Practicing'],
];

/** The five sections at their defaults: six puzzles in the first, none in the rest. */
function defaultSections(level: number): PrintSection[] {
  return [0, 1, 2, 3, 4].map((i) => ({ level, count: i === 0 ? 6 : 0, mode: 'playing', cands: false }));
}

const clampCount = (n: number): number => Math.min(30, Math.max(0, Math.floor(Number.isFinite(n) ? n : 0)));

/** Pick up to five sections of puzzles, a layout and the two options, then generate and print them. */
export function ExtendedPrintDialog({ settings, busy, onPrint, onClose }: Props) {
  const [sections, setSections] = useState<PrintSection[]>(() => defaultSections(settings.level));
  const [layout, setLayout] = useState(0);
  const [rating, setRating] = useState(false);
  const [booklet, setBooklet] = useState(false);

  const set = (i: number, patch: Partial<PrintSection>) => setSections((all) => all.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const changeLayout = (n: number) => {
    setLayout(n);
    // only the landscape layouts fold into a booklet
    if (!canBooklet(n)) setBooklet(false);
  };
  const total = sections.reduce((n, s) => n + s.count, 0);
  const print = () => onPrint(sections.filter((s) => s.count > 0), layout, rating, booklet);

  return (
    <div className="modal" role="dialog" aria-label="Extended print" aria-modal="true">
      <div className="modal-card extendedprint">
        <h2>Extended print</h2>
        <p className="note">Build a book of puzzles: up to five sections, each with its own level and mode.</p>
        {sections.map((s, i) => (
          <div className="printsection" key={i}>
            <span className="printsection-n">Section {i + 1}</span>
            <label className="field">
              <input
                type="number"
                min={0}
                max={30}
                step={1}
                value={s.count}
                aria-label={`Section ${i + 1} puzzles`}
                onChange={(e) => set(i, { count: clampCount(Number(e.target.value)) })}
              />
              puzzles
            </label>
            <label className="field">
              <select value={s.level} aria-label={`Section ${i + 1} level`} onChange={(e) => set(i, { level: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_NAMES[l]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <select value={s.mode} aria-label={`Section ${i + 1} mode`} onChange={(e) => set(i, { mode: e.target.value as PrintSection['mode'] })}>
                {MODES.map(([m, label]) => (
                  <option key={m} value={m}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <input type="checkbox" checked={s.cands} onChange={(e) => set(i, { cands: e.target.checked })} />
              Print candidates
            </label>
          </div>
        ))}
        <p className="note">Learning sections use the techniques from the Training dialog.</p>
        <label className="field">
          Layout
          <select value={layout} aria-label="Layout" onChange={(e) => changeLayout(Number(e.target.value))}>
            {PRINT_LAYOUTS.map((label, i) => (
              <option key={i} value={i}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <input type="checkbox" checked={rating} onChange={(e) => setRating(e.target.checked)} />
          Print the rating
        </label>
        <label className="field">
          <input type="checkbox" checked={booklet} disabled={!canBooklet(layout)} onChange={(e) => setBooklet(e.target.checked)} />
          Booklet
        </label>
        <div className="row">
          <span className="note">
            {total} {total === 1 ? 'puzzle' : 'puzzles'}
          </span>
          <span className="spacer" />
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={busy || total === 0} onClick={print}>
            Print
          </button>
        </div>
      </div>
    </div>
  );
}

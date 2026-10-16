/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Renders a worked example (see scripts/gen-examples.ts) as an inline SVG sudoku diagram.
 * Colors come from CSS variables in site.css, so the diagrams follow light and dark mode.
 */

const CELL = 50;
const SIZE = CELL * 9;
const cellName = (i) => `r${Math.floor(i / 9) + 1}c${(i % 9) + 1}`;
const listCells = (marks) => [...new Set(marks.map((m) => cellName(m.cell)))].join(', ');

/** center of candidate `digit` inside `cell` */
function candPos(cell, digit) {
  const x = (cell % 9) * CELL + 9 + ((digit - 1) % 3) * 16;
  const y = Math.floor(cell / 9) * CELL + 10 + Math.floor((digit - 1) / 3) * 16;
  return [x + 0, y + 0];
}

const hasMark = (list, cell, digit) => list.some((m) => m.cell === cell && m.digit === digit);

export function caption(ex) {
  const parts = [];
  if (ex.place.length > 0) parts.push(ex.place.map((p) => `${p.digit} goes in ${cellName(p.cell)}`).join('; '));
  if (ex.elim.length > 0) {
    const digits = [...new Set(ex.elim.map((e) => e.digit))].sort().join(', ');
    parts.push(`${digits} can be removed from ${listCells(ex.elim)}`);
  }
  for (const chain of ex.chains) {
    if (chain.length > 1) parts.push(`chain: ${chain.map((n) => `${n.digit} in ${cellName(n.cell)}`).join(' → ')}`);
  }
  let text = `${ex.name}: ${parts.join('. ')}.`;
  if (ex.type === 'FORCING_CHAIN_CONTRADICTION') {
    text += ' Assuming the first candidate is true leads, step by step, to the same cell not being that candidate: a contradiction, so it can be removed.';
  }
  return text;
}

export function legend(ex) {
  const items = [];
  if (ex.place.length) items.push('<span class="lg place">placed</span>');
  if (ex.key.length || ex.colors.length) items.push('<span class="lg key">pattern</span>');
  if (ex.fins.length) items.push('<span class="lg fin">fin / link</span>');
  if (ex.elim.length) items.push('<span class="lg elim">removed</span>');
  if (ex.chains.length) items.push('<span class="lg link">solid: strong link, dashed: weak link</span>');
  return `<p class="legend">${items.join(' ')}</p>`;
}

export function diagram(ex) {
  const out = [];
  out.push(`<svg class="dg" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="${escAttr(caption(ex))}" xmlns="http://www.w3.org/2000/svg">`);
  out.push(`<rect class="bg" width="${SIZE}" height="${SIZE}"/>`);
  for (const t of ex.tint) {
    for (const c of t.cells) {
      out.push(`<rect class="tint-${t.tone}" x="${(c % 9) * CELL}" y="${Math.floor(c / 9) * CELL}" width="${CELL}" height="${CELL}"/>`);
    }
  }
  // grid
  for (let i = 0; i <= 9; i++) {
    const cls = i % 3 === 0 ? 'thick' : 'thin';
    out.push(`<line class="${cls}" x1="${i * CELL}" y1="0" x2="${i * CELL}" y2="${SIZE}"/>`);
    out.push(`<line class="${cls}" x1="0" y1="${i * CELL}" x2="${SIZE}" y2="${i * CELL}"/>`);
  }
  // colors (coloring and ALS): rounded backing behind the candidate
  for (const c of ex.colors) {
    const [x, y] = candPos(c.cell, c.digit);
    out.push(`<rect class="col-${c.color % 2}" x="${x - 8}" y="${y - 8}" width="16" height="16" rx="4"/>`);
  }
  // chain lines
  for (const chain of ex.chains) {
    for (let i = 0; i + 1 < chain.length; i++) {
      const [x1, y1] = candPos(chain[i].cell, chain[i].digit);
      const [x2, y2] = candPos(chain[i + 1].cell, chain[i + 1].digit);
      out.push(`<line class="link ${chain[i + 1].strong ? 'strong' : 'weak'}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
    }
  }
  // values and candidates
  for (let cell = 0; cell < 81; cell++) {
    const cx = (cell % 9) * CELL + CELL / 2;
    const cy = Math.floor(cell / 9) * CELL + CELL / 2;
    const v = ex.values[cell];
    if (v !== 0) {
      out.push(`<text class="val" x="${cx}" y="${cy}">${v}</text>`);
      continue;
    }
    const placed = ex.place.find((p) => p.cell === cell);
    if (placed) {
      out.push(`<rect class="placebg" x="${(cell % 9) * CELL + 2}" y="${Math.floor(cell / 9) * CELL + 2}" width="${CELL - 4}" height="${CELL - 4}" rx="3"/>`);
      out.push(`<text class="val placed" x="${cx}" y="${cy}">${placed.digit}</text>`);
    }
    for (let d = 1; d <= 9; d++) {
      if ((ex.cands[cell] & (1 << d)) === 0) continue;
      const [x, y] = candPos(cell, d);
      let cls = 'cand';
      if (hasMark(ex.elim, cell, d)) cls += ' elim';
      else if (hasMark(ex.fins, cell, d)) cls += ' fin';
      else if (hasMark(ex.key, cell, d) || ex.colors.some((c) => c.cell === cell && c.digit === d)) cls += ' key';
      if (placed) cls += ' faded';
      out.push(`<text class="${cls}" x="${x}" y="${y}">${d}</text>`);
      if (cls.includes('elim')) out.push(`<line class="strike" x1="${x - 6}" y1="${y + 6}" x2="${x + 6}" y2="${y - 6}"/>`);
    }
  }
  out.push('</svg>');
  return out.join('');
}

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

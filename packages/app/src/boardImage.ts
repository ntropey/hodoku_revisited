/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Board to SVG (pure) and SVG to a downloaded PNG (DOM).
 */
import { colorKuColor } from './ui';

export interface BoardImageOptions {
  showCands: boolean;
  colorKu: boolean;
  colorKuColors: readonly string[] | undefined;
  cellColors?: readonly number[];
  candColors?: readonly number[];
  palette?: readonly string[];
  /** the puzzle's givens, '.' for empty; decides which digits are "given" */
  givens: string;
}

/** side of one cell in the exported image */
const CELL = 56;
/** white margin around the grid */
const PAD = 10;
const SIZE = CELL * 9 + PAD * 2;

const BG = '#ffffff';
const THIN = '#c8c4ba';
const THICK = '#1c1b18';
const GIVEN = '#111111';
const OWN = '#1971c2';
const CAND = '#55524a';

const GIVEN_FONT = "Georgia, 'Times New Roman', serif";
const UI_FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

const px = (col: number): number => PAD + col * CELL;
const py = (row: number): number => PAD + row * CELL;

function rect(x: number, y: number, w: number, h: number, fill: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
}

function line(x1: number, y1: number, x2: number, y2: number, width: number, color: string): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"/>`;
}

function text(x: number, y: number, size: number, fill: string, font: string, weight: number, digit: number): string {
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle" dominant-baseline="central">${digit}</text>`;
}

function circle(cx: number, cy: number, r: number, fill: string): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
}

/**
 * A standalone SVG of the board: grid, placed values, candidates and the player's own colors.
 * Only digits and numbers are written, so nothing needs escaping.
 */
export function boardSvg(values: readonly number[], cands: readonly number[], options: BoardImageOptions): string {
  const { showCands, colorKu, colorKuColors, cellColors, candColors, palette, givens } = options;
  const parts: string[] = [rect(0, 0, SIZE, SIZE, BG)];

  // the player's own cell colors sit behind the grid
  if (cellColors) {
    for (let i = 0; i < 81; i++) {
      const idx = cellColors[i] ?? 0;
      const color = idx > 0 ? palette?.[idx - 1] : undefined;
      if (color) parts.push(rect(px(i % 9), py(Math.floor(i / 9)), CELL, CELL, color));
    }
  }

  // thin cell lines, thick box lines and the outer border
  for (let n = 0; n <= 9; n++) {
    const thick = n % 3 === 0;
    const weight = thick ? 3 : 1;
    const color = thick ? THICK : THIN;
    parts.push(line(px(n), PAD, px(n), PAD + 9 * CELL, weight, color));
    parts.push(line(PAD, py(n), PAD + 9 * CELL, py(n), weight, color));
  }

  for (let i = 0; i < 81; i++) {
    const row = Math.floor(i / 9);
    const col = i % 9;
    const value = values[i] ?? 0;

    if (value !== 0) {
      const cx = px(col) + CELL / 2;
      const cy = py(row) + CELL / 2;
      const given = givens[i] !== '.' && givens[i] !== '0';
      if (colorKu) {
        parts.push(circle(cx, cy, CELL * 0.4, colorKuColor(colorKuColors, value)));
        parts.push(text(cx, cy, CELL * 0.5, BG, UI_FONT, 700, value));
      } else {
        parts.push(text(cx, cy, CELL * 0.62, given ? GIVEN : OWN, given ? GIVEN_FONT : UI_FONT, 500, value));
      }
      continue;
    }

    if (!showCands) continue;
    const mask = cands[i] ?? 0;
    for (let d = 1; d <= 9; d++) {
      if ((mask & (1 << d)) === 0) continue;
      const subCol = (d - 1) % 3;
      const subRow = Math.floor((d - 1) / 3);
      const sx = px(col) + (subCol + 0.5) * (CELL / 3);
      const sy = py(row) + (subRow + 0.5) * (CELL / 3);
      const idx = candColors?.[i * 9 + (d - 1)] ?? 0;
      const color = idx > 0 ? palette?.[idx - 1] : undefined;
      if (color) parts.push(rect(px(col) + subCol * (CELL / 3), py(row) + subRow * (CELL / 3), CELL / 3, CELL / 3, color));
      if (colorKu) parts.push(circle(sx, sy, CELL * 0.12, colorKuColor(colorKuColors, d)));
      else parts.push(text(sx, sy, CELL * 0.24, CAND, UI_FONT, 500, d));
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${parts.join('')}</svg>`;
}

/** Draw the SVG onto a canvas and download it as a PNG. Uses the DOM only. */
export function downloadSvg(svg: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const width = Number(/\bwidth="(\d+)"/.exec(svg)?.[1]) || img.naturalWidth || img.width;
      const height = Number(/\bheight="(\d+)"/.exec(svg)?.[1]) || img.naturalHeight || img.height;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not draw the board.'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Could not create the PNG.'));
          return;
        }
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
        resolve();
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load the board image.'));
    };
    img.src = url;
  });
}

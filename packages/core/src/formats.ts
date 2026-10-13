/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * Modified version of the puzzle import/export code in HoDoKu's Sudoku2 (Java).
 */

import type { Sudoku2 } from './sudoku2.js';
import { BUDDIES, LENGTH, getCol } from './tables.js';

/** Text formats written by {@link formatSudoku} (HoDoKu's ClipboardMode, without the step variants). */
export type ClipboardMode =
  | 'LIBRARY'
  | 'CLUES_ONLY'
  | 'VALUES_ONLY'
  | 'PM_GRID'
  | 'CLUES_ONLY_FORMATTED'
  | 'VALUES_ONLY_FORMATTED';

const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9' && ch.length === 1;

function countOf(str: string, pattern: string): number {
  return str.split(pattern).length - 1;
}

/** Condense the first 9 lines into one 81 character string (SimpleSudoku grids). */
function ssString(lines: string[]): string {
  return lines
    .slice(0, 9)
    .join('')
    .split('')
    .filter((ch) => isDigit(ch) || ch === '.')
    .join('');
}

/**
 * Remove border lines and markup from one input line: only digits, '.' and single
 * blanks remain ('|' counts as blank).
 */
function cleanLine(raw: string): string {
  let tmp = raw.trim();
  let idx: number;
  while ((idx = tmp.indexOf('---')) >= 0) {
    if (idx > 0) {
      const ch = tmp[idx - 1];
      if (!isDigit(ch) && ch !== ' ' && ch !== '|') idx--;
    }
    let end = idx + 1;
    while (end < tmp.length && tmp[end] === '-') end++;
    if (end < tmp.length - 1) {
      const ch = tmp[end + 1];
      if (!isDigit(ch) && ch !== ' ' && ch !== '|') end++;
    }
    tmp = tmp.slice(0, idx) + tmp.slice(end + 1);
  }
  let out = '';
  for (const ch of tmp) {
    if (ch === '|') out += ' ';
    else if (isDigit(ch) || ch === '.' || ch === ' ') out += ch;
  }
  return out.replace(/ {2,}/g, ' ').trim();
}

/**
 * Load a puzzle into `s` (which is cleared first). Understands, like HoDoKu:
 *  - 81 characters with givens ('.' or '0' for empty cells; a trailing `# comment` is ignored)
 *  - a 9-line grid, with or without borders
 *  - a PM grid (candidates per cell; single candidates are set if no buddy has them)
 *  - SimpleSudoku exports (givens [+ solved cells] + PM grid)
 *  - the HoDoKu library format `:type:cands:values:eliminated candidates:...`,
 *    where `+` marks solved cells that are not givens
 *  - one line of gsf's q2 taxonomy (comma separated, the puzzle is field 5)
 *
 * Unlike the original, input with fewer or more than 81 cells is rejected.
 */
export function parseSudoku(s: Sudoku2, init: string, saveInitialState: boolean): void {
  s.clearSudoku();
  const lineEnd = init.includes('\r\n') ? '\r\n' : init.includes('\r') ? '\r' : init.includes('\n') ? '\n' : null;
  let lines = lineEnd !== null ? init.split(lineEnd) : [init];
  const anzLinesRaw = lines.length;

  let libraryFormat = false;
  let libraryCandStr = '';
  if (anzLinesRaw === 1) {
    const colons = countOf(init, ':');
    if (colons === 6 || colons === 7) {
      libraryFormat = true;
      const libLines = init.split(':');
      lines[0] = libLines[3] ?? '';
      libraryCandStr = libLines[4] ?? '';
    }
  }

  // many formats append additional info after a '#'
  if (anzLinesRaw === 1 && lines[0].includes('#')) {
    const tmp = lines[0].substring(0, lines[0].indexOf('#')).trim();
    if (tmp.length >= 81) lines[0] = tmp;
  }

  // gsf's q2 taxonomy
  if (anzLinesRaw === 1 && countOf(init, ',') >= 6) {
    lines[0] = init.split(',')[4] ?? '';
  }

  // library format: solved cells that are not givens are marked with '+'
  const solvedButNotGivens = new Array<boolean>(LENGTH).fill(false);
  if (libraryFormat) {
    let pos = 0;
    for (const ch of lines[0]) {
      if (ch === '+') {
        if (pos < LENGTH) solvedButNotGivens[pos] = true;
      } else {
        pos++;
      }
    }
  }

  lines = lines.map(cleanLine).filter((l) => l.length > 0);
  let anzLines = lines.length;
  if (anzLines === 0) throw new Error('Invalid puzzle: expected 81 cells, found 0');

  // special case SimpleSudoku: PM grid plus one liner -> ignore the one liner
  if (anzLines === 10) anzLines--;
  // SimpleSudoku can contain 3 grids: givens, solved cells and PM
  let ssGivens: string | null = null;
  let ssCells: string | null = null;
  while (anzLines > 9 && anzLines % 9 === 0) {
    if (ssGivens === null) {
      ssGivens = ssString(lines);
      ssCells = ssGivens;
    } else {
      ssCells = ssString(lines);
    }
    lines = lines.slice(9);
    anzLines -= 9;
  }

  const cands = new Array<number>(LENGTH).fill(0);
  let cell = 0;
  const sInit = lines.slice(0, anzLines).join(' ');
  const singleDigits = sInit.length <= 81;
  const isPmGrid = sInit.length > 2 * 81;
  let sIndex = 0;
  while (sIndex < sInit.length) {
    let ch = sInit.charAt(sIndex);
    while (sIndex < sInit.length && !(isDigit(ch) || ch === '.')) {
      sIndex++;
      ch = sInit.charAt(sIndex);
    }
    if (sIndex >= sInit.length) break;
    if (cell >= LENGTH) throw new Error('Invalid puzzle: more than 81 cells');
    if (isPmGrid) {
      if (ch === '.' || ch === '0') {
        cands[cell] = 0;
        sIndex++;
      } else if (singleDigits) {
        cands[cell] = Number(ch);
        sIndex++;
      } else {
        let endIndex = sInit.indexOf(' ', sIndex);
        if (endIndex < 0) endIndex = sInit.length;
        cands[cell] = parseInt(sInit.substring(sIndex, endIndex), 10);
        sIndex = endIndex;
      }
    } else {
      if (isDigit(ch) && ch !== '0') {
        s.setCell(cell, Number(ch), libraryFormat ? !solvedButNotGivens[cell] : true);
      }
      sIndex++;
    }
    cell++;
  }
  if (cell !== LENGTH) throw new Error(`Invalid puzzle: expected 81 cells, found ${cell}`);

  if (isPmGrid) {
    // first pass: exactly the given candidates
    for (let index = 0; index < LENGTH; index++) {
      const given = new Array<boolean>(10).fill(false);
      for (let sum = cands[index]; sum > 0; sum = Math.floor(sum / 10)) given[sum % 10] = true;
      for (let c = 1; c <= 9; c++) {
        if (!given[c] && s.isCandidate(index, c)) s.setCandidate(index, c, false);
        else if (given[c] && !s.isCandidate(index, c)) s.setCandidate(index, c, true);
      }
    }
    // second pass: cells with a single candidate are set, unless a buddy still has that candidate
    for (let i = 0; i < LENGTH; i++) {
      if (s.getAnzCandidates(i) !== 1) continue;
      if (ssCells !== null) {
        const ch = ssCells.charAt(i);
        if (ch !== '' && ch !== '0' && ch !== '.') s.setCell(i, Number(ch), true);
      } else {
        for (let j = 1; j <= 9; j++) {
          if (!s.isCandidate(i, j)) continue;
          let count = 0;
          for (const b of BUDDIES[i].values()) {
            if (s.values[b] === 0 && s.isCandidate(b, j)) {
              count++;
              break;
            }
          }
          if (count === 0) s.setCell(i, j, true);
        }
      }
    }
  }

  // library format: eliminated candidates, written as digit,row,col
  if (libraryFormat && libraryCandStr.length > 0) {
    for (const item of libraryCandStr.split(' ')) {
      if (item.length === 0) continue;
      let pos = parseInt(item, 10);
      const col = pos % 10;
      pos = Math.floor(pos / 10);
      const row = pos % 10;
      pos = Math.floor(pos / 10);
      if (row < 1 || col < 1 || pos < 1 || pos > 9) throw new Error(`Invalid candidate: ${item}`);
      s.setCandidate((row - 1) * 9 + (col - 1), pos, false);
    }
  }

  // SimpleSudoku: the givens are set in an extra pass
  if (ssGivens !== null) s.setGivens(ssGivens);

  if (saveInitialState) s.initialState = formatSudoku(s, 'LIBRARY');
  // like the original: the puzzle is assumed to be valid, no checks are made here
  s.status = 'VALID';
  s.statusGivens = 'VALID';
}

/** The text form of the current state of `s`. `zeroForDot` writes '0' instead of '.' for empty cells. */
export function formatSudoku(s: Sudoku2, mode: ClipboardMode, zeroForDot = false): string {
  const dot = zeroForDot ? '0' : '.';
  let out = '';
  if (mode === 'LIBRARY') out += ':0000:x:';
  if (mode === 'CLUES_ONLY' || mode === 'VALUES_ONLY' || mode === 'LIBRARY') {
    for (let i = 0; i < LENGTH; i++) {
      if (s.values[i] === 0 || (mode === 'CLUES_ONLY' && !s.fixed[i])) {
        out += dot;
      } else {
        if (mode === 'LIBRARY' && !s.fixed[i]) out += '+';
        out += String(s.values[i]);
      }
    }
  }
  if (mode === 'PM_GRID' || mode === 'CLUES_ONLY_FORMATTED' || mode === 'VALUES_ONLY_FORMATTED') {
    const buffers: string[] = [];
    for (let i = 0; i < LENGTH; i++) {
      let value = s.values[i];
      if (mode === 'CLUES_ONLY_FORMATTED' && !s.fixed[i]) value = 0;
      if (value !== 0) {
        buffers.push(String(value));
      } else {
        let cand = '';
        if (mode === 'PM_GRID') cand = s.getCandidateString(i);
        buffers.push(cand.length === 0 ? dot : cand);
      }
    }
    const widths = new Array<number>(9).fill(0);
    for (let i = 0; i < LENGTH; i++) widths[getCol(i)] = Math.max(widths[getCol(i)], buffers[i].length);
    for (let c = 0; c < 9; c++) widths[c] += 2;
    for (let line = 0; line < 9; line++) {
      if (line % 3 === 0) out += borderLine(line, widths);
      out += cellLine(line, widths, buffers);
    }
    out += borderLine(9, widths);
  }
  if (mode === 'LIBRARY') {
    // eliminated candidates: candidates that would be valid but were deleted
    const elim: string[] = [];
    for (let i = 0; i < LENGTH; i++) {
      if (s.values[i] !== 0) continue;
      for (let j = 1; j <= 9; j++) {
        if (s.isValidValue(i, j) && !s.isCandidate(i, j)) {
          elim.push(`${j}${Math.floor(i / 9) + 1}${(i % 9) + 1}`);
        }
      }
    }
    out += ':' + elim.join(' ') + '::';
  }
  return out;
}

const EOL = '\n';

function borderLine(line: number, w: number[]): string {
  let edge = '.';
  let middle = '.';
  if (line === 3 || line === 6) {
    edge = ':';
    middle = '+';
  } else if (line === 9) {
    edge = "'";
    middle = "'";
  }
  const dashes = (a: number) => '-'.repeat(w[a] + w[a + 1] + w[a + 2]);
  return edge + dashes(0) + middle + dashes(3) + middle + dashes(6) + edge + EOL;
}

function cellLine(line: number, w: number[], buffers: string[]): string {
  let out = '';
  for (let i = line * 9; i < (line + 1) * 9; i++) {
    if (i % 3 === 0) {
      out += '|';
      if (i % 9 !== 8) out += ' ';
    } else {
      out += ' ';
    }
    out += buffers[i];
    out += ' '.repeat(Math.max(0, w[getCol(i)] - buffers[i].length - 1));
  }
  return out + '|' + EOL;
}

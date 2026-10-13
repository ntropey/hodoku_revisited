// scripts/gen-bank.ts
import { appendFileSync } from "node:fs";

// ../core/src/sudokuSet.ts
var MAX_MASK_2 = 131071;
var SudokuSet = class _SudokuSet {
  m0 = 0;
  m1 = 0;
  m2 = 0;
  cache = null;
  constructor(init) {
    if (init instanceof _SudokuSet) {
      this.set(init);
    } else if (init === true) {
      this.setAll();
    }
  }
  static fromValues(values) {
    const s = new _SudokuSet();
    for (const v of values) s.add(v);
    return s;
  }
  clone() {
    return new _SudokuSet(this);
  }
  isEmpty() {
    return (this.m0 | this.m1 | this.m2) === 0;
  }
  add(value) {
    if (value >= 64) this.m2 |= 1 << value - 64;
    else if (value >= 32) this.m1 |= 1 << value - 32;
    else this.m0 |= 1 << value;
    this.cache = null;
  }
  remove(value) {
    if (value >= 64) this.m2 &= ~(1 << value - 64);
    else if (value >= 32) this.m1 &= ~(1 << value - 32);
    else this.m0 &= ~(1 << value);
    this.cache = null;
  }
  contains(value) {
    if (value >= 64) return (this.m2 & 1 << value - 64) !== 0;
    if (value >= 32) return (this.m1 & 1 << value - 32) !== 0;
    return (this.m0 & 1 << value) !== 0;
  }
  /** true if every element of b is in this set */
  containsSet(b) {
    return (b.m0 & ~this.m0) === 0 && (b.m1 & ~this.m1) === 0 && (b.m2 & ~this.m2) === 0;
  }
  set(src) {
    this.m0 = src.m0;
    this.m1 = src.m1;
    this.m2 = src.m2;
    this.cache = null;
  }
  /** Set all three 32-bit words directly (cells 0-31, 32-63, 64-80). */
  setWords(m0, m1, m2) {
    this.m0 = m0;
    this.m1 = m1;
    this.m2 = m2;
    this.cache = null;
  }
  clear() {
    this.m0 = this.m1 = this.m2 = 0;
    this.cache = null;
  }
  setAll() {
    this.m0 = -1;
    this.m1 = -1;
    this.m2 = MAX_MASK_2;
    this.cache = null;
  }
  equals(o) {
    return this.m0 === o.m0 && this.m1 === o.m1 && this.m2 === o.m2;
  }
  intersects(b) {
    return (this.m0 & b.m0) !== 0 || (this.m1 & b.m1) !== 0 || (this.m2 & b.m2) !== 0;
  }
  /** (this & b) == 0 */
  andEmpty(b) {
    return !this.intersects(b);
  }
  or(b) {
    this.m0 |= b.m0;
    this.m1 |= b.m1;
    this.m2 |= b.m2;
    this.cache = null;
  }
  and(b) {
    this.m0 &= b.m0;
    this.m1 &= b.m1;
    this.m2 &= b.m2;
    this.cache = null;
  }
  andNot(b) {
    this.m0 &= ~b.m0;
    this.m1 &= ~b.m1;
    this.m2 &= ~b.m2;
    this.cache = null;
  }
  /** this |= ~b (limited to the 81 cells) */
  orNot(b) {
    this.m0 |= ~b.m0;
    this.m1 |= ~b.m1;
    this.m2 = (this.m2 | ~b.m2) & MAX_MASK_2;
    this.cache = null;
  }
  not() {
    this.m0 = ~this.m0;
    this.m1 = ~this.m1;
    this.m2 = ~this.m2 & MAX_MASK_2;
    this.cache = null;
  }
  setAnd(a, b) {
    this.m0 = a.m0 & b.m0;
    this.m1 = a.m1 & b.m1;
    this.m2 = a.m2 & b.m2;
    this.cache = null;
  }
  setOr(a, b) {
    this.m0 = a.m0 | b.m0;
    this.m1 = a.m1 | b.m1;
    this.m2 = a.m2 | b.m2;
    this.cache = null;
  }
  /** this |= (a & b) */
  orAndAnd(a, b) {
    this.m0 |= a.m0 & b.m0;
    this.m1 |= a.m1 & b.m1;
    this.m2 |= a.m2 & b.m2;
    this.cache = null;
  }
  size() {
    return this.values().length;
  }
  /** The element at position `index` in ascending order. */
  get(index) {
    return this.values()[index];
  }
  /** All elements in ascending order. The returned array must not be modified. */
  values() {
    if (this.cache === null) {
      const out2 = [];
      collect(this.m0, 0, out2);
      collect(this.m1, 32, out2);
      collect(this.m2, 64, out2);
      this.cache = out2;
    }
    return this.cache;
  }
  [Symbol.iterator]() {
    return this.values()[Symbol.iterator]();
  }
  toString() {
    return this.isEmpty() ? "empty!" : this.values().join(" ");
  }
};
function collect(word, base, out2) {
  let w = word;
  while (w !== 0) {
    const low = w & -w;
    out2.push(base + 31 - Math.clz32(low));
    w ^= low;
  }
}

// ../core/src/tables.ts
var LENGTH = 81;
var UNITS = 9;
var BLOCK = 0;
var LINE = 1;
var COL = 2;
var CELL = 3;
var LINES = Array.from(
  { length: 9 },
  (_, r) => Array.from({ length: 9 }, (_2, c) => r * 9 + c)
);
var COLS = Array.from(
  { length: 9 },
  (_, c) => Array.from({ length: 9 }, (_2, r) => r * 9 + c)
);
var BLOCKS = Array.from({ length: 9 }, (_, b) => {
  const r0 = Math.floor(b / 3) * 3;
  const c0 = b % 3 * 3;
  const cells = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push((r0 + r) * 9 + c0 + c);
  return cells;
});
var ALL_UNITS = [...LINES, ...COLS, ...BLOCKS];
function getLine(index) {
  return Math.floor(index / UNITS);
}
function getCol(index) {
  return index % UNITS;
}
function getBlock(index) {
  return Math.floor(getLine(index) / 3) * 3 + Math.floor(getCol(index) / 3);
}
function getIndex(line, col) {
  return line * 9 + col;
}
var CONSTRAINT_TYPE_FROM_CONSTRAINT = ALL_UNITS.map(
  (_, i) => i < 9 ? LINE : i < 18 ? COL : BLOCK
);
var CONSTRAINT_NUMBER_FROM_CONSTRAINT = ALL_UNITS.map((_, i) => i % 9 + 1);
var CONSTRAINTS = Array.from({ length: LENGTH }, (_, i) => [
  getLine(i),
  9 + getCol(i),
  18 + getBlock(i)
]);
var MASKS = [0, 1, 2, 4, 8, 16, 32, 64, 128, 256];
var MAX_MASK = 511;
var POSSIBLE_VALUES = Array.from({ length: 512 }, (_, mask) => {
  const out2 = [];
  for (let d = 1; d <= 9; d++) if (mask & MASKS[d]) out2.push(d);
  return out2;
});
var ANZ_VALUES = POSSIBLE_VALUES.map((v) => v.length);
var CAND_FROM_MASK = POSSIBLE_VALUES.map((v) => v.length ? v[0] : 0);
var BUDDIES = Array.from({ length: LENGTH }, (_, i) => {
  const s = new SudokuSet();
  for (let j = 0; j < LENGTH; j++) {
    if (i !== j && (getLine(i) === getLine(j) || getCol(i) === getCol(j) || getBlock(i) === getBlock(j))) {
      s.add(j);
    }
  }
  return s;
});
var ALL_CONSTRAINTS_TEMPLATES = ALL_UNITS.map((u) => SudokuSet.fromValues(u));
var LINE_TEMPLATES = LINES.map((u) => SudokuSet.fromValues(u));
var COL_TEMPLATES = COLS.map((u) => SudokuSet.fromValues(u));
var BLOCK_TEMPLATES = BLOCKS.map((u) => SudokuSet.fromValues(u));
function getBuddiesOfSet(cells, out2) {
  out2.setAll();
  for (const c of cells) out2.and(BUDDIES[c]);
}

// ../core/src/formats.ts
var isDigit = (ch) => ch >= "0" && ch <= "9" && ch.length === 1;
function countOf(str, pattern) {
  return str.split(pattern).length - 1;
}
function ssString(lines) {
  return lines.slice(0, 9).join("").split("").filter((ch) => isDigit(ch) || ch === ".").join("");
}
function cleanLine(raw) {
  let tmp = raw.trim();
  let idx;
  while ((idx = tmp.indexOf("---")) >= 0) {
    if (idx > 0) {
      const ch = tmp[idx - 1];
      if (!isDigit(ch) && ch !== " " && ch !== "|") idx--;
    }
    let end = idx + 1;
    while (end < tmp.length && tmp[end] === "-") end++;
    if (end < tmp.length - 1) {
      const ch = tmp[end + 1];
      if (!isDigit(ch) && ch !== " " && ch !== "|") end++;
    }
    tmp = tmp.slice(0, idx) + tmp.slice(end + 1);
  }
  let out2 = "";
  for (const ch of tmp) {
    if (ch === "|") out2 += " ";
    else if (isDigit(ch) || ch === "." || ch === " ") out2 += ch;
  }
  return out2.replace(/ {2,}/g, " ").trim();
}
function parseSudoku(s, init, saveInitialState) {
  s.clearSudoku();
  const lineEnd = init.includes("\r\n") ? "\r\n" : init.includes("\r") ? "\r" : init.includes("\n") ? "\n" : null;
  let lines = lineEnd !== null ? init.split(lineEnd) : [init];
  const anzLinesRaw = lines.length;
  let libraryFormat = false;
  let libraryCandStr = "";
  if (anzLinesRaw === 1) {
    const colons = countOf(init, ":");
    if (colons === 6 || colons === 7) {
      libraryFormat = true;
      const libLines = init.split(":");
      lines[0] = libLines[3] ?? "";
      libraryCandStr = libLines[4] ?? "";
    }
  }
  if (anzLinesRaw === 1 && lines[0].includes("#")) {
    const tmp = lines[0].substring(0, lines[0].indexOf("#")).trim();
    if (tmp.length >= 81) lines[0] = tmp;
  }
  if (anzLinesRaw === 1 && countOf(init, ",") >= 6) {
    lines[0] = init.split(",")[4] ?? "";
  }
  const solvedButNotGivens = new Array(LENGTH).fill(false);
  if (libraryFormat) {
    let pos = 0;
    for (const ch of lines[0]) {
      if (ch === "+") {
        if (pos < LENGTH) solvedButNotGivens[pos] = true;
      } else {
        pos++;
      }
    }
  }
  lines = lines.map(cleanLine).filter((l) => l.length > 0);
  let anzLines = lines.length;
  if (anzLines === 0) throw new Error("Invalid puzzle: expected 81 cells, found 0");
  if (anzLines === 10) anzLines--;
  let ssGivens = null;
  let ssCells = null;
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
  const cands = new Array(LENGTH).fill(0);
  let cell = 0;
  const sInit = lines.slice(0, anzLines).join(" ");
  const singleDigits = sInit.length <= 81;
  const isPmGrid = sInit.length > 2 * 81;
  let sIndex = 0;
  while (sIndex < sInit.length) {
    let ch = sInit.charAt(sIndex);
    while (sIndex < sInit.length && !(isDigit(ch) || ch === ".")) {
      sIndex++;
      ch = sInit.charAt(sIndex);
    }
    if (sIndex >= sInit.length) break;
    if (cell >= LENGTH) throw new Error("Invalid puzzle: more than 81 cells");
    if (isPmGrid) {
      if (ch === "." || ch === "0") {
        cands[cell] = 0;
        sIndex++;
      } else if (singleDigits) {
        cands[cell] = Number(ch);
        sIndex++;
      } else {
        let endIndex = sInit.indexOf(" ", sIndex);
        if (endIndex < 0) endIndex = sInit.length;
        cands[cell] = parseInt(sInit.substring(sIndex, endIndex), 10);
        sIndex = endIndex;
      }
    } else {
      if (isDigit(ch) && ch !== "0") {
        s.setCell(cell, Number(ch), libraryFormat ? !solvedButNotGivens[cell] : true);
      }
      sIndex++;
    }
    cell++;
  }
  if (cell !== LENGTH) throw new Error(`Invalid puzzle: expected 81 cells, found ${cell}`);
  if (isPmGrid) {
    for (let index = 0; index < LENGTH; index++) {
      const given = new Array(10).fill(false);
      for (let sum3 = cands[index]; sum3 > 0; sum3 = Math.floor(sum3 / 10)) given[sum3 % 10] = true;
      for (let c = 1; c <= 9; c++) {
        if (!given[c] && s.isCandidate(index, c)) s.setCandidate(index, c, false);
        else if (given[c] && !s.isCandidate(index, c)) s.setCandidate(index, c, true);
      }
    }
    for (let i = 0; i < LENGTH; i++) {
      if (s.getAnzCandidates(i) !== 1) continue;
      if (ssCells !== null) {
        const ch = ssCells.charAt(i);
        if (ch !== "" && ch !== "0" && ch !== ".") s.setCell(i, Number(ch), true);
      } else {
        for (let j = 1; j <= 9; j++) {
          if (!s.isCandidate(i, j)) continue;
          let count2 = 0;
          for (const b of BUDDIES[i].values()) {
            if (s.values[b] === 0 && s.isCandidate(b, j)) {
              count2++;
              break;
            }
          }
          if (count2 === 0) s.setCell(i, j, true);
        }
      }
    }
  }
  if (libraryFormat && libraryCandStr.length > 0) {
    for (const item of libraryCandStr.split(" ")) {
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
  if (ssGivens !== null) s.setGivens(ssGivens);
  if (saveInitialState) s.initialState = formatSudoku(s, "LIBRARY");
  s.status = "VALID";
  s.statusGivens = "VALID";
}
function formatSudoku(s, mode, zeroForDot = false) {
  const dot = zeroForDot ? "0" : ".";
  let out2 = "";
  if (mode === "LIBRARY") out2 += ":0000:x:";
  if (mode === "CLUES_ONLY" || mode === "VALUES_ONLY" || mode === "LIBRARY") {
    for (let i = 0; i < LENGTH; i++) {
      if (s.values[i] === 0 || mode === "CLUES_ONLY" && !s.fixed[i]) {
        out2 += dot;
      } else {
        if (mode === "LIBRARY" && !s.fixed[i]) out2 += "+";
        out2 += String(s.values[i]);
      }
    }
  }
  if (mode === "PM_GRID" || mode === "CLUES_ONLY_FORMATTED" || mode === "VALUES_ONLY_FORMATTED") {
    const buffers = [];
    for (let i = 0; i < LENGTH; i++) {
      let value = s.values[i];
      if (mode === "CLUES_ONLY_FORMATTED" && !s.fixed[i]) value = 0;
      if (value !== 0) {
        buffers.push(String(value));
      } else {
        let cand = "";
        if (mode === "PM_GRID") cand = s.getCandidateString(i);
        buffers.push(cand.length === 0 ? dot : cand);
      }
    }
    const widths = new Array(9).fill(0);
    for (let i = 0; i < LENGTH; i++) widths[getCol(i)] = Math.max(widths[getCol(i)], buffers[i].length);
    for (let c = 0; c < 9; c++) widths[c] += 2;
    for (let line = 0; line < 9; line++) {
      if (line % 3 === 0) out2 += borderLine(line, widths);
      out2 += cellLine(line, widths, buffers);
    }
    out2 += borderLine(9, widths);
  }
  if (mode === "LIBRARY") {
    const elim = [];
    for (let i = 0; i < LENGTH; i++) {
      if (s.values[i] !== 0) continue;
      for (let j = 1; j <= 9; j++) {
        if (s.isValidValue(i, j) && !s.isCandidate(i, j)) {
          elim.push(`${j}${Math.floor(i / 9) + 1}${i % 9 + 1}`);
        }
      }
    }
    out2 += ":" + elim.join(" ") + "::";
  }
  return out2;
}
var EOL = "\n";
function borderLine(line, w) {
  let edge = ".";
  let middle = ".";
  if (line === 3 || line === 6) {
    edge = ":";
    middle = "+";
  } else if (line === 9) {
    edge = "'";
    middle = "'";
  }
  const dashes = (a) => "-".repeat(w[a] + w[a + 1] + w[a + 2]);
  return edge + dashes(0) + middle + dashes(3) + middle + dashes(6) + edge + EOL;
}
function cellLine(line, w, buffers) {
  let out2 = "";
  for (let i = line * 9; i < (line + 1) * 9; i++) {
    if (i % 3 === 0) {
      out2 += "|";
      if (i % 9 !== 8) out2 += " ";
    } else {
      out2 += " ";
    }
    out2 += buffers[i];
    out2 += " ".repeat(Math.max(0, w[getCol(i)] - buffers[i].length - 1));
  }
  return out2 + "|" + EOL;
}

// ../core/src/singlesQueue.ts
var SinglesQueue = class _SinglesQueue {
  indices = new Int32Array(LENGTH * 3);
  values = new Int32Array(LENGTH * 3);
  putIndex = 0;
  getIdx = 0;
  iterateIndex = 0;
  clone() {
    const q = new _SinglesQueue();
    q.set(this);
    return q;
  }
  set(src) {
    this.indices.set(src.indices);
    this.values.set(src.values);
    this.getIdx = src.getIdx;
    this.putIndex = src.putIndex;
    this.iterateIndex = src.iterateIndex;
  }
  isEmpty() {
    return this.getIdx >= this.putIndex;
  }
  addSingle(index, value) {
    this.indices[this.putIndex] = index;
    this.values[this.putIndex++] = value;
  }
  /**
   * Returns the queue position of the next Single or -1 if the queue is empty.
   * The oldest Single is removed from the queue; its data stays readable via
   * {@link getIndex} / {@link getValue} until the next add.
   */
  getSingle() {
    if (this.getIdx >= this.putIndex) return -1;
    const ret = this.getIdx++;
    if (this.getIdx >= this.putIndex) this.getIdx = this.putIndex = 0;
    return ret;
  }
  /** The cell index at queue position `queueIndex`. */
  getIndex(queueIndex) {
    return this.indices[queueIndex];
  }
  /** The cell value at queue position `queueIndex`. */
  getValue(queueIndex) {
    return this.values[queueIndex];
  }
  /** Start iterating without removing elements; returns -1 if empty. */
  getFirstIndex() {
    this.iterateIndex = this.getIdx;
    return this.getNextIndex();
  }
  /** Continue iterating without removing elements; returns -1 at the end. */
  getNextIndex() {
    if (this.iterateIndex >= this.putIndex) return -1;
    return this.iterateIndex++;
  }
  /** Delete the entry for the cell `index`, if there is one. */
  deleteNakedSingle(index) {
    for (let i = this.getIdx; i < this.putIndex; i++) {
      if (this.indices[i] === index) {
        this.removeAt(i);
        break;
      }
    }
  }
  /** Delete the entry for candidate `value` in a cell of `constraint`, if there is one. */
  deleteHiddenSingle(constraint, value) {
    for (let i = this.getIdx; i < this.putIndex; i++) {
      const c = CONSTRAINTS[this.indices[i]];
      if (this.values[i] === value && (c[0] === constraint || c[1] === constraint || c[2] === constraint)) {
        this.removeAt(i);
        break;
      }
    }
  }
  clear() {
    this.getIdx = this.putIndex = 0;
  }
  removeAt(i) {
    for (let j = i + 1; j < this.putIndex; j++) {
      this.indices[j - 1] = this.indices[j];
      this.values[j - 1] = this.values[j];
    }
    this.putIndex--;
  }
};

// ../core/src/sudoku2.ts
var Sudoku2 = class _Sudoku2 {
  /** Candidate bitmaps per cell (bit d-1 = digit d). 0 means "cell already set". */
  cells = new Uint16Array(LENGTH);
  /** Candidates set by the user if "show all candidates" is off. */
  userCells = new Uint16Array(LENGTH);
  /** Number of free cells per unit and candidate (candidates go from 1 to 9). */
  free = Array.from({ length: ALL_UNITS.length }, () => new Uint8Array(UNITS + 1));
  /** number of unfilled cells in the grid */
  unsolvedCellsAnz = LENGTH;
  /** Values of the cells (0 = not set) */
  values = new Int32Array(LENGTH);
  /** true if the cell is a given */
  fixed = new Array(LENGTH).fill(false);
  /** The correct values of the solution */
  solution = new Int32Array(LENGTH);
  solutionSet = false;
  score = 0;
  /** Difficulty level ordinal (see DifficultyType), or null if not rated. */
  level = null;
  initialState = null;
  /** Status of the sudoku. Uniqueness techniques only work on 'VALID' puzzles (exactly one solution). */
  status = "EMPTY";
  /** Status if only the givens are taken into account (needed for Avoidable Rectangles). */
  statusGivens = "EMPTY";
  /** Newly detected Naked Singles */
  nsQueue = new SinglesQueue();
  /** Newly detected Hidden Singles */
  hsQueue = new SinglesQueue();
  constructor() {
    this.clearSudoku();
  }
  /** A deep copy. */
  clone() {
    const s = new _Sudoku2();
    s.set(this);
    return s;
  }
  /** Copy the state of `src` into this sudoku. */
  set(src) {
    this.cells.set(src.cells);
    this.userCells.set(src.userCells);
    this.values.set(src.values);
    this.solution.set(src.solution);
    this.fixed = src.fixed.slice();
    for (let i = 0; i < this.free.length; i++) this.free[i].set(src.free[i]);
    this.unsolvedCellsAnz = src.unsolvedCellsAnz;
    this.solutionSet = src.solutionSet;
    this.score = src.score;
    this.level = src.level;
    this.status = src.status;
    this.statusGivens = src.statusGivens;
    if (src.initialState !== null) this.initialState = src.initialState;
    this.nsQueue.set(src.nsQueue);
    this.hsQueue.set(src.hsQueue);
  }
  /** Empty grid: no values set, every candidate allowed everywhere; queues are cleared. */
  clearSudoku() {
    this.cells.fill(MAX_MASK);
    this.userCells.fill(0);
    for (const f of this.free) {
      f.fill(0);
      for (let j = 1; j <= 9; j++) f[j] = 9;
    }
    this.values.fill(0);
    this.solution.fill(0);
    this.fixed.fill(false);
    this.unsolvedCellsAnz = LENGTH;
    this.initialState = null;
    this.solutionSet = false;
    this.status = "EMPTY";
    this.statusGivens = "EMPTY";
    this.nsQueue.clear();
    this.hsQueue.clear();
  }
  resetSudoku() {
    if (this.initialState !== null) this.setSudoku(this.initialState);
  }
  /**
   * Load a puzzle from a string. See {@link parseSudoku} for the accepted formats
   * (81 characters, grids, PM grids, SimpleSudoku, HoDoKu library format, gsf taxonomy).
   * Throws if the text does not contain exactly 81 cells.
   */
  setSudoku(init, saveInitialState = true) {
    parseSudoku(this, init, saveInitialState);
  }
  /** The current state as text, see {@link ClipboardMode}. */
  getSudoku(mode, zeroForDot = false) {
    return formatSudoku(this, mode, zeroForDot);
  }
  /** Mark every cell that has a digit in the 81 character string `givens` as given, all others as not given. */
  setGivens(givens) {
    for (let i = 0; i < givens.length && i < LENGTH; i++) {
      this.fixed[i] = givens[i] >= "1" && givens[i] <= "9";
    }
  }
  /** The values as 81-character string, '.' for empty cells. */
  getValuesString() {
    let s = "";
    for (let i = 0; i < LENGTH; i++) s += this.values[i] === 0 ? "." : String(this.values[i]);
    return s;
  }
  /** Only the givens as 81-character string, '.' for every other cell. */
  getCluesString() {
    let s = "";
    for (let i = 0; i < LENGTH; i++) s += this.fixed[i] && this.values[i] !== 0 ? String(this.values[i]) : ".";
    return s;
  }
  toString() {
    return this.getValuesString();
  }
  /** Recompute {@link unsolvedCellsAnz}, {@link free} and rebuild both singles queues. */
  rebuildInternalData() {
    this.nsQueue.clear();
    this.hsQueue.clear();
    for (const f of this.free) f.fill(0);
    let anz = 0;
    for (let index = 0; index < LENGTH; index++) {
      if (this.values[index] !== 0) {
        this.cells[index] = 0;
      } else {
        anz++;
        for (const cand of POSSIBLE_VALUES[this.cells[index]]) {
          for (const c of CONSTRAINTS[index]) this.free[c][cand]++;
        }
        if (ANZ_VALUES[this.cells[index]] === 1) {
          this.nsQueue.addSingle(index, CAND_FROM_MASK[this.cells[index]]);
        }
      }
    }
    this.unsolvedCellsAnz = anz;
    for (let i = 0; i < this.free.length; i++) {
      for (let j = 1; j <= 9; j++) {
        if (this.free[i][j] === 1) {
          this.addHiddenSingle(i, j);
        }
      }
    }
  }
  /** Check that all values/candidates are consistent (and match the solution if set). */
  checkSudoku() {
    this.rebuildInternalData();
    for (let index = 0; index < LENGTH; index++) {
      if (this.values[index] !== 0) {
        if (!this.isValidValue(index, this.values[index])) return false;
        if (this.solutionSet && this.solution[index] !== this.values[index]) return false;
      } else {
        for (const cand of POSSIBLE_VALUES[this.cells[index]]) {
          if (!this.isValidValue(index, cand)) return false;
        }
        if (this.solutionSet && !this.isCandidate(index, this.solution[index])) return false;
      }
    }
    return true;
  }
  getValue(index) {
    return this.values[index];
  }
  getSolution(index) {
    return this.solutionSet ? this.solution[index] : 0;
  }
  isFixed(index) {
    return this.fixed[index];
  }
  /** The candidate bitmap of a cell. */
  getCell(index) {
    return this.cells[index];
  }
  isCandidate(index, cand, user = false) {
    return ((user ? this.userCells[index] : this.cells[index]) & MASKS[cand]) !== 0;
  }
  getAnzCandidates(index) {
    return ANZ_VALUES[this.cells[index]];
  }
  getAllCandidates(index) {
    return POSSIBLE_VALUES[this.cells[index]];
  }
  getCandidateString(index) {
    return POSSIBLE_VALUES[this.cells[index]].join("");
  }
  /** Delete a candidate. Returns false if the puzzle becomes invalid (a cell without candidates). */
  delCandidate(index, value, user = false) {
    return this.setCandidate(index, value, false, user);
  }
  /**
   * Set or delete a candidate and keep {@link free} and the singles queues up to date.
   * Returns false if the puzzle becomes invalid by deleting a candidate.
   */
  setCandidate(index, value, set = true, user = false) {
    const ret = this.setCandidateInternal(index, value, set);
    if (user) {
      if (set) this.userCells[index] |= MASKS[value];
      else this.userCells[index] &= ~MASKS[value];
    }
    return ret;
  }
  setCandidateInternal(index, value, set) {
    if (set) {
      if ((this.cells[index] & MASKS[value]) === 0) {
        this.cells[index] |= MASKS[value];
        const newAnz = ANZ_VALUES[this.cells[index]];
        if (newAnz === 1) this.nsQueue.addSingle(index, value);
        else if (newAnz === 2) this.nsQueue.deleteNakedSingle(index);
        for (const c of CONSTRAINTS[index]) {
          const newFree = ++this.free[c][value];
          if (newFree === 1) this.addHiddenSingle(c, value);
          else if (newFree === 2) this.hsQueue.deleteHiddenSingle(c, value);
        }
      }
    } else if ((this.cells[index] & MASKS[value]) !== 0) {
      this.cells[index] &= ~MASKS[value];
      if (this.cells[index] === 0) return false;
      if (ANZ_VALUES[this.cells[index]] === 1) {
        this.nsQueue.addSingle(index, CAND_FROM_MASK[this.cells[index]]);
      }
      for (const c of CONSTRAINTS[index]) {
        const newFree = --this.free[c][value];
        if (newFree === 1) {
          this.addHiddenSingle(c, value);
        } else if (newFree === 0) {
          this.hsQueue.deleteHiddenSingle(c, value);
        }
      }
    }
    return true;
  }
  /**
   * Set a value in a cell, or delete it (value 0). Candidates are adapted:
   * setting a value removes it from all buddies; deleting a value makes it a
   * candidate again where it is not invalid.
   * Returns false if the puzzle becomes invalid.
   */
  setCell(index, value, isFixed = false, user = true) {
    if (this.values[index] === value) return true;
    let valid = true;
    const oldValue = this.values[index];
    this.values[index] = value;
    this.fixed[index] = isFixed;
    if (value !== 0) {
      const cands = POSSIBLE_VALUES[this.cells[index]];
      this.cells[index] = 0;
      if (user) this.userCells[index] = 0;
      this.unsolvedCellsAnz--;
      const buddies = BUDDIES[index].values();
      for (let i = 0; i < buddies.length; i++) {
        const buddyIndex = buddies[i];
        if (!this.setCandidateInternal(buddyIndex, value, false)) valid = false;
        if (user) this.userCells[buddyIndex] &= ~MASKS[value];
      }
      for (const cand of cands) {
        for (const constr of CONSTRAINTS[index]) {
          const newFree = --this.free[constr][cand];
          if (newFree === 1 && value !== cand) this.addHiddenSingle(constr, cand);
          else if (newFree === 0 && cand !== value) valid = false;
        }
      }
    } else {
      for (let cand = 1; cand <= 9; cand++) {
        if (this.isValidValue(index, cand)) this.setCandidate(index, cand);
      }
      for (const buddyIndex of BUDDIES[index].values()) {
        if (this.values[buddyIndex] === 0 && this.isValidValue(buddyIndex, oldValue)) {
          this.setCandidate(buddyIndex, oldValue);
        }
      }
      this.rebuildInternalData();
    }
    return valid;
  }
  /**
   * A simplified {@link set} for the backtracking solver of the generator: copies only candidates,
   * values, free counts and the number of unsolved cells, and clears the singles queues.
   */
  setBS(src) {
    this.cells.set(src.cells);
    this.values.set(src.values);
    for (let i = 0; i < this.free.length; i++) this.free[i].set(src.free[i]);
    this.unsolvedCellsAnz = src.unsolvedCellsAnz;
    this.nsQueue.clear();
    this.hsQueue.clear();
  }
  /**
   * Set a cell without maintaining `free`, the queues and the unsolved counter; call
   * {@link rebuildInternalData} afterwards. Only for building a sudoku from raw values.
   */
  setCellBS(index, value) {
    this.values[index] = value;
    this.cells[index] = 0;
    for (const b of BUDDIES[index].values()) this.cells[b] &= ~MASKS[value];
  }
  /** A value is invalid for a cell if one of its buddies already has that value. */
  isValidValue(index, value) {
    for (const b of BUDDIES[index].values()) {
      if (this.values[b] === value) return false;
    }
    return true;
  }
  isSolved() {
    return this.unsolvedCellsAnz === 0;
  }
  getSolvedCellsAnz() {
    return LENGTH - this.unsolvedCellsAnz;
  }
  getFixedCellsAnz() {
    return this.fixed.reduce((n, f) => n + (f ? 1 : 0), 0);
  }
  /** Total number of candidates still set in unsolved cells. */
  getUnsolvedCandidatesAnz() {
    let anz = 0;
    for (let i = 0; i < LENGTH; i++) anz += ANZ_VALUES[this.cells[i]];
    return anz;
  }
  /**
   * Add the Hidden Single for candidate `value` in `constraint` to the queue.
   * Returns false if no cell with that candidate could be found.
   */
  addHiddenSingle(constraint, value) {
    for (const hsIndex of ALL_UNITS[constraint]) {
      if (this.isCandidate(hsIndex, value)) {
        this.hsQueue.addSingle(hsIndex, value);
        return true;
      }
    }
    return false;
  }
};

// ../core/src/chain.ts
var CAND_MASK = 15;
var STRONG_MASK = 16;
var INDEX_MASK = 127;
var INDEX1_OFFSET = 5;
var INDEX2_OFFSET = 12;
var INDEX3_OFFSET = 19;
var ALS_INDEX_MASK = 67104768;
var ALS_INDEX_OFFSET = 12;
var NO_INDEX = 127;
var MODE_MASK = 1006632960;
var MODE_OFFSET = 26;
var GROUP_NODE_MASK = 67108864;
var ALS_NODE_MASK = 134217728;
var NORMAL_NODE = 0;
var GROUP_NODE = 1;
var ALS_NODE = 2;
var TYPE_NAMES = ["NORMAL_NODE", "GROUP_NODE", "ALS_NODE"];
var Chain = class _Chain {
  /**
   * @param start index of the first node in `chain`
   * @param end index of the last node in `chain` (inclusive)
   */
  constructor(start2, end, chain) {
    this.start = start2;
    this.end = end;
    this.chain = chain;
  }
  /** cached length, -1 = not calculated */
  length = -1;
  clone() {
    return new _Chain(this.start, this.end, this.chain.slice(0, this.end + 1));
  }
  /** The length of the chain. ALS nodes count longer than normal nodes (see the penalty). */
  getLength(alses = null) {
    if (this.length === -1) this.length = this.calculateLength(alses);
    return this.length;
  }
  resetLength() {
    this.length = -1;
  }
  calculateLength(alses) {
    let tmpLength = 0;
    for (let i = this.start; i <= this.end; i++) {
      tmpLength++;
      if (_Chain.getSNodeType(this.chain[i]) === ALS_NODE) {
        if (alses !== null) {
          const alsIndex = _Chain.getSAlsIndex(this.chain[i]);
          tmpLength += alses.length > alsIndex ? alses[alsIndex].chainPenalty : 5;
        } else {
          tmpLength += 2.5;
        }
      }
    }
    return Math.trunc(tmpLength);
  }
  getCellIndex(index) {
    return _Chain.getSCellIndex(this.chain[index]);
  }
  getCandidate(index) {
    return _Chain.getSCandidate(this.chain[index]);
  }
  isStrong(index) {
    return _Chain.isSStrong(this.chain[index]);
  }
  getNodeType(index) {
    return _Chain.getSNodeType(this.chain[index]);
  }
  /** Create a node entry for a single cell. */
  static makeSEntry(cellIndex, candidate, isStrong, nodeType = NORMAL_NODE) {
    return _Chain.makeSEntryFull(cellIndex, 0, 0, candidate, isStrong, nodeType);
  }
  /** Create a node entry for an ALS node (the ALS index is split over the two index fields). */
  static makeSAlsEntry(cellIndex, alsIndex, candidate, isStrong, nodeType) {
    const higher = alsIndex >> 7 & INDEX_MASK;
    const lower = alsIndex & INDEX_MASK;
    return _Chain.makeSEntryFull(cellIndex, lower, higher, candidate, isStrong, nodeType);
  }
  /** Create a node entry; `cellIndex2`/`cellIndex3` are -1 if unused. */
  static makeSEntryFull(cellIndex1, cellIndex2, cellIndex3, candidate, isStrong, nodeType) {
    let entry = cellIndex1 << INDEX1_OFFSET | candidate;
    if (isStrong) entry |= STRONG_MASK;
    if (nodeType === GROUP_NODE) entry |= GROUP_NODE_MASK;
    else if (nodeType === ALS_NODE) entry |= ALS_NODE_MASK;
    if (cellIndex2 === -1) cellIndex2 = nodeType === NORMAL_NODE ? 0 : NO_INDEX;
    if (cellIndex3 === -1) cellIndex3 = nodeType === NORMAL_NODE ? 0 : NO_INDEX;
    entry |= cellIndex2 << INDEX2_OFFSET;
    entry |= cellIndex3 << INDEX3_OFFSET;
    return entry;
  }
  static getSCellIndex(entry) {
    return (entry > 0 ? entry : -entry) >> INDEX1_OFFSET & INDEX_MASK;
  }
  static getSCellIndex2(entry) {
    const result = (entry > 0 ? entry : -entry) >> INDEX2_OFFSET & INDEX_MASK;
    return result === INDEX_MASK ? -1 : result;
  }
  static getSCellIndex3(entry) {
    const result = (entry > 0 ? entry : -entry) >> INDEX3_OFFSET & INDEX_MASK;
    return result === INDEX_MASK ? -1 : result;
  }
  static getSAlsIndex(entry) {
    const e = entry < 0 ? -entry : entry;
    return (e & ALS_INDEX_MASK) >> ALS_INDEX_OFFSET;
  }
  static replaceSAlsIndex(entry, newAlsIndex) {
    let e = entry & ~ALS_INDEX_MASK;
    e |= newAlsIndex << ALS_INDEX_OFFSET & ALS_INDEX_MASK;
    return e;
  }
  static getSCandidate(entry) {
    return (entry > 0 ? entry : -entry) & CAND_MASK;
  }
  static isSStrong(entry) {
    return ((entry > 0 ? entry : -entry) & STRONG_MASK) !== 0;
  }
  static getSNodeType(entry) {
    return ((entry > 0 ? entry : -entry) & MODE_MASK) >> MODE_OFFSET;
  }
  static setSStrong(entry, strong) {
    return strong ? entry | STRONG_MASK : entry & ~STRONG_MASK;
  }
  /** All cells that see a node of normal or group type (group: all cells that see every cell of the group). */
  static getSNodeBuddies(entry, set) {
    const type = _Chain.getSNodeType(entry);
    if (type === NORMAL_NODE) {
      set.set(BUDDIES[_Chain.getSCellIndex(entry)]);
    } else if (type === GROUP_NODE) {
      set.set(BUDDIES[_Chain.getSCellIndex(entry)]);
      set.and(BUDDIES[_Chain.getSCellIndex2(entry)]);
      if (_Chain.getSCellIndex3(entry) !== -1) set.and(BUDDIES[_Chain.getSCellIndex3(entry)]);
    } else {
      throw new Error(`getSNodeBuddies(): node type ${type} needs the ALS list`);
    }
  }
  static entryToString(entry) {
    if (entry === -2147483648) return "MIN";
    const sign = entry < 0 ? "-" : "";
    const type = _Chain.getSNodeType(entry);
    if (type === ALS_NODE) {
      return `${sign}${TYPE_NAMES[type]}/${_Chain.getSAlsIndex(entry)}/${_Chain.getSCellIndex(entry)}/${_Chain.isSStrong(entry)}/${_Chain.getSCandidate(entry)}`;
    }
    return `${sign}${TYPE_NAMES[type]}/${_Chain.getSCellIndex3(entry)}/${_Chain.getSCellIndex2(entry)}/${_Chain.getSCellIndex(entry)}/${_Chain.isSStrong(entry)}/${_Chain.getSCandidate(entry)}`;
  }
  toString() {
    const parts = [];
    for (let i = this.start; i <= this.end; i++) parts.push(_Chain.entryToString(this.chain[i]));
    return parts.join(" ");
  }
};

// ../core/src/generated/defaultSteps.ts
var SOLUTION_CATEGORIES = ["SINGLES", "INTERSECTIONS", "SUBSETS", "BASIC_FISH", "FINNED_BASIC_FISH", "FRANKEN_FISH", "FINNED_FRANKEN_FISH", "MUTANT_FISH", "FINNED_MUTANT_FISH", "SINGLE_DIGIT_PATTERNS", "COLORING", "UNIQUENESS", "CHAINS_AND_LOOPS", "WINGS", "ALMOST_LOCKED_SETS", "ENUMERATIONS", "MISCELLANEOUS", "LAST_RESORT"];
var DEFAULT_DIFFICULTY_LEVELS = [
  { type: "INCOMPLETE", ordinal: 0, maxScore: 0 },
  { type: "EASY", ordinal: 1, maxScore: 800 },
  { type: "MEDIUM", ordinal: 2, maxScore: 1e3 },
  { type: "HARD", ordinal: 3, maxScore: 1600 },
  { type: "UNFAIR", ordinal: 4, maxScore: 1800 },
  { type: "EXTREME", ordinal: 5, maxScore: 2147483647 }
];
var DEFAULT_SOLVER_STEPS = [
  { index: 2147483646, type: "INCOMPLETE", level: 0, category: "LAST_RESORT", baseScore: 0, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 2147483646, enabledProgress: false, enabledTraining: false },
  { index: 2147483647, type: "GIVE_UP", level: 5, category: "LAST_RESORT", baseScore: 2e4, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 2147483647, enabledProgress: true, enabledTraining: false },
  { index: 100, type: "FULL_HOUSE", level: 1, category: "SINGLES", baseScore: 4, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 100, enabledProgress: true, enabledTraining: false },
  { index: 200, type: "NAKED_SINGLE", level: 1, category: "SINGLES", baseScore: 4, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 200, enabledProgress: true, enabledTraining: false },
  { index: 300, type: "HIDDEN_SINGLE", level: 1, category: "SINGLES", baseScore: 14, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 300, enabledProgress: true, enabledTraining: false },
  { index: 1e3, type: "LOCKED_PAIR", level: 2, category: "INTERSECTIONS", baseScore: 40, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 1e3, enabledProgress: true, enabledTraining: false },
  { index: 1100, type: "LOCKED_TRIPLE", level: 2, category: "INTERSECTIONS", baseScore: 60, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 1100, enabledProgress: true, enabledTraining: false },
  { index: 1200, type: "LOCKED_CANDIDATES_1", level: 2, category: "INTERSECTIONS", baseScore: 50, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 1200, enabledProgress: true, enabledTraining: false },
  { index: 1300, type: "NAKED_PAIR", level: 2, category: "SUBSETS", baseScore: 60, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 1300, enabledProgress: true, enabledTraining: false },
  { index: 1400, type: "NAKED_TRIPLE", level: 2, category: "SUBSETS", baseScore: 80, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 1400, enabledProgress: true, enabledTraining: false },
  { index: 1500, type: "HIDDEN_PAIR", level: 2, category: "SUBSETS", baseScore: 70, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 1500, enabledProgress: true, enabledTraining: false },
  { index: 1600, type: "HIDDEN_TRIPLE", level: 2, category: "SUBSETS", baseScore: 100, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 1600, enabledProgress: true, enabledTraining: false },
  { index: 2e3, type: "NAKED_QUADRUPLE", level: 3, category: "SUBSETS", baseScore: 120, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 2e3, enabledProgress: true, enabledTraining: false },
  { index: 2100, type: "HIDDEN_QUADRUPLE", level: 3, category: "SUBSETS", baseScore: 150, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 2100, enabledProgress: true, enabledTraining: false },
  { index: 2200, type: "X_WING", level: 3, category: "BASIC_FISH", baseScore: 140, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 2200, enabledProgress: false, enabledTraining: false },
  { index: 2300, type: "SWORDFISH", level: 3, category: "BASIC_FISH", baseScore: 150, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 2300, enabledProgress: false, enabledTraining: false },
  { index: 2400, type: "JELLYFISH", level: 3, category: "BASIC_FISH", baseScore: 160, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 2400, enabledProgress: false, enabledTraining: false },
  { index: 2500, type: "SQUIRMBAG", level: 4, category: "BASIC_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 2500, enabledProgress: false, enabledTraining: false },
  { index: 2600, type: "WHALE", level: 4, category: "BASIC_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 2600, enabledProgress: false, enabledTraining: false },
  { index: 2700, type: "LEVIATHAN", level: 4, category: "BASIC_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 2700, enabledProgress: false, enabledTraining: false },
  { index: 2800, type: "REMOTE_PAIR", level: 3, category: "CHAINS_AND_LOOPS", baseScore: 110, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 2800, enabledProgress: false, enabledTraining: false },
  { index: 2900, type: "BUG_PLUS_1", level: 3, category: "UNIQUENESS", baseScore: 100, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 2900, enabledProgress: false, enabledTraining: false },
  { index: 3e3, type: "SKYSCRAPER", level: 3, category: "SINGLE_DIGIT_PATTERNS", baseScore: 130, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 3e3, enabledProgress: false, enabledTraining: false },
  { index: 3200, type: "W_WING", level: 3, category: "WINGS", baseScore: 150, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 3200, enabledProgress: false, enabledTraining: false },
  { index: 3100, type: "TWO_STRING_KITE", level: 3, category: "SINGLE_DIGIT_PATTERNS", baseScore: 150, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 3100, enabledProgress: false, enabledTraining: false },
  { index: 3300, type: "XY_WING", level: 3, category: "WINGS", baseScore: 160, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 3300, enabledProgress: false, enabledTraining: false },
  { index: 3400, type: "XYZ_WING", level: 3, category: "WINGS", baseScore: 180, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 3400, enabledProgress: false, enabledTraining: false },
  { index: 3500, type: "UNIQUENESS_1", level: 3, category: "UNIQUENESS", baseScore: 100, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 3500, enabledProgress: false, enabledTraining: false },
  { index: 3600, type: "UNIQUENESS_2", level: 3, category: "UNIQUENESS", baseScore: 100, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 3600, enabledProgress: false, enabledTraining: false },
  { index: 3700, type: "UNIQUENESS_3", level: 3, category: "UNIQUENESS", baseScore: 100, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 3700, enabledProgress: false, enabledTraining: false },
  { index: 3800, type: "UNIQUENESS_4", level: 3, category: "UNIQUENESS", baseScore: 100, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 3800, enabledProgress: false, enabledTraining: false },
  { index: 3900, type: "UNIQUENESS_5", level: 3, category: "UNIQUENESS", baseScore: 100, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 3900, enabledProgress: false, enabledTraining: false },
  { index: 4e3, type: "UNIQUENESS_6", level: 3, category: "UNIQUENESS", baseScore: 100, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 4e3, enabledProgress: false, enabledTraining: false },
  { index: 4100, type: "FINNED_X_WING", level: 3, category: "FINNED_BASIC_FISH", baseScore: 130, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 4100, enabledProgress: false, enabledTraining: false },
  { index: 4200, type: "SASHIMI_X_WING", level: 3, category: "FINNED_BASIC_FISH", baseScore: 150, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 4200, enabledProgress: false, enabledTraining: false },
  { index: 4300, type: "FINNED_SWORDFISH", level: 4, category: "FINNED_BASIC_FISH", baseScore: 200, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 4300, enabledProgress: false, enabledTraining: false },
  { index: 4400, type: "SASHIMI_SWORDFISH", level: 4, category: "FINNED_BASIC_FISH", baseScore: 240, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 4400, enabledProgress: false, enabledTraining: false },
  { index: 4500, type: "FINNED_JELLYFISH", level: 4, category: "FINNED_BASIC_FISH", baseScore: 250, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 4500, enabledProgress: false, enabledTraining: false },
  { index: 4600, type: "SASHIMI_JELLYFISH", level: 4, category: "FINNED_BASIC_FISH", baseScore: 260, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 4600, enabledProgress: false, enabledTraining: false },
  { index: 4700, type: "FINNED_SQUIRMBAG", level: 4, category: "FINNED_BASIC_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 4700, enabledProgress: false, enabledTraining: false },
  { index: 4800, type: "SASHIMI_SQUIRMBAG", level: 4, category: "FINNED_BASIC_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 4800, enabledProgress: false, enabledTraining: false },
  { index: 4900, type: "FINNED_WHALE", level: 4, category: "FINNED_BASIC_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 4900, enabledProgress: false, enabledTraining: false },
  { index: 5e3, type: "SASHIMI_WHALE", level: 4, category: "FINNED_BASIC_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 5e3, enabledProgress: false, enabledTraining: false },
  { index: 5100, type: "FINNED_LEVIATHAN", level: 4, category: "FINNED_BASIC_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 5100, enabledProgress: false, enabledTraining: false },
  { index: 5200, type: "SASHIMI_LEVIATHAN", level: 4, category: "FINNED_BASIC_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 5200, enabledProgress: false, enabledTraining: false },
  { index: 5300, type: "SUE_DE_COQ", level: 4, category: "MISCELLANEOUS", baseScore: 250, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 5300, enabledProgress: false, enabledTraining: false },
  { index: 5400, type: "X_CHAIN", level: 4, category: "CHAINS_AND_LOOPS", baseScore: 260, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 5400, enabledProgress: false, enabledTraining: false },
  { index: 5500, type: "XY_CHAIN", level: 4, category: "CHAINS_AND_LOOPS", baseScore: 260, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 5500, enabledProgress: false, enabledTraining: false },
  { index: 5600, type: "NICE_LOOP", level: 4, category: "CHAINS_AND_LOOPS", baseScore: 280, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 5600, enabledProgress: false, enabledTraining: false },
  { index: 5700, type: "ALS_XZ", level: 4, category: "ALMOST_LOCKED_SETS", baseScore: 300, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 5700, enabledProgress: false, enabledTraining: false },
  { index: 5800, type: "ALS_XY_WING", level: 4, category: "ALMOST_LOCKED_SETS", baseScore: 320, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 5800, enabledProgress: false, enabledTraining: false },
  { index: 5900, type: "ALS_XY_CHAIN", level: 4, category: "ALMOST_LOCKED_SETS", baseScore: 340, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 5900, enabledProgress: false, enabledTraining: false },
  { index: 6e3, type: "DEATH_BLOSSOM", level: 4, category: "ALMOST_LOCKED_SETS", baseScore: 360, adminScore: 0, enabled: false, allStepsEnabled: true, indexProgress: 6e3, enabledProgress: false, enabledTraining: false },
  { index: 6100, type: "FRANKEN_X_WING", level: 4, category: "FRANKEN_FISH", baseScore: 300, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 6100, enabledProgress: false, enabledTraining: false },
  { index: 6200, type: "FRANKEN_SWORDFISH", level: 4, category: "FRANKEN_FISH", baseScore: 350, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 6200, enabledProgress: false, enabledTraining: false },
  { index: 6300, type: "FRANKEN_JELLYFISH", level: 4, category: "FRANKEN_FISH", baseScore: 370, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 6300, enabledProgress: false, enabledTraining: false },
  { index: 6400, type: "FRANKEN_SQUIRMBAG", level: 5, category: "FRANKEN_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 6400, enabledProgress: false, enabledTraining: false },
  { index: 6500, type: "FRANKEN_WHALE", level: 5, category: "FRANKEN_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 6500, enabledProgress: false, enabledTraining: false },
  { index: 6600, type: "FRANKEN_LEVIATHAN", level: 5, category: "FRANKEN_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 6600, enabledProgress: false, enabledTraining: false },
  { index: 6700, type: "FINNED_FRANKEN_X_WING", level: 4, category: "FINNED_FRANKEN_FISH", baseScore: 390, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 6700, enabledProgress: false, enabledTraining: false },
  { index: 6800, type: "FINNED_FRANKEN_SWORDFISH", level: 4, category: "FINNED_FRANKEN_FISH", baseScore: 410, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 6800, enabledProgress: false, enabledTraining: false },
  { index: 6900, type: "FINNED_FRANKEN_JELLYFISH", level: 4, category: "FINNED_FRANKEN_FISH", baseScore: 430, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 6900, enabledProgress: false, enabledTraining: false },
  { index: 7e3, type: "FINNED_FRANKEN_SQUIRMBAG", level: 5, category: "FINNED_FRANKEN_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 7e3, enabledProgress: false, enabledTraining: false },
  { index: 7100, type: "FINNED_FRANKEN_WHALE", level: 5, category: "FINNED_FRANKEN_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 7100, enabledProgress: false, enabledTraining: false },
  { index: 7200, type: "FINNED_FRANKEN_LEVIATHAN", level: 5, category: "FINNED_FRANKEN_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 7200, enabledProgress: false, enabledTraining: false },
  { index: 7300, type: "MUTANT_X_WING", level: 5, category: "MUTANT_FISH", baseScore: 450, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 7300, enabledProgress: false, enabledTraining: false },
  { index: 7400, type: "MUTANT_SWORDFISH", level: 5, category: "MUTANT_FISH", baseScore: 450, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 7400, enabledProgress: false, enabledTraining: false },
  { index: 7500, type: "MUTANT_JELLYFISH", level: 5, category: "MUTANT_FISH", baseScore: 450, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 7500, enabledProgress: false, enabledTraining: false },
  { index: 7600, type: "MUTANT_SQUIRMBAG", level: 5, category: "MUTANT_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 7600, enabledProgress: false, enabledTraining: false },
  { index: 7700, type: "MUTANT_WHALE", level: 5, category: "MUTANT_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 7700, enabledProgress: false, enabledTraining: false },
  { index: 7800, type: "MUTANT_LEVIATHAN", level: 5, category: "MUTANT_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 7800, enabledProgress: false, enabledTraining: false },
  { index: 7900, type: "FINNED_MUTANT_X_WING", level: 5, category: "FINNED_MUTANT_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 7900, enabledProgress: false, enabledTraining: false },
  { index: 8e3, type: "FINNED_MUTANT_SWORDFISH", level: 5, category: "FINNED_MUTANT_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 8e3, enabledProgress: false, enabledTraining: false },
  { index: 8100, type: "FINNED_MUTANT_JELLYFISH", level: 5, category: "FINNED_MUTANT_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 8100, enabledProgress: false, enabledTraining: false },
  { index: 8200, type: "FINNED_MUTANT_SQUIRMBAG", level: 5, category: "FINNED_MUTANT_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 8200, enabledProgress: false, enabledTraining: false },
  { index: 8300, type: "FINNED_MUTANT_WHALE", level: 5, category: "FINNED_MUTANT_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 8300, enabledProgress: false, enabledTraining: false },
  { index: 8400, type: "FINNED_MUTANT_LEVIATHAN", level: 5, category: "FINNED_MUTANT_FISH", baseScore: 470, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 8400, enabledProgress: false, enabledTraining: false },
  { index: 8700, type: "TEMPLATE_SET", level: 5, category: "LAST_RESORT", baseScore: 1e4, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 8700, enabledProgress: false, enabledTraining: false },
  { index: 8800, type: "TEMPLATE_DEL", level: 5, category: "LAST_RESORT", baseScore: 1e4, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 8800, enabledProgress: false, enabledTraining: false },
  { index: 8500, type: "FORCING_CHAIN", level: 5, category: "LAST_RESORT", baseScore: 500, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 8500, enabledProgress: false, enabledTraining: false },
  { index: 8600, type: "FORCING_NET", level: 5, category: "LAST_RESORT", baseScore: 700, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 8600, enabledProgress: false, enabledTraining: false },
  { index: 8900, type: "BRUTE_FORCE", level: 5, category: "LAST_RESORT", baseScore: 1e4, adminScore: 0, enabled: true, allStepsEnabled: false, indexProgress: 8900, enabledProgress: false, enabledTraining: false },
  { index: 5650, type: "GROUPED_NICE_LOOP", level: 4, category: "CHAINS_AND_LOOPS", baseScore: 300, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 5650, enabledProgress: false, enabledTraining: false },
  { index: 3170, type: "EMPTY_RECTANGLE", level: 3, category: "SINGLE_DIGIT_PATTERNS", baseScore: 120, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 3170, enabledProgress: false, enabledTraining: false },
  { index: 4010, type: "HIDDEN_RECTANGLE", level: 3, category: "UNIQUENESS", baseScore: 100, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 4010, enabledProgress: false, enabledTraining: false },
  { index: 4020, type: "AVOIDABLE_RECTANGLE_1", level: 3, category: "UNIQUENESS", baseScore: 100, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 4020, enabledProgress: false, enabledTraining: false },
  { index: 4030, type: "AVOIDABLE_RECTANGLE_2", level: 3, category: "UNIQUENESS", baseScore: 100, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 4030, enabledProgress: false, enabledTraining: false },
  { index: 5330, type: "SIMPLE_COLORS", level: 3, category: "COLORING", baseScore: 150, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 5330, enabledProgress: false, enabledTraining: false },
  { index: 5360, type: "MULTI_COLORS", level: 3, category: "COLORING", baseScore: 200, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 5360, enabledProgress: false, enabledTraining: false },
  { index: 8450, type: "KRAKEN_FISH", level: 5, category: "LAST_RESORT", baseScore: 500, adminScore: 0, enabled: false, allStepsEnabled: false, indexProgress: 8450, enabledProgress: false, enabledTraining: false },
  { index: 3120, type: "TURBOT_FISH", level: 3, category: "SINGLE_DIGIT_PATTERNS", baseScore: 120, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 3120, enabledProgress: false, enabledTraining: false },
  { index: 1210, type: "LOCKED_CANDIDATES_2", level: 2, category: "INTERSECTIONS", baseScore: 50, adminScore: 0, enabled: true, allStepsEnabled: true, indexProgress: 1210, enabledProgress: true, enabledTraining: false }
];

// ../core/src/solutionType.ts
function isSingle(type) {
  return type === "HIDDEN_SINGLE" || type === "NAKED_SINGLE" || type === "FULL_HOUSE";
}
function isHiddenSubset(type) {
  return isSingle(type) || type === "HIDDEN_PAIR" || type === "HIDDEN_TRIPLE" || type === "HIDDEN_QUADRUPLE";
}
var CONFIG_BY_TYPE = new Map(DEFAULT_SOLVER_STEPS.map((c) => [c.type, c]));
function getStepConfig(type) {
  let t = type;
  if (t === "CONTINUOUS_NICE_LOOP" || t === "DISCONTINUOUS_NICE_LOOP" || t === "AIC") t = "NICE_LOOP";
  if (t === "GROUPED_CONTINUOUS_NICE_LOOP" || t === "GROUPED_DISCONTINUOUS_NICE_LOOP" || t === "GROUPED_AIC") {
    t = "GROUPED_NICE_LOOP";
  }
  if (t === "FORCING_CHAIN_CONTRADICTION" || t === "FORCING_CHAIN_VERITY") t = "FORCING_CHAIN";
  if (t === "FORCING_NET_CONTRADICTION" || t === "FORCING_NET_VERITY") t = "FORCING_NET";
  if (t === "KRAKEN_FISH_TYPE_1" || t === "KRAKEN_FISH_TYPE_2") t = "KRAKEN_FISH";
  if (t === "DUAL_TWO_STRING_KITE") t = "TWO_STRING_KITE";
  if (t === "DUAL_EMPTY_RECTANGLE") t = "EMPTY_RECTANGLE";
  if (t === "SIMPLE_COLORS_TRAP" || t === "SIMPLE_COLORS_WRAP") t = "SIMPLE_COLORS";
  if (t === "MULTI_COLORS_1" || t === "MULTI_COLORS_2") t = "MULTI_COLORS";
  return CONFIG_BY_TYPE.get(t);
}
function isFish(type) {
  const c = getStepConfig(type)?.category;
  return c === "BASIC_FISH" || c === "FINNED_BASIC_FISH" || c === "FRANKEN_FISH" || c === "FINNED_FRANKEN_FISH" || c === "MUTANT_FISH" || c === "FINNED_MUTANT_FISH";
}
function categoryIs(type, ...categories) {
  const c = getStepConfig(type)?.category;
  return c !== void 0 && categories.includes(c);
}
function isBasicFish(type) {
  return categoryIs(type, "BASIC_FISH", "FINNED_BASIC_FISH");
}
function isFrankenFish(type) {
  return categoryIs(type, "FRANKEN_FISH", "FINNED_FRANKEN_FISH");
}
function isMutantFish(type) {
  return categoryIs(type, "MUTANT_FISH", "FINNED_MUTANT_FISH");
}
function isKrakenFish(type) {
  return type === "KRAKEN_FISH" || type === "KRAKEN_FISH_TYPE_1" || type === "KRAKEN_FISH_TYPE_2";
}
function isSashimiFish(type) {
  return type === "SASHIMI_X_WING" || type === "SASHIMI_SWORDFISH" || type === "SASHIMI_JELLYFISH" || type === "SASHIMI_SQUIRMBAG" || type === "SASHIMI_LEVIATHAN" || type === "SASHIMI_WHALE";
}
function getFishSize(type) {
  const name = type;
  if (name.endsWith("X_WING")) return 2;
  if (name.endsWith("SWORDFISH")) return 3;
  if (name.endsWith("JELLYFISH")) return 4;
  if (name.endsWith("SQUIRMBAG")) return 5;
  if (name.endsWith("WHALE")) return 6;
  return 7;
}
function compareTypes(a, b) {
  const s1 = getStepConfig(a);
  const s2 = getStepConfig(b);
  if (isFish(a) && isFish(b)) {
    const categories = SOLUTION_CATEGORIES;
    const c1 = categories.indexOf(s1.category);
    const c2 = categories.indexOf(s2.category);
    if (c1 !== c2) return c1 - c2;
    const size = getFishSize(a) - getFishSize(b);
    if (size !== 0) return size;
    const sa = isSashimiFish(a);
    const sb = isSashimiFish(b);
    if (sa && sb || !sa && !sb) return 0;
    return sa ? 1 : -1;
  }
  return s1.index - s2.index;
}

// ../core/src/solutionStep.ts
var Candidate = class {
  constructor(index, value) {
    this.index = index;
    this.value = value;
  }
  equals(o) {
    return this.index === o.index && this.value === o.value;
  }
  toString() {
    return `${this.index}/${this.value}`;
  }
};
var SolutionStep = class _SolutionStep {
  type;
  /** Digits that are set (singles) or that form the subset/pattern. */
  values = [];
  /** Cells that are set (singles) or that form the subset/pattern. */
  indices = [];
  candidatesToDelete = [];
  /** Fins (finned fish) or, for patterns like Empty Rectangle and 2-String Kite, the cells of the connecting block. */
  fins = [];
  /** Endo fins (finned fish) or, for Avoidable Rectangles Type 2, the cells with the additional candidate. */
  endoFins = [];
  /** Coloring steps: the color (0, 1, ...) of every colored cell. */
  colorCandidates = /* @__PURE__ */ new Map();
  /** Almost locked sets that are part of the step (Sue de Coq, ALS techniques): cells and candidate mask. */
  alses = [];
  /** Candidates that are eliminated by the fish itself (cannibalistic fish). */
  cannibalistic = [];
  /** Chains (X-Chain, XY-Chain, Remote Pair, Nice Loop, ...) of the step. */
  chains = [];
  /** Fish that is part of a Kraken Fish step: the type of the fish. */
  subType = null;
  isSiamese = false;
  /** ALS techniques: the restricted commons that link the ALS. */
  restrictedCommons = [];
  /** Fish: the units of the base set and of the cover set. */
  baseEntities = [];
  coverEntities = [];
  /** Fish: all potential eliminations (cover candidates that are not base candidates), and the cannibalistic ones. */
  potentialEliminations = new SudokuSet();
  potentialCannibalisticEliminations = new SudokuSet();
  /** Unit type (see BLOCK/LINE/COL in tables) for steps that have one, e.g. Locked Candidates. */
  entity = 0;
  /** 1-based number of that unit. */
  entityNumber = 0;
  constructor(type) {
    this.type = type;
  }
  addValue(value) {
    this.values.push(value);
  }
  addIndex(index) {
    this.indices.push(index);
  }
  addCandidateToDelete(index, candidate) {
    this.candidatesToDelete.push(new Candidate(index, candidate));
  }
  /** Add an existing chain object (not a copy). */
  addChainObject(chain) {
    this.chains.push(chain);
  }
  addChain(start2, end, chain) {
    this.chains.push(new Chain(start2, end, chain));
  }
  addCannibalistic(index, candidate) {
    this.cannibalistic.push(new Candidate(index, candidate));
  }
  addAls(indices, candidates) {
    this.alses.push({ indices: [...indices], candidates });
  }
  addColorCandidate(index, color) {
    this.colorCandidates.set(index, color);
  }
  addColorCandidates(indices, color) {
    for (const index of indices) this.addColorCandidate(index, color);
  }
  addEndoFin(index, candidate) {
    this.endoFins.push(new Candidate(index, candidate));
  }
  addFin(index, candidate) {
    this.fins.push(new Candidate(index, candidate));
  }
  getAnzCandidatesToDelete() {
    return this.candidatesToDelete.length;
  }
  clone() {
    const s = new _SolutionStep(this.type);
    s.values = this.values.slice();
    s.indices = this.indices.slice();
    s.candidatesToDelete = this.candidatesToDelete.map((c) => new Candidate(c.index, c.value));
    s.fins = this.fins.map((c) => new Candidate(c.index, c.value));
    s.endoFins = this.endoFins.map((c) => new Candidate(c.index, c.value));
    s.colorCandidates = new Map(this.colorCandidates);
    s.alses = this.alses.map((a) => ({ indices: a.indices.slice(), candidates: a.candidates }));
    s.cannibalistic = this.cannibalistic.map((c) => new Candidate(c.index, c.value));
    s.chains = this.chains.map((c) => c.clone());
    s.subType = this.subType;
    s.isSiamese = this.isSiamese;
    s.restrictedCommons = this.restrictedCommons.map((r) => r.clone());
    s.baseEntities = this.baseEntities.map((e) => ({ ...e }));
    s.coverEntities = this.coverEntities.map((e) => ({ ...e }));
    s.potentialEliminations = this.potentialEliminations.clone();
    s.potentialCannibalisticEliminations = this.potentialCannibalisticEliminations.clone();
    s.entity = this.entity;
    s.entityNumber = this.entityNumber;
    return s;
  }
  /** A step that sets a cell (note: includes Template Set, unlike the solver's notion of a single). */
  isSingle() {
    return isSingleType(this.type);
  }
  /**
   * Sort the candidates to delete (by digit, then cell) and remove duplicates.
   * The original does this as a side effect of building the candidate string; chain
   * solvers rely on it, so the order of `candidatesToDelete` in their steps is sorted.
   */
  normalizeCandidatesToDelete() {
    const sorted = [...this.candidatesToDelete].sort(compareCandidates);
    this.candidatesToDelete = sorted.filter((c, i) => i === 0 || compareCandidates(sorted[i - 1], c) !== 0);
  }
  /**
   * A key that identifies the set of eliminations (used to detect the same step twice); with
   * `withType` the step type is part of the key. Sorts the candidates to delete.
   */
  getCandidateKey(withType = false) {
    this.normalizeCandidatesToDelete();
    const key = this.candidatesToDelete.map((c) => `${c.value}:${c.index}`).join(" ");
    return withType ? `${this.type}|${key}` : key;
  }
  /** A key that identifies a step that sets cells: type, cells and value. */
  getSingleCandidateKey() {
    const cells = [...new Set(this.indices)].sort((a, b) => a - b).join(",");
    return `${this.type}|${cells}=${this.values[0]}`;
  }
  /** True if a chain of the step contains a net (a negative node). */
  isNet() {
    for (const chain of this.chains) {
      for (let j = chain.start; j <= chain.end; j++) {
        if (chain.chain[j] < 0) return true;
      }
    }
    return false;
  }
  /** Compare the candidates to delete: more first, then one by one by cell and digit. */
  compareCandidatesToDelete(o) {
    const size1 = this.candidatesToDelete.length;
    const size2 = o.candidatesToDelete.length;
    if (size1 !== size2) return size2 - size1;
    for (let i = 0; i < size1; i++) {
      const c1 = this.candidatesToDelete[i];
      const c2 = o.candidatesToDelete[i];
      const result = c1.index * 10 + c1.value - (c2.index * 10 + c2.value);
      if (result !== 0) return result;
    }
    return 0;
  }
  /** Total number of cells in all ALS of the step. */
  getAlsesIndexCount() {
    return this.alses.reduce((n, a) => n + a.indices.length, 0);
  }
  /** The weighted sum of the indices of the candidates to delete (sort criterion). */
  getIndexSumme() {
    return getIndexSumme(this.candidatesToDelete);
  }
  getChainLength() {
    let length = 0;
    const penalties = this.alses.map((a) => ({ chainPenalty: getAlsChainPenalty(a.indices.length) }));
    for (const chain of this.chains) length += chain.getLength(penalties);
    return length;
  }
  /**
   * Two steps are equivalent if they have the same type (all fish count as the same type)
   * and eliminate the same candidates (or set the same cells).
   */
  isEquivalent(s) {
    if (isFish(this.type) && isFish(s.type)) return true;
    if (isKrakenFish(this.type) && isKrakenFish(s.type)) return true;
    if (this.type !== s.type) return false;
    if (this.candidatesToDelete.length > 0) return isEqualCandidate(this.candidatesToDelete, s.candidatesToDelete);
    return isEqualInteger(this.indices, s.indices);
  }
  /**
   * The sort order of steps: steps that set a cell first, then the steps that eliminate the
   * most candidates, then (for equivalent steps) shorter chains, fewer fins, and so on.
   */
  compareTo(o) {
    if (isSingleType(this.type) && !isSingleType(o.type)) return -1;
    if (!isSingleType(this.type) && isSingleType(o.type)) return 1;
    const result = o.candidatesToDelete.length - this.candidatesToDelete.length;
    if (result !== 0) return result;
    if (!this.isEquivalent(o)) {
      return getIndexSumme(this.candidatesToDelete) - getIndexSumme(o.candidatesToDelete);
    }
    if (isFish(this.type) && isFish(o.type)) {
      let ret = compareTypes(this.type, o.type);
      if (ret !== 0) return ret;
      ret = this.cannibalistic.length - o.cannibalistic.length;
      if (ret !== 0) return ret;
      ret = this.endoFins.length - o.endoFins.length;
      if (ret !== 0) return ret;
      ret = this.fins.length - o.fins.length;
      if (ret !== 0) return ret;
      if (!isEqualInteger(this.values, o.values)) return sum(this.values) - sum(o.values);
      return 0;
    }
    if (isKrakenFish(this.type) && isKrakenFish(o.type)) {
      const ret = compareTypes(this.subType, o.subType);
      if (ret !== 0) return ret;
      return this.getChainLength() - o.getChainLength();
    }
    const chainDiff = this.getChainLength() - o.getChainLength();
    if (chainDiff !== 0) return chainDiff;
    if (!isEqualInteger(this.values, o.values)) return sum(this.values) - sum(o.values);
    if (!isEqualInteger(this.indices, o.indices)) {
      if (this.indices.length !== o.indices.length) return this.indices.length - o.indices.length;
      return sum(o.indices) - sum(this.indices);
    }
    return compareTypes(this.type, o.type);
  }
};
function getAlsChainPenalty(size) {
  if (size === 0 || size === 1) return 0;
  if (size === 2) return size - 1;
  return (size - 1) * 2;
}
function isSingleType(type) {
  return type === "FULL_HOUSE" || type === "HIDDEN_SINGLE" || type === "NAKED_SINGLE" || type === "TEMPLATE_SET";
}
function compareCandidates(a, b) {
  return a.value - b.value || a.index - b.index;
}
function sum(list) {
  return list.reduce((a, b) => a + b, 0);
}
function isEqualInteger(l1, l2) {
  if (l1.length !== l2.length) return false;
  return l1.every((v) => l2.includes(v));
}
function isEqualCandidate(l1, l2) {
  if (l1.length !== l2.length) return false;
  return l1.every((c1) => l2.some((c2) => c1.index === c2.index && c1.value === c2.value));
}
function getIndexSumme(list) {
  let total = 0;
  let offset = 1;
  for (const c of list) {
    total += c.index * offset + c.value;
    offset += 80;
  }
  return total;
}

// ../core/src/options.ts
function getDifficultyLevel(ordinal) {
  return DEFAULT_DIFFICULTY_LEVELS[ordinal];
}
function defaultSolverSteps() {
  return DEFAULT_SOLVER_STEPS.map((s) => ({ ...s })).sort((a, b) => a.index - b.index);
}

// ../core/src/solverOptions.ts
var DEFAULT_SOLVER_OPTIONS = {
  allowDualsAndSiamese: false,
  allowErsWithOnlyTwoCandidates: false,
  allowUniquenessMissingCandidates: true,
  maxFins: 5,
  maxEndoFins: 2,
  onlyOneFishPerStep: true,
  restrictChainSize: true,
  restrictChainLength: 20,
  restrictNiceLoopLength: 10,
  onlyOneAlsPerStep: true,
  anzTableLookAhead: 4,
  onlyOneChainPerStep: true,
  allowAlsInTablingChains: false,
  allowAlsOverlap: false
};

// ../core/src/als.ts
function getChainPenalty(candSize) {
  if (candSize === 0 || candSize === 1) return 0;
  if (candSize === 2) return candSize - 1;
  return (candSize - 1) * 2;
}
var Als = class {
  indices;
  /** candidate mask of all cells */
  candidates;
  /** for every candidate (1-9): the cells of the ALS that contain it */
  indicesPerCandidat = new Array(10);
  /** for every candidate: cells outside the ALS that see all its cells and still contain the candidate */
  buddiesPerCandidat = new Array(10);
  /** the same plus the ALS cells that hold the candidate */
  buddiesAlsPerCandidat = new Array(10);
  /** all cells in buddiesPerCandidat */
  buddies = new SudokuSet();
  chainPenaltyCache = -1;
  constructor(indices, candidates) {
    this.indices = new SudokuSet(indices);
    this.candidates = candidates;
  }
  /** Compute the per-candidate sets. `candidates` are the cells that still hold each candidate. */
  computeFields(candidates) {
    this.buddies = new SudokuSet();
    for (let i = 1; i <= 9; i++) {
      if ((this.candidates & MASKS[i]) === 0) continue;
      const indicesPerCandidat = new SudokuSet(this.indices);
      indicesPerCandidat.and(candidates[i]);
      this.indicesPerCandidat[i] = indicesPerCandidat;
      const buddiesPerCandidat = new SudokuSet();
      getBuddiesOfSet(indicesPerCandidat, buddiesPerCandidat);
      buddiesPerCandidat.andNot(this.indices);
      buddiesPerCandidat.and(candidates[i]);
      this.buddiesPerCandidat[i] = buddiesPerCandidat;
      const buddiesAls = new SudokuSet(buddiesPerCandidat);
      buddiesAls.or(indicesPerCandidat);
      this.buddiesAlsPerCandidat[i] = buddiesAls;
      this.buddies.or(buddiesPerCandidat);
    }
  }
  get chainPenalty() {
    if (this.chainPenaltyCache === -1) this.chainPenaltyCache = getChainPenalty(ANZ_VALUES[this.candidates]);
    return this.chainPenaltyCache;
  }
  /** Two ALS are equal if they contain the same cells. */
  equals(o) {
    return this.indices.equals(o.indices);
  }
};

// ../core/src/restrictedCommon.ts
var RestrictedCommon = class _RestrictedCommon {
  constructor(als1, als2, cand1, cand2 = 0, actualRC = 0) {
    this.als1 = als1;
    this.als2 = als2;
    this.cand1 = cand1;
    this.cand2 = cand2;
    this.actualRC = actualRC;
  }
  /**
   * Check this RC against the RC `rc` of the previous step of a chain (adjacency rules) and set
   * `actualRC` accordingly. At the start of a chain (`rc == null`) both candidates are tried
   * one after the other (`firstTry`). Returns false if the RC cannot follow `rc`.
   */
  checkRC(rc, firstTry) {
    this.actualRC = this.cand2 === 0 ? 1 : 3;
    if (rc === null) {
      if (this.cand2 !== 0) this.actualRC = firstTry ? 1 : 2;
      return this.actualRC !== 0;
    }
    switch (rc.actualRC) {
      case 0:
        break;
      case 1:
        this.actualRC = checkRCInt(rc.cand1, 0, this.cand1, this.cand2);
        break;
      case 2:
        this.actualRC = checkRCInt(rc.cand2, 0, this.cand1, this.cand2);
        break;
      case 3:
        this.actualRC = checkRCInt(rc.cand1, rc.cand1, this.cand1, this.cand2);
        break;
      default:
        break;
    }
    return this.actualRC !== 0;
  }
  /** Order by ALS indices, then candidates. */
  compareTo(r) {
    return this.als1 - r.als1 || this.als2 - r.als2 || this.cand1 - r.cand1 || this.cand2 - r.cand2;
  }
  clone() {
    return new _RestrictedCommon(this.als1, this.als2, this.cand1, this.cand2, this.actualRC);
  }
  toString() {
    return `RC(${this.als1}/${this.als2}/${this.cand1}/${this.cand2}/${this.actualRC})`;
  }
};
function checkRCInt(c11, c12, c21, c22) {
  if (c12 === 0) {
    if (c22 === 0) {
      return c11 === c21 ? 0 : 1;
    }
    if (c11 === c22) return 1;
    if (c11 === c21) return 2;
    return 3;
  }
  if (c22 === 0) {
    return c11 === c21 || c12 === c21 ? 0 : 1;
  }
  if (c11 === c21 && c12 === c22 || c11 === c22 && c12 === c21) return 0;
  if (c11 === c22 || c12 === c22) return 1;
  if (c11 === c21 || c12 === c21) return 2;
  return 3;
}

// ../core/src/solver/abstractSolver.ts
var AbstractSolver = class {
  constructor(finder) {
    this.finder = finder;
  }
  sudoku;
};

// ../core/src/solver/alsSolver.ts
var MAX_RC = 50;
var RCForDeathBlossom = class {
  /** A mask with every candidate set that has at least one ALS. */
  candMask = 0;
  /** All ALS for every candidate. */
  alsPerCandidate = Array.from({ length: 10 }, () => new Array(100).fill(0));
  /** Number of ALS in alsPerCandidate for every candidate. */
  indices = new Array(10).fill(0);
  addAlsForCandidate(als, candidate) {
    if (this.indices[candidate] < this.alsPerCandidate[candidate].length) {
      this.alsPerCandidate[candidate][this.indices[candidate]++] = als;
      this.candMask |= MASKS[candidate];
    }
  }
};
function compareAlsSteps(o1, o2) {
  const result = o2.candidatesToDelete.length - o1.candidatesToDelete.length;
  if (result !== 0) return result;
  if (!o1.isEquivalent(o2)) {
    return o1.getIndexSumme() - o2.getIndexSumme();
  }
  const alsDiff = o1.alses.length - o2.alses.length;
  if (alsDiff !== 0) return alsDiff;
  const countDiff = o1.getAlsesIndexCount() - o2.getAlsesIndexCount();
  if (countDiff !== 0) return countDiff;
  return compareTypes(o1.type, o2.type);
}
var AlsSolver = class extends AbstractSolver {
  alses = [];
  restrictedCommons = [];
  startIndices = [];
  endIndices = [];
  /** all chains found so far: eliminations -> index of the step in `steps` */
  deletesMap = /* @__PURE__ */ new Map();
  steps = [];
  /** The step that is being assembled. */
  globalStep = new SolutionStep("HIDDEN_SINGLE");
  /** The current ALS chain: consists only of its RCs. */
  chain = new Array(MAX_RC).fill(null);
  chainIndex = -1;
  /** The first RC in the current chain */
  firstRC = null;
  /** Chain search: true for every ALS already in the chain. */
  alsInChain = [];
  startAls;
  restrictedCommonBuddiesSet = new SudokuSet();
  restrictedCommonIndexSet = new SudokuSet();
  // Death Blossom state
  rcdb = new Array(LENGTH).fill(null);
  aktRcdb;
  aktDBIndices = new SudokuSet();
  aktDBCandidates = 0;
  incDBCand = new Array(10).fill(0);
  aktDBAls = new Array(10).fill(-1);
  dbIndicesPerCandidate = new SudokuSet();
  maxDBCand = 0;
  stemCellIndex = 0;
  tmpSet = new SudokuSet();
  tmpSet1 = new SudokuSet();
  constructor(finder) {
    super(finder);
  }
  getStep(type) {
    this.sudoku = this.finder.getSudoku();
    this.finder.setRcOnlyForward(true);
    switch (type) {
      case "ALS_XZ":
        return this.getAlsXZ();
      case "ALS_XY_WING":
        return this.getAlsXYWing();
      case "ALS_XY_CHAIN":
        if (this.chain.length !== MAX_RC) this.chain = new Array(MAX_RC).fill(null);
        return this.getAlsXYChain();
      case "DEATH_BLOSSOM":
        return this.getAlsDeathBlossom();
      default:
        return null;
    }
  }
  doStep(step) {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case "ALS_XZ":
      case "ALS_XY_WING":
      case "ALS_XY_CHAIN":
      case "DEATH_BLOSSOM":
        for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        return true;
      default:
        return false;
    }
  }
  getAlsDeathBlossom() {
    this.steps = [];
    this.collectAllAlses();
    this.collectAllRCsForDeathBlossom();
    return this.getAlsDeathBlossomInt();
  }
  getAlsXYChain() {
    this.steps = [];
    this.collectAllAlses();
    this.collectAllRestrictedCommons(this.finder.options.allowAlsOverlap);
    this.getAlsXYChainInt();
    if (this.steps.length > 0) {
      this.steps.sort(compareAlsSteps);
      return this.steps[0];
    }
    return null;
  }
  getAlsXYWing() {
    this.steps = [];
    this.collectAllAlses();
    this.collectAllRestrictedCommons(this.finder.options.allowAlsOverlap);
    return this.getAlsXYWingInt();
  }
  getAlsXZ() {
    this.steps = [];
    this.collectAllAlses();
    this.collectAllRestrictedCommons(this.finder.options.allowAlsOverlap);
    return this.getAlsXZInt();
  }
  /**
   * Check all restricted commons: for every RC check all candidates common to both ALS but minus the
   * RC candidate(s). If buddies exist outside the ALS they can be eliminated.
   *
   * Doubly linked ALS-XZ: if two ALS are linked by 2 RCs, the rest of each ALS becomes a locked
   * set and eliminates additional candidates; each of the two RCs can be used for "normal" ALS-XZ
   * eliminations as well.
   */
  getAlsXZInt() {
    for (const rc of this.restrictedCommons) {
      if (rc.als1 > rc.als2) continue;
      const step = new SolutionStep("ALS_XZ");
      this.globalStep = step;
      const als1 = this.alses[rc.als1];
      const als2 = this.alses[rc.als2];
      this.checkCandidatesToDelete(als1, als2, rc.cand1);
      if (rc.cand2 !== 0) {
        this.checkCandidatesToDelete(als1, als2, rc.cand2);
        const d1 = this.checkDoublyLinkedAls(als1, als2, rc.cand1, rc.cand2);
        const d2 = this.checkDoublyLinkedAls(als2, als1, rc.cand1, rc.cand2);
        if (d1 || d2) step.fins = [];
      }
      if (step.candidatesToDelete.length > 0) {
        step.addAls(als1.indices, als1.candidates);
        step.addAls(als2.indices, als2.candidates);
        this.addRestrictedCommonToStep(als1, als2, rc.cand1, false);
        if (rc.cand2 !== 0) this.addRestrictedCommonToStep(als1, als2, rc.cand2, false);
        return step;
      }
    }
    return null;
  }
  /**
   * Check all combinations of two RCs for an ALS XY-Wing: three different ALS are needed, and if
   * both RCs have only one candidate those candidates must differ. Then ALS C is identified and
   * ALS A and B are checked for eliminations.
   */
  getAlsXYWingInt() {
    const rcs = this.restrictedCommons;
    for (let i = 0; i < rcs.length; i++) {
      const rc1 = rcs[i];
      for (let j = i + 1; j < rcs.length; j++) {
        const rc2 = rcs[j];
        if (rc1.cand2 === 0 && rc2.cand2 === 0 && rc1.cand1 === rc2.cand1) continue;
        if (!(rc1.als1 === rc2.als1 && rc1.als2 !== rc2.als2 || rc1.als2 === rc2.als1 && rc1.als1 !== rc2.als2 || rc1.als1 === rc2.als2 && rc1.als2 !== rc2.als1 || rc1.als2 === rc2.als2 && rc1.als1 !== rc2.als1)) {
          continue;
        }
        let a = null;
        let b = null;
        let c = null;
        if (rc1.als1 === rc2.als1) {
          c = this.alses[rc1.als1];
          a = this.alses[rc1.als2];
          b = this.alses[rc2.als2];
        }
        if (rc1.als1 === rc2.als2) {
          c = this.alses[rc1.als1];
          a = this.alses[rc1.als2];
          b = this.alses[rc2.als1];
        }
        if (rc1.als2 === rc2.als1) {
          c = this.alses[rc1.als2];
          a = this.alses[rc1.als1];
          b = this.alses[rc2.als2];
        }
        if (rc1.als2 === rc2.als2) {
          c = this.alses[rc1.als2];
          a = this.alses[rc1.als1];
          b = this.alses[rc2.als1];
        }
        if (a === null || b === null || c === null) continue;
        if (!this.finder.options.allowAlsOverlap) {
          this.tmpSet.set(a.indices);
          if (!this.tmpSet.andEmpty(b.indices)) continue;
        }
        this.tmpSet.set(a.indices);
        this.tmpSet.or(b.indices);
        if (this.tmpSet.equals(a.indices) || this.tmpSet.equals(b.indices)) continue;
        const step = new SolutionStep("ALS_XY_WING");
        this.globalStep = step;
        this.checkCandidatesToDelete(a, b, rc1.cand1, rc1.cand2, rc2.cand1, rc2.cand2);
        if (step.candidatesToDelete.length > 0) {
          step.addAls(a.indices, a.candidates);
          step.addAls(b.indices, b.candidates);
          step.addAls(c.indices, c.candidates);
          this.addRestrictedCommonToStep(a, c, rc1.cand1, false);
          if (rc1.cand2 !== 0) this.addRestrictedCommonToStep(a, c, rc1.cand2, false);
          this.addRestrictedCommonToStep(b, c, rc2.cand1, false);
          if (rc2.cand2 !== 0) this.addRestrictedCommonToStep(b, c, rc2.cand2, false);
          return step;
        }
      }
    }
    return null;
  }
  /**
   * ALS chains: all combinations starting with every ALS. Rules: two adjacent ALS may overlap as long
   * as the overlapping area doesn't contain an RC; two non adjacent ALS may overlap without
   * restrictions; a chain must be at least 4 ALS long; start and end ALS must have a common
   * candidate outside the chain which can be eliminated. Adjacent RCs follow the adjacency rules
   * (see RestrictedCommon.checkRC). Loops and whips are not handled.
   */
  getAlsXYChainInt() {
    this.deletesMap.clear();
    for (let i = 0; i < this.alses.length; i++) {
      this.startAls = this.alses[i];
      this.chainIndex = 0;
      if (this.alsInChain.length < this.alses.length) this.alsInChain = new Array(this.alses.length).fill(false);
      else this.alsInChain.fill(false);
      this.alsInChain[i] = true;
      this.firstRC = null;
      this.getAlsXYChainRecursive(i, null);
    }
  }
  /**
   * For ALS `alsIndex` check all RCs. If the RC fulfills the adjacency rules and the ALS it points to
   * is not in the chain yet, add it and continue recursively. From chain size 4 on every step is
   * tested for eliminations. If the first RC has two candidates both are tried independently.
   */
  getAlsXYChainRecursive(alsIndex, lastRC) {
    if (this.chainIndex >= this.chain.length) return;
    let firstTry = true;
    for (let i = this.startIndices[alsIndex]; i < this.endIndices[alsIndex]; i++) {
      const rc = this.restrictedCommons[i];
      if (this.chainIndex >= this.chain.length || !rc.checkRC(lastRC, firstTry)) continue;
      if (this.alsInChain[rc.als2]) continue;
      const aktAls = this.alses[rc.als2];
      if (this.chainIndex === 0) this.firstRC = rc;
      this.chain[this.chainIndex++] = rc;
      this.alsInChain[rc.als2] = true;
      if (this.chainIndex >= 3) {
        const firstRC = this.firstRC;
        const step = new SolutionStep("ALS_XY_CHAIN");
        this.globalStep = step;
        let c1 = firstRC.cand1;
        let c2 = firstRC.cand2;
        let c3 = 0;
        let c4 = 0;
        if (firstRC.actualRC === 1) c2 = 0;
        else if (firstRC.actualRC === 2) c1 = 0;
        if (rc.actualRC === 1) {
          c3 = rc.cand1;
        } else if (rc.actualRC === 2) {
          c3 = rc.cand2;
        } else if (rc.actualRC === 3) {
          c3 = rc.cand1;
          c4 = rc.cand2;
        }
        this.checkCandidatesToDelete(this.startAls, aktAls, c1, c2, c3, c4, null);
        if (step.candidatesToDelete.length > 0) {
          step.addAls(this.startAls.indices, this.startAls.candidates);
          let tmpAls = this.startAls;
          for (let j = 0; j < this.chainIndex; j++) {
            const cj = this.chain[j];
            const tmp = this.alses[cj.als2];
            step.addAls(tmp.indices, tmp.candidates);
            step.restrictedCommons.push(cj.clone());
            if (cj.actualRC === 1 || cj.actualRC === 3) this.addRestrictedCommonToStep(tmpAls, tmp, cj.cand1, true);
            if (cj.actualRC === 2 || cj.actualRC === 3) this.addRestrictedCommonToStep(tmpAls, tmp, cj.cand2, true);
            tmpAls = tmp;
          }
          let writeIt = true;
          let replaceIndex = -1;
          let elim = null;
          if (this.finder.options.onlyOneAlsPerStep) {
            elim = step.getCandidateKey();
            const alreadyThere = this.deletesMap.get(elim);
            if (alreadyThere !== void 0) {
              if (this.steps[alreadyThere].getAlsesIndexCount() > step.getAlsesIndexCount()) {
                replaceIndex = alreadyThere;
              } else {
                writeIt = false;
              }
            }
          }
          if (writeIt) {
            if (replaceIndex !== -1) {
              this.steps[replaceIndex] = step;
            } else {
              this.steps.push(step);
              if (elim !== null) this.deletesMap.set(elim, this.steps.length - 1);
            }
          }
        }
      }
      this.getAlsXYChainRecursive(rc.als2, rc);
      this.alsInChain[rc.als2] = false;
      this.chainIndex--;
      if (lastRC === null) {
        if (rc.cand2 !== 0 && firstTry) {
          firstTry = false;
          i--;
        } else {
          firstTry = true;
        }
      }
    }
  }
  /**
   * Death Blossom: a stem cell with at least one ALS for every candidate. Every combination of
   * (non overlapping) ALS is checked for common candidates that eliminate candidates outside the
   * ALS and the stem cell. The ALS/cell combinations must already be in `rcdb`.
   */
  getAlsDeathBlossomInt() {
    this.deletesMap.clear();
    this.globalStep = new SolutionStep("DEATH_BLOSSOM");
    for (let i = 0; i < LENGTH; i++) {
      if (this.sudoku.getValue(i) !== 0) continue;
      const entry = this.rcdb[i];
      if (entry === null || this.sudoku.getCell(i) !== entry.candMask) continue;
      this.stemCellIndex = i;
      this.aktRcdb = entry;
      this.maxDBCand = 0;
      for (let j = 1; j <= 9; j++) {
        if (entry.indices[j] > 0) this.maxDBCand = j;
      }
      this.aktDBIndices.clear();
      this.aktDBCandidates = MAX_MASK;
      this.aktDBAls.fill(-1);
      const step = this.checkAlsDeathBlossomRecursive(1);
      if (step !== null) return step;
    }
    return null;
  }
  /** Try all ALS for `cand` in the stem cell; at the last candidate check the eliminations. */
  checkAlsDeathBlossomRecursive(cand) {
    if (cand > this.maxDBCand) return null;
    const aktRcdb = this.aktRcdb;
    if (aktRcdb.indices[cand] > 0) {
      for (let i = 0; i < aktRcdb.indices[cand]; i++) {
        const als = this.alses[aktRcdb.alsPerCandidate[cand][i]];
        if (!this.finder.options.allowAlsOverlap && als.indices.intersects(this.aktDBIndices)) continue;
        if ((this.aktDBCandidates & als.candidates) === 0) continue;
        this.aktDBAls[cand] = aktRcdb.alsPerCandidate[cand][i];
        this.incDBCand[cand] = this.aktDBCandidates & ~als.candidates;
        this.aktDBCandidates &= als.candidates;
        this.aktDBIndices.or(als.indices);
        if (cand < this.maxDBCand) {
          const step = this.checkAlsDeathBlossomRecursive(cand + 1);
          if (step !== null) return step;
        } else {
          let found = false;
          const step = this.globalStep;
          for (const checkCand of POSSIBLE_VALUES[this.aktDBCandidates]) {
            if (this.aktDBAls[checkCand] !== -1) continue;
            let first = true;
            for (let k = 0; k < this.aktDBAls.length; k++) {
              if (this.aktDBAls[k] === -1) continue;
              if (first) {
                this.dbIndicesPerCandidate.set(this.alses[this.aktDBAls[k]].indicesPerCandidat[checkCand]);
                first = false;
              } else {
                this.dbIndicesPerCandidate.or(this.alses[this.aktDBAls[k]].indicesPerCandidat[checkCand]);
              }
            }
            getBuddiesOfSet(this.dbIndicesPerCandidate, this.tmpSet);
            this.tmpSet.andNot(this.aktDBIndices);
            this.tmpSet.remove(this.stemCellIndex);
            this.tmpSet.and(this.finder.getCandidates()[checkCand]);
            if (!this.tmpSet.isEmpty()) {
              found = true;
              for (const k of this.tmpSet) step.addCandidateToDelete(k, checkCand);
            }
          }
          if (found) {
            step.addIndex(this.stemCellIndex);
            for (let k = 1; k <= 9; k++) {
              if (this.aktDBAls[k] === -1) continue;
              const tmpAls = this.alses[this.aktDBAls[k]];
              for (const l of tmpAls.indicesPerCandidat[k]) step.addFin(l, k);
              step.addFin(this.stemCellIndex, k);
              step.addAls(tmpAls.indices, tmpAls.candidates);
              step.restrictedCommons.push(new RestrictedCommon(0, 0, k, 0, 1));
            }
            step.getCandidateKey();
            return step;
          }
        }
        this.aktDBCandidates |= this.incDBCand[cand];
        this.aktDBIndices.andNot(als.indices);
      }
    } else {
      this.aktDBAls[cand] = -1;
      const step = this.checkAlsDeathBlossomRecursive(cand + 1);
      if (step !== null) return step;
    }
    return null;
  }
  checkCandidatesToDelete(als1, als2, restr1, restr2 = -1, restr3 = -1, restr4 = -1, forbiddenIndices = null) {
    const step = this.globalStep;
    let possibleRestrictedCommonsSet = als1.candidates & als2.candidates;
    if (restr1 !== -1 && restr1 !== 0) possibleRestrictedCommonsSet &= ~MASKS[restr1];
    if (restr2 !== -1 && restr2 !== 0) possibleRestrictedCommonsSet &= ~MASKS[restr2];
    if (restr3 !== -1 && restr3 !== 0) possibleRestrictedCommonsSet &= ~MASKS[restr3];
    if (restr4 !== -1 && restr4 !== 0) possibleRestrictedCommonsSet &= ~MASKS[restr4];
    if (possibleRestrictedCommonsSet === 0) return;
    this.tmpSet.set(als1.buddies);
    if (this.tmpSet.andEmpty(als2.buddies)) return;
    for (const cand of POSSIBLE_VALUES[possibleRestrictedCommonsSet]) {
      const buddiesSet = this.restrictedCommonBuddiesSet;
      buddiesSet.set(als1.buddiesPerCandidat[cand]);
      buddiesSet.and(als2.buddiesPerCandidat[cand]);
      if (forbiddenIndices !== null) buddiesSet.andNot(forbiddenIndices);
      if (!buddiesSet.isEmpty()) {
        for (const l of buddiesSet) step.addCandidateToDelete(l, cand);
        this.tmpSet1.set(als1.indicesPerCandidat[cand]);
        this.tmpSet1.or(als2.indicesPerCandidat[cand]);
        for (const l of this.tmpSet1) step.addFin(l, cand);
      }
    }
  }
  /**
   * Add all cells that contain `cand` in both ALS as endo fins to the step (display only). With
   * `withChain` a chain is added between the pair of cells in both ALS with the smallest distance.
   */
  addRestrictedCommonToStep(als1, als2, cand, withChain) {
    const step = this.globalStep;
    this.tmpSet.set(als1.indicesPerCandidat[cand]);
    this.tmpSet.or(als2.indicesPerCandidat[cand]);
    for (const i of this.tmpSet) step.addEndoFin(i, cand);
    if (withChain) {
      let minDist = Number.MAX_SAFE_INTEGER;
      let minIndex1 = -1;
      let minIndex2 = -1;
      for (const index1 of als1.indicesPerCandidat[cand]) {
        for (const index2 of als2.indicesPerCandidat[cand]) {
          const dx = getLine(index1) - getLine(index2);
          const dy = getCol(index1) - getCol(index2);
          const dist = dx * dx + dy * dy;
          if (dist < minDist) {
            minDist = dist;
            minIndex1 = index1;
            minIndex2 = index2;
          }
        }
      }
      step.addChain(0, 1, [Chain.makeSEntry(minIndex1, cand, false), Chain.makeSEntry(minIndex2, cand, false)]);
    }
  }
  /**
   * als1 and als2 are doubly linked by RCs rc1 and rc2; check whether the locked set
   * {als1 - rc1 - rc2} can eliminate candidates that are not in als2. Has to be called twice
   * with als1 and als2 swapped.
   */
  checkDoublyLinkedAls(als1, als2, rc1, rc2) {
    let isDoubly = false;
    const possible = als1.candidates & ~MASKS[rc1] & ~MASKS[rc2];
    if (possible === 0) return false;
    for (const cand of POSSIBLE_VALUES[possible]) {
      this.restrictedCommonIndexSet.set(als1.buddiesPerCandidat[cand]);
      this.restrictedCommonIndexSet.andNot(als2.indices);
      if (!this.restrictedCommonIndexSet.isEmpty()) {
        for (const j of this.restrictedCommonIndexSet) {
          this.globalStep.addCandidateToDelete(j, cand);
          isDoubly = true;
        }
      }
    }
    return isDoubly;
  }
  collectAllRestrictedCommons(withOverlap) {
    this.restrictedCommons = this.finder.getRestrictedCommons(this.alses, withOverlap);
    this.startIndices = this.finder.getStartIndices();
    this.endIndices = this.finder.getEndIndices();
  }
  collectAllAlses() {
    this.alses = this.finder.getAlses();
  }
  /**
   * For every cell that is not yet set an RCForDeathBlossom is created: it collects the ALS that
   * see the cell for every candidate. In getAlsDeathBlossomInt its candidate mask is compared with
   * the real candidate mask of the cell: if equal, a Death Blossom is possible.
   */
  collectAllRCsForDeathBlossom() {
    this.rcdb.fill(null);
    for (let i = 0; i < this.alses.length; i++) {
      const act = this.alses[i];
      for (let j = 1; j <= 9; j++) {
        if ((act.candidates & MASKS[j]) === 0) continue;
        for (const index of act.buddiesPerCandidat[j]) {
          let entry = this.rcdb[index];
          if (entry === null) {
            entry = new RCForDeathBlossom();
            this.rcdb[index] = entry;
          }
          entry.addAlsForCandidate(i, j);
        }
      }
    }
  }
};

// ../core/src/solver/chainSolver.ts
var MAX_CHAIN_LENGTH = 2 * LENGTH;
var StackEntry = class {
  /** The cell index of the current link */
  cellIndex = 0;
  /** The candidate of the current link */
  candidate = 0;
  /** If true, the next link must be strong */
  strongOnly = false;
  /** The current index into `links` */
  aktIndex = 0;
  /** The index of the last link for that cell + 1 */
  endIndex = 0;
};
var ChainSolver = class extends AbstractSolver {
  stack = Array.from({ length: MAX_CHAIN_LENGTH }, () => new StackEntry());
  stackLevel = 0;
  /** The maximum length of the chain in number of links */
  chainMaxLength = 0;
  /** All instances of the start candidate that see the start cell */
  startCellSet = new SudokuSet();
  /** The same for the second candidate of a Remote Pair */
  startCellSet2 = new SudokuSet();
  /**
   * All links of all cells and candidates. The links for one cell/candidate combination
   * (index cellIndex * 10 + candidate) start at links[startIndices[..]] and end before links[endIndices[..]].
   */
  links = [];
  startIndices = new Array(810).fill(0);
  endIndices = new Array(810).fill(0);
  /** The chain that is being built (copied when a chain is found) */
  chain = new Array(MAX_CHAIN_LENGTH).fill(0);
  /** All cells of `chain` (for loop/lasso check); the last cell can be missing */
  chainSet = new SudokuSet();
  startIndex = 0;
  startCandidate = 0;
  /** The second start candidate for Remote Pairs */
  startCandidate2 = 0;
  /** The candidates of the start cell of a Remote Pair */
  rpCell = 0;
  checkBuddies = new SudokuSet();
  rpCand1 = new SudokuSet();
  rpCand2 = new SudokuSet();
  rpTmp = new SudokuSet();
  mSet = new SudokuSet();
  /** chains that were already found: eliminations -> chain length */
  deletesMap = /* @__PURE__ */ new Map();
  steps = [];
  /** The last finder step number for which links were calculated */
  lastStepNumber = -1;
  /** true if the last links were calculated for Turbot Fish / X-Chain (they share the same links) */
  turbotOrXSeen = false;
  constructor(finder) {
    super(finder);
  }
  getStep(type) {
    this.sudoku = this.finder.getSudoku();
    switch (type) {
      case "X_CHAIN":
        return this.getBest(0 /* X_CHAIN */);
      case "XY_CHAIN":
        return this.getBest(1 /* XY_CHAIN */);
      case "REMOTE_PAIR":
        return this.getBest(2 /* REMOTE_PAIR */);
      case "TURBOT_FISH":
        return this.getBest(4 /* TURBOT_FISH */);
      default:
        return null;
    }
  }
  doStep(step) {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case "X_CHAIN":
      case "XY_CHAIN":
      case "REMOTE_PAIR":
      case "NICE_LOOP":
      case "TURBOT_FISH":
        for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        return true;
      default:
        return false;
    }
  }
  /** All chains of the type are found and sorted; the best one is returned. */
  getBest(type) {
    this.steps = [];
    this.getChains(type);
    if (this.steps.length > 0) {
      this.steps.sort((a, b) => a.compareTo(b));
      return this.steps[0];
    }
    return null;
  }
  /**
   * Iterates over all candidates in the sudoku and does a complete search for simple chains
   * up to a given maximum length. Collects all links for the type of chain first.
   */
  getChains(type) {
    const sudoku = this.sudoku;
    this.getAllLinks(type);
    this.chainMaxLength = MAX_CHAIN_LENGTH - 1;
    if (this.finder.options.restrictChainSize) this.chainMaxLength = this.finder.options.restrictChainLength;
    if (type === 4 /* TURBOT_FISH */) this.chainMaxLength = 3;
    this.deletesMap.clear();
    const candidates = this.finder.getCandidates();
    for (this.startIndex = 0; this.startIndex < LENGTH; this.startIndex++) {
      if (sudoku.getValue(this.startIndex) !== 0) continue;
      const startCandidates = sudoku.getAllCandidates(this.startIndex);
      for (const startCandidate of startCandidates) {
        this.startCandidate = startCandidate;
        const linkStartIndex = this.startIndex * 10 + startCandidate;
        for (let linkIndex = this.startIndices[linkStartIndex]; linkIndex < this.endIndices[linkStartIndex]; linkIndex++) {
          const link = this.links[linkIndex];
          if (!Chain.isSStrong(link)) continue;
          if ((type === 0 /* X_CHAIN */ || type === 4 /* TURBOT_FISH */) && Chain.getSCandidate(link) !== startCandidate) {
            continue;
          }
          if ((type === 1 /* XY_CHAIN */ || type === 2 /* REMOTE_PAIR */) && sudoku.getAnzCandidates(Chain.getSCellIndex(link)) !== 2) {
            continue;
          }
          if ((type === 1 /* XY_CHAIN */ || type === 2 /* REMOTE_PAIR */) && Chain.getSCellIndex(link) !== this.startIndex) {
            continue;
          }
          if (type === 2 /* REMOTE_PAIR */) {
            this.rpCell = sudoku.getCell(this.startIndex);
            const cands = sudoku.getAllCandidates(this.startIndex);
            this.startCandidate2 = cands[0] !== startCandidate ? cands[0] : cands[1];
          }
          this.stackLevel = 1;
          this.chain[0] = Chain.makeSEntry(this.startIndex, startCandidate, false);
          this.chain[1] = link;
          const entry = this.stack[this.stackLevel];
          entry.cellIndex = Chain.getSCellIndex(this.chain[1]);
          entry.candidate = Chain.getSCandidate(this.chain[1]);
          entry.strongOnly = !Chain.isSStrong(this.chain[1]);
          entry.aktIndex = this.startIndices[entry.cellIndex * 10 + entry.candidate];
          entry.endIndex = this.endIndices[entry.cellIndex * 10 + entry.candidate];
          this.chainSet.clear();
          this.chainSet.add(this.startIndex);
          this.startCellSet.setAnd(BUDDIES[this.startIndex], candidates[startCandidate]);
          if (type === 2 /* REMOTE_PAIR */) {
            this.startCellSet2.setAnd(BUDDIES[this.startIndex], candidates[this.startCandidate2]);
          }
          this.getChain(entry, type);
        }
      }
    }
  }
  /**
   * The search: for every link of the current cell/candidate check whether it can prolong
   * the chain; if so, insert it and repeat. A link is not used if it links back to itself, or
   * to the middle of the chain. A chain is valid if first and last link are strong and
   * something can be eliminated; to check that quickly, all instances of the start candidate
   * that see the start cell are precalculated and ANDed with the buddies of the new last cell.
   */
  getChain(startEntry, type) {
    const sudoku = this.sudoku;
    const links = this.links;
    let entry = startEntry;
    while (true) {
      while (entry.aktIndex >= entry.endIndex) {
        this.stackLevel--;
        entry = this.stack[this.stackLevel];
        this.chainSet.remove(entry.cellIndex);
        if (this.stackLevel <= 0) return;
      }
      let newLink = links[entry.aktIndex++];
      let newLinkIsStrong = Chain.isSStrong(newLink);
      if (entry.strongOnly && !newLinkIsStrong) continue;
      const newLinkIndex = Chain.getSCellIndex(newLink);
      const newLinkCandidate = Chain.getSCandidate(newLink);
      if (entry.cellIndex === newLinkIndex && entry.candidate === newLinkCandidate) continue;
      if (type === 2 /* REMOTE_PAIR */ && sudoku.getCell(newLinkIndex) !== this.rpCell) {
        continue;
      }
      if ((type === 0 /* X_CHAIN */ || type === 4 /* TURBOT_FISH */) && newLinkCandidate !== this.startCandidate) {
        continue;
      }
      if ((type === 1 /* XY_CHAIN */ || type === 2 /* REMOTE_PAIR */) && sudoku.getAnzCandidates(newLinkIndex) !== 2) {
        continue;
      }
      if ((type === 1 /* XY_CHAIN */ || type === 2 /* REMOTE_PAIR */) && entry.strongOnly && newLinkIndex !== entry.cellIndex) {
        continue;
      }
      let isLoop = false;
      if (this.chainSet.contains(newLinkIndex)) {
        if (this.startIndex !== newLinkIndex) continue;
        isLoop = true;
      }
      this.chainSet.add(entry.cellIndex);
      if (!entry.strongOnly && newLinkIsStrong) {
        newLink = Chain.setSStrong(newLink, false);
        newLinkIsStrong = false;
      }
      this.chain[++this.stackLevel] = newLink;
      if (this.stackLevel > 1 && newLinkIsStrong && newLinkCandidate === this.startCandidate) {
        this.mSet.setAnd(this.startCellSet, BUDDIES[newLinkIndex]);
        if (!this.mSet.isEmpty()) {
          switch (type) {
            case 0 /* X_CHAIN */:
              this.checkXChain(this.mSet, false);
              break;
            case 4 /* TURBOT_FISH */:
              if (this.stackLevel === 3) this.checkXChain(this.mSet, true);
              break;
            case 1 /* XY_CHAIN */:
              this.checkXYChain(this.mSet);
              break;
            case 2 /* REMOTE_PAIR */:
              if (this.stackLevel >= 7) this.checkRemotePairs(this.mSet, newLinkIndex);
              break;
          }
        }
      }
      const oldStrongOnly = entry.strongOnly;
      entry = this.stack[this.stackLevel];
      if (this.stackLevel < this.chainMaxLength && !isLoop) {
        entry.cellIndex = newLinkIndex;
        entry.candidate = newLinkCandidate;
        entry.strongOnly = !oldStrongOnly;
        entry.aktIndex = this.startIndices[entry.cellIndex * 10 + entry.candidate];
        entry.endIndex = this.endIndices[entry.cellIndex * 10 + entry.candidate];
      } else {
        entry.aktIndex = entry.endIndex;
      }
    }
  }
  /**
   * An X-Chain exists between strong links of the same candidate; any candidate that sees
   * both ends can be eliminated. Called after all the checks (at least three links, first and
   * last link strong for the same candidate, no loop, something to eliminate).
   */
  checkXChain(elim, isTurbot) {
    const step = new SolutionStep(isTurbot ? "TURBOT_FISH" : "X_CHAIN");
    step.addValue(this.startCandidate);
    for (const c of elim) step.addCandidateToDelete(c, this.startCandidate);
    if (!isTurbot && !this.registerChain(step)) return;
    if (isTurbot) step.normalizeCandidatesToDelete();
    this.addChainStep(step);
  }
  checkXYChain(elim) {
    const step = new SolutionStep("XY_CHAIN");
    step.addValue(this.startCandidate);
    for (const c of elim) step.addCandidateToDelete(c, this.startCandidate);
    if (!this.registerChain(step)) return;
    this.addChainStep(step);
  }
  /**
   * A Remote Pair has at least 4 cells (chain length >= 7); first and last link are strong and
   * for the same candidate. If the chain is longer than 4 cells, eliminations can occur between all
   * cells with opposite polarity. Longer chains are found with more eliminations than two
   * separate shorter ones.
   */
  checkRemotePairs(elim, endIndex) {
    const step = new SolutionStep("REMOTE_PAIR");
    const candidates = this.finder.getCandidates();
    this.rpCand1.clear();
    this.rpCand2.clear();
    if (this.stackLevel > 7) {
      for (let i = 0; i <= this.stackLevel; i += 2) {
        for (let j = i + 6; j <= this.stackLevel; j += 4) {
          this.rpTmp.set(BUDDIES[Chain.getSCellIndex(this.chain[i])]);
          this.rpTmp.and(BUDDIES[Chain.getSCellIndex(this.chain[j])]);
          this.checkBuddies.set(this.rpTmp);
          this.checkBuddies.and(candidates[this.startCandidate]);
          this.rpCand1.or(this.checkBuddies);
          this.checkBuddies.set(this.rpTmp);
          this.checkBuddies.and(candidates[this.startCandidate2]);
          this.rpCand2.or(this.checkBuddies);
        }
      }
    } else {
      this.rpCand1.set(elim);
      this.rpCand2.setAnd(this.startCellSet2, BUDDIES[endIndex]);
    }
    step.addValue(this.startCandidate);
    step.addValue(this.startCandidate2);
    for (const c of this.rpCand1) step.addCandidateToDelete(c, this.startCandidate);
    for (const c of this.rpCand2) step.addCandidateToDelete(c, this.startCandidate2);
    if (!this.registerChain(step)) return;
    this.addChainStep(step);
  }
  /**
   * Remember the eliminations of a chain. Returns false if a chain with the same eliminations
   * exists already and is not longer than the new one. (Sorts the candidates to delete.)
   */
  registerChain(step) {
    const key = step.getCandidateKey();
    const oldLength = this.deletesMap.get(key);
    if (oldLength !== void 0 && oldLength <= this.stackLevel) return false;
    this.deletesMap.set(key, this.stackLevel);
    return true;
  }
  /** Copy the current chain into the step and add the step to the result list. */
  addChainStep(step) {
    step.addChain(0, this.stackLevel, this.chain.slice(0, this.stackLevel + 1));
    this.steps.push(step);
  }
  /**
   * Calculates all links for the type of chain:
   *  - REMOTE_PAIR: only links between bivalue cells with the same candidates, and within the cells
   *  - TURBOT_FISH and X_CHAIN: only between candidates with the same value
   *  - XY_CHAIN: only bivalue cells
   * Turbot Fish and X-Chain share exactly the same links; if one is searched right after the
   * other without a change to the sudoku the links are not recalculated.
   */
  getAllLinks(type) {
    if (this.turbotOrXSeen && (type === 4 /* TURBOT_FISH */ || type === 0 /* X_CHAIN */) && this.lastStepNumber === this.finder.getStepNumber()) {
      return;
    }
    this.turbotOrXSeen = type === 4 /* TURBOT_FISH */ || type === 0 /* X_CHAIN */;
    this.lastStepNumber = this.finder.getStepNumber();
    const sudoku = this.sudoku;
    const free = sudoku.free;
    const links = [];
    for (let cellIndex = 0; cellIndex < LENGTH; cellIndex++) {
      const cell = sudoku.getCell(cellIndex);
      if (cell === 0 || (type === 2 /* REMOTE_PAIR */ || type === 1 /* XY_CHAIN */) && ANZ_VALUES[cell] !== 2) {
        continue;
      }
      for (let cellCandidate = 1; cellCandidate <= 9; cellCandidate++) {
        const startEndIndex = cellIndex * 10 + cellCandidate;
        if (!sudoku.isCandidate(cellIndex, cellCandidate)) {
          this.startIndices[startEndIndex] = links.length;
          this.endIndices[startEndIndex] = links.length;
          continue;
        }
        this.startIndices[startEndIndex] = links.length;
        const cands = POSSIBLE_VALUES[cell];
        if (ANZ_VALUES[cell] === 2 && type !== 0 /* X_CHAIN */ && type !== 4 /* TURBOT_FISH */) {
          let cand = cands[0];
          if (cand === cellCandidate) cand = cands[1];
          links.push(Chain.makeSEntry(cellIndex, cand, true));
        }
        for (let constr = 0; constr < CONSTRAINTS[cellIndex].length; constr++) {
          const strong = free[CONSTRAINTS[cellIndex][constr]][cellCandidate] === 2 && (type === 0 /* X_CHAIN */ || type === 4 /* TURBOT_FISH */);
          for (const other of ALL_UNITS[CONSTRAINTS[cellIndex][constr]]) {
            if (other !== cellIndex && sudoku.isCandidate(other, cellCandidate)) {
              const cell2 = sudoku.getCell(other);
              if (type === 2 /* REMOTE_PAIR */ && cell2 !== cell) continue;
              if (type === 1 /* XY_CHAIN */ && ANZ_VALUES[cell2] !== 2) continue;
              if (constr === 2 && (getLine(cellIndex) === getLine(other) || getCol(cellIndex) === getCol(other))) {
                continue;
              }
              links.push(Chain.makeSEntry(other, cellCandidate, strong));
            }
          }
        }
        this.endIndices[startEndIndex] = links.length;
      }
    }
    this.links = links;
  }
};

// ../core/src/solver/coloringSolver.ts
var C1 = 0;
var C2 = 1;
var ColoringSolver = class extends AbstractSolver {
  /** sets[cand][pair] = [color 1 cells, color 2 cells]: the colored cells of every color pair per candidate */
  sets = Array.from({ length: 10 }, () => []);
  /** Number of color pairs for each candidate. */
  anzColorPairs = new Array(10).fill(0);
  /** Step number of the sudoku for which coloring was calculated; -1 means "data invalid". */
  stepNumbers = new Array(10).fill(-1);
  /** all candidate cells that are part of at least one conjugate pair and not colored yet */
  startSet = new SudokuSet();
  tmpSet1 = new SudokuSet();
  /** cells where a candidate can be eliminated */
  deleteSet = new SudokuSet();
  constructor(finder) {
    super(finder);
  }
  getStep(type) {
    this.sudoku = this.finder.getSudoku();
    switch (type) {
      case "SIMPLE_COLORS":
      case "SIMPLE_COLORS_TRAP":
      case "SIMPLE_COLORS_WRAP":
        return this.findSimpleColorSteps();
      case "MULTI_COLORS":
      case "MULTI_COLORS_1":
      case "MULTI_COLORS_2":
        return this.findMultiColorSteps();
      default:
        return null;
    }
  }
  doStep(step) {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case "SIMPLE_COLORS":
      case "SIMPLE_COLORS_TRAP":
      case "SIMPLE_COLORS_WRAP":
      case "MULTI_COLORS":
      case "MULTI_COLORS_1":
      case "MULTI_COLORS_2":
        for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        return true;
      default:
        return false;
    }
  }
  findSimpleColorSteps() {
    for (let i = 1; i <= 9; i++) {
      const step = this.findSimpleColorStepsForCandidate(i);
      if (step !== null) return step;
    }
    return null;
  }
  findSimpleColorStepsForCandidate(cand) {
    const anzColors = this.doColoring(cand);
    for (let i = 0; i < anzColors; i++) {
      const set1 = this.sets[cand][i][C1];
      const set2 = this.sets[cand][i][C2];
      let step = new SolutionStep("SIMPLE_COLORS_WRAP");
      if (this.checkColorWrap(set1)) for (const c of set1) step.addCandidateToDelete(c, cand);
      if (this.checkColorWrap(set2)) for (const c of set2) step.addCandidateToDelete(c, cand);
      if (step.candidatesToDelete.length > 0) {
        step.addValue(cand);
        step.addColorCandidates(set1, 0);
        step.addColorCandidates(set2, 1);
        return step;
      }
      step = new SolutionStep("SIMPLE_COLORS_TRAP");
      this.checkCandidateToDelete(step, set1, set2, cand);
      if (step.candidatesToDelete.length > 0) {
        step.addValue(cand);
        step.addColorCandidates(set1, 0);
        step.addColorCandidates(set2, 1);
        return step;
      }
    }
    return null;
  }
  /** true if two cells in `set` see each other (then all candidates of that color can be removed). */
  checkColorWrap(set) {
    for (let i = 0; i < set.size() - 1; i++) {
      for (let j = i + 1; j < set.size(); j++) {
        if (BUDDIES[set.get(i)].contains(set.get(j))) return true;
      }
    }
    return false;
  }
  /**
   * All candidates that see a cell in set1 and a cell in set2 can be eliminated.
   * The eliminations are collected in a set first so that none is recorded twice.
   */
  checkCandidateToDelete(step, set1, set2, cand) {
    const { deleteSet, tmpSet1 } = this;
    deleteSet.clear();
    for (const a of set1) {
      for (const b of set2) {
        tmpSet1.set(BUDDIES[a]);
        tmpSet1.and(BUDDIES[b]);
        tmpSet1.and(this.finder.getCandidates()[cand]);
        deleteSet.or(tmpSet1);
      }
    }
    for (const c of deleteSet) step.addCandidateToDelete(c, cand);
  }
  findMultiColorSteps() {
    for (let i = 1; i <= 9; i++) {
      const step = this.findMultiColorStepsForCandidate(i);
      if (step !== null) return step;
    }
    return null;
  }
  findMultiColorStepsForCandidate(cand) {
    const anzColors = this.doColoring(cand);
    for (let i = 0; i < anzColors; i++) {
      for (let j = 0; j < anzColors; j++) {
        if (i === j) continue;
        const set11 = this.sets[cand][i][C1];
        const set12 = this.sets[cand][i][C2];
        const set21 = this.sets[cand][j][C1];
        const set22 = this.sets[cand][j][C2];
        let step = new SolutionStep("MULTI_COLORS_2");
        if (this.checkMultiColor1(set11, set21, set22)) for (const c of set11) step.addCandidateToDelete(c, cand);
        if (this.checkMultiColor1(set12, set21, set22)) for (const c of set12) step.addCandidateToDelete(c, cand);
        if (step.candidatesToDelete.length > 0) {
          this.finishMultiStep(step, cand, set11, set12, set21, set22);
          return step;
        }
        step = new SolutionStep("MULTI_COLORS_1");
        if (this.checkMultiColor2(set11, set21)) this.checkCandidateToDelete(step, set12, set22, cand);
        if (this.checkMultiColor2(set11, set22)) this.checkCandidateToDelete(step, set12, set21, cand);
        if (this.checkMultiColor2(set12, set21)) this.checkCandidateToDelete(step, set11, set22, cand);
        if (this.checkMultiColor2(set12, set22)) this.checkCandidateToDelete(step, set11, set21, cand);
        if (step.candidatesToDelete.length > 0) {
          this.finishMultiStep(step, cand, set11, set12, set21, set22);
          return step;
        }
      }
    }
    return null;
  }
  finishMultiStep(step, cand, set11, set12, set21, set22) {
    step.addValue(cand);
    step.addColorCandidates(set11, 0);
    step.addColorCandidates(set12, 1);
    step.addColorCandidates(set21, 2);
    step.addColorCandidates(set22, 3);
  }
  /** Do cells in `set` see cells of both s21 and s22? Then all candidates in `set` can be eliminated. */
  checkMultiColor1(set, s21, s22) {
    let seeS21 = false;
    let seeS22 = false;
    for (const cell of set) {
      this.tmpSet1.set(BUDDIES[cell]);
      if (!this.tmpSet1.andEmpty(s21)) seeS21 = true;
      if (!this.tmpSet1.andEmpty(s22)) seeS22 = true;
      if (seeS21 && seeS22) return true;
    }
    return false;
  }
  /** Does some cell in set1 see a cell in set2? */
  checkMultiColor2(set1, set2) {
    for (const a of set1) {
      for (const b of set2) {
        if (BUDDIES[a].contains(b)) return true;
      }
    }
    return false;
  }
  /**
   * Colors the grid: every candidate that is part of at least one conjugate
   * pair gets a color (it is added to one of the color sets of a pair).
   * Results are cached per candidate until the sudoku changes.
   */
  doColoring(cand) {
    if (this.stepNumbers[cand] === this.finder.getStepNumber()) return this.anzColorPairs[cand];
    this.anzColorPairs[cand] = 0;
    this.stepNumbers[cand] = this.finder.getStepNumber();
    const startSet = this.startSet;
    startSet.set(this.finder.getCandidates()[cand]);
    const values = startSet.values();
    const free = this.sudoku.free;
    for (const index of values) {
      const c = CONSTRAINTS[index];
      if (free[c[0]][cand] !== 2 && free[c[1]][cand] !== 2 && free[c[2]][cand] !== 2) {
        startSet.remove(index);
      }
    }
    while (!startSet.isEmpty()) {
      const pairs = this.sets[cand];
      if (pairs[this.anzColorPairs[cand]] === void 0) pairs[this.anzColorPairs[cand]] = [new SudokuSet(), new SudokuSet()];
      const actSets = pairs[this.anzColorPairs[cand]];
      actSets[C1].clear();
      actSets[C2].clear();
      this.doColoringForColorRecursive(startSet.get(0), cand, true);
      if (actSets[C1].isEmpty() || actSets[C2].isEmpty()) {
        actSets[C1].clear();
        actSets[C2].clear();
      } else {
        this.anzColorPairs[cand]++;
      }
    }
    return this.anzColorPairs[cand];
  }
  /** Color the cell with the current color pair and follow all conjugate pairs. */
  doColoringForColorRecursive(index, cand, on) {
    if (index === -1 || !this.startSet.contains(index)) return;
    this.sets[cand][this.anzColorPairs[cand]][on ? C1 : C2].add(index);
    this.startSet.remove(index);
    const c = CONSTRAINTS[index];
    this.doColoringForColorRecursive(this.getConjugateIndex(index, cand, c[0]), cand, !on);
    this.doColoringForColorRecursive(this.getConjugateIndex(index, cand, c[1]), cand, !on);
    this.doColoringForColorRecursive(this.getConjugateIndex(index, cand, c[2]), cand, !on);
  }
  /** The other cell of the conjugate pair of `cand` in `constraint` that contains `index`, or -1. */
  getConjugateIndex(index, cand, constraint) {
    if (this.sudoku.free[constraint][cand] !== 2) return -1;
    this.tmpSet1.set(this.finder.getCandidates()[cand]);
    this.tmpSet1.and(ALL_CONSTRAINTS_TEMPLATES[constraint]);
    let result = this.tmpSet1.get(0);
    if (result === index) result = this.tmpSet1.get(1);
    return result;
  }
};

// ../core/src/solver/fishSolver.ts
var BASIC_TYPES = ["X_WING", "SWORDFISH", "JELLYFISH", "SQUIRMBAG", "WHALE", "LEVIATHAN"];
var FINNED_BASIC_TYPES = [
  "FINNED_X_WING",
  "FINNED_SWORDFISH",
  "FINNED_JELLYFISH",
  "FINNED_SQUIRMBAG",
  "FINNED_WHALE",
  "FINNED_LEVIATHAN"
];
var SASHIMI_BASIC_TYPES = [
  "SASHIMI_X_WING",
  "SASHIMI_SWORDFISH",
  "SASHIMI_JELLYFISH",
  "SASHIMI_SQUIRMBAG",
  "SASHIMI_WHALE",
  "SASHIMI_LEVIATHAN"
];
var FRANKEN_TYPES = [
  "FRANKEN_X_WING",
  "FRANKEN_SWORDFISH",
  "FRANKEN_JELLYFISH",
  "FRANKEN_SQUIRMBAG",
  "FRANKEN_WHALE",
  "FRANKEN_LEVIATHAN"
];
var FINNED_FRANKEN_TYPES = [
  "FINNED_FRANKEN_X_WING",
  "FINNED_FRANKEN_SWORDFISH",
  "FINNED_FRANKEN_JELLYFISH",
  "FINNED_FRANKEN_SQUIRMBAG",
  "FINNED_FRANKEN_WHALE",
  "FINNED_FRANKEN_LEVIATHAN"
];
var MUTANT_TYPES = [
  "MUTANT_X_WING",
  "MUTANT_SWORDFISH",
  "MUTANT_JELLYFISH",
  "MUTANT_SQUIRMBAG",
  "MUTANT_WHALE",
  "MUTANT_LEVIATHAN"
];
var FINNED_MUTANT_TYPES = [
  "FINNED_MUTANT_X_WING",
  "FINNED_MUTANT_SWORDFISH",
  "FINNED_MUTANT_JELLYFISH",
  "FINNED_MUTANT_SQUIRMBAG",
  "FINNED_MUTANT_WHALE",
  "FINNED_MUTANT_LEVIATHAN"
];
var UNDEFINED = -1;
var BASIC = 0;
var FRANKEN = 1;
var MUTANT = 2;
var LINE_MASK = 1;
var COL_MASK = 2;
var BLOCK_MASK = 4;
var UNIT_MASKS = [BLOCK_MASK, LINE_MASK, COL_MASK];
var NUMBER_OF_UNITS = UNITS * 3;
var BaseStackEntry = class {
  /** The index of the base unit that is currently tried */
  aktIndex = 0;
  /** The unit that was set previously */
  lastUnit = 0;
  /** All cells that are in at least one base set and hold the fish candidate */
  c0 = 0;
  c1 = 0;
  c2 = 0;
  /** All cells that are in more than one base set and have to be treated as fins */
  e0 = 0;
  e1 = 0;
  e2 = 0;
};
var CoverStackEntry = class {
  aktIndex = 0;
  lastUnit = 0;
  /** All cells that are in at least one cover set and hold the fish candidate */
  c0 = 0;
  c1 = 0;
  c2 = 0;
  /** All cells that are in more than one cover set (potential cannibalistic eliminations) */
  k0 = 0;
  k1 = 0;
  k2 = 0;
};
function popcount(x) {
  let v = x - (x >>> 1 & 1431655765);
  v = (v & 858993459) + (v >>> 2 & 858993459);
  return (v + (v >>> 4) & 252645135) * 16843009 >>> 24;
}
function size3(a0, a1, a2) {
  return popcount(a0) + popcount(a1) + popcount(a2);
}
var FishSolver = class extends AbstractSolver {
  /** The fish candidate */
  candidate = 0;
  /** all positions where the fish candidate is still possible */
  cand0 = 0;
  cand1 = 0;
  cand2 = 0;
  createFishSet = new SudokuSet();
  getBuddiesSet = new SudokuSet();
  finSet = new SudokuSet();
  /** true if only finless fish should be found */
  withoutFins = false;
  /** true if only finned or sashimi fish should be found */
  withFins = false;
  /** true if finned fish can contain endo fins */
  withEndoFins = false;
  /** true if only sashimi fish should be found (withFins has to be true as well) */
  sashimi = false;
  /** the fish category (BASIC, FRANKEN, MUTANT) */
  fishType = UNDEFINED;
  minSize = 0;
  maxSize = 0;
  /** all possible base units (indices of constraints) with, per unit, all cells where the candidate is set */
  baseUnits = new Array(NUMBER_OF_UNITS).fill(0);
  baseC0 = new Array(NUMBER_OF_UNITS).fill(0);
  baseC1 = new Array(NUMBER_OF_UNITS).fill(0);
  baseC2 = new Array(NUMBER_OF_UNITS).fill(0);
  numberOfBaseUnits = 0;
  /** all possible cover units */
  allCoverUnits = new Array(NUMBER_OF_UNITS).fill(0);
  allCoverC0 = new Array(NUMBER_OF_UNITS).fill(0);
  allCoverC1 = new Array(NUMBER_OF_UNITS).fill(0);
  allCoverC2 = new Array(NUMBER_OF_UNITS).fill(0);
  numberOfAllCoverUnits = 0;
  /** the cover units of the current cover search */
  coverUnits = new Array(NUMBER_OF_UNITS).fill(0);
  coverC0 = new Array(NUMBER_OF_UNITS).fill(0);
  coverC1 = new Array(NUMBER_OF_UNITS).fill(0);
  coverC2 = new Array(NUMBER_OF_UNITS).fill(0);
  numberOfCoverUnits = 0;
  /** true for all base units that are currently used */
  baseUnitsUsed = new Array(NUMBER_OF_UNITS).fill(false);
  baseStack = Array.from({ length: 9 }, () => new BaseStackEntry());
  baseLevel = 0;
  coverUnitsUsed = new Array(NUMBER_OF_UNITS).fill(false);
  coverStack = Array.from({ length: 9 }, () => new CoverStackEntry());
  coverLevel = 0;
  /** true if all fish should be found (not used by the default searches) */
  searchAll = false;
  /** true if Siamese Fish should be found (not supported) */
  siamese = false;
  /** all steps found by the last search */
  steps = [];
  /** steps that were found but cannot be used right now (finned <-> sashimi) */
  cachedSteps = [];
  /** the finder step number of the last executed step */
  lastStepNumber = 0;
  constructor(finder) {
    super(finder);
  }
  getStep(type) {
    this.sudoku = this.finder.getSudoku();
    const parts = classify(type);
    if (parts === null) return null;
    const { size, kind } = parts;
    this.searchAll = false;
    switch (kind) {
      case "BASIC":
        return this.getAnyFish(size, true, false, false, false, BASIC);
      case "FINNED":
        return this.getAnyFish(size, false, true, false, false, BASIC);
      case "SASHIMI":
        return this.getAnyFish(size, false, true, true, false, BASIC);
      case "FRANKEN":
        return this.getAnyFish(size, true, false, false, true, FRANKEN);
      case "FINNED_FRANKEN":
        return this.getAnyFish(size, false, true, false, true, FRANKEN);
      case "MUTANT":
        return this.getAnyFish(size, true, false, false, true, MUTANT);
      case "FINNED_MUTANT":
        return this.getAnyFish(size, false, true, false, true, MUTANT);
    }
  }
  doStep(step) {
    this.sudoku = this.finder.getSudoku();
    if (classify(step.type) !== null) {
      for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
      return true;
    }
    return false;
  }
  /** Search for a fish of a given size and shape. */
  getAnyFish(size, withoutFins, withFins, sashimi, withEndoFins, fishType) {
    this.searchAll = false;
    if (this.finder.getStepNumber() !== this.lastStepNumber) {
      this.cachedSteps = [];
      this.lastStepNumber = this.finder.getStepNumber();
    } else {
      for (const step2 of this.cachedSteps) {
        const type = step2.type;
        if (getFishSize(type) === size && (fishType === BASIC && isBasicFish(type) || fishType === FRANKEN && isFrankenFish(type) || fishType === MUTANT && isMutantFish(type)) && withFins && (step2.fins.length > 0 || step2.endoFins.length > 0) && sashimi === isSashimiFish(type)) {
          this.cachedSteps = [];
          return step2;
        }
      }
    }
    this.steps = [];
    if (this.finder.options.allowDualsAndSiamese) throw new Error("allowDualsAndSiamese is not supported yet");
    let step = null;
    for (let cand = 1; cand <= 9; cand++) {
      step = this.getFishesForCandidate(cand, size, size, withoutFins, withFins, sashimi, withEndoFins, fishType);
      if (step !== null) return step;
    }
    return step;
  }
  /**
   * Searches for fish of one candidate. For BASIC and FRANKEN fish lines/columns
   * is tried first, then columns/lines.
   */
  getFishesForCandidate(candidate, minSize, maxSize, withoutFins, withFins, sashimi, withEndoFins, fishType) {
    this.siamese = this.finder.options.allowDualsAndSiamese;
    this.fishType = fishType;
    this.candidate = candidate;
    const cands = this.finder.getCandidates()[candidate];
    this.cand0 = cands.m0;
    this.cand1 = cands.m1;
    this.cand2 = cands.m2;
    this.withoutFins = withoutFins;
    this.withFins = withFins;
    this.withEndoFins = withEndoFins;
    this.sashimi = sashimi;
    this.minSize = minSize;
    this.maxSize = maxSize;
    const step = this.getFishes(true);
    if (fishType === MUTANT || step !== null) return step;
    return this.getFishes(false) ?? step;
  }
  /**
   * All fish with size between minSize and maxSize of the current category. Most required data
   * is kept in fields to reduce the overhead of method calls.
   */
  getFishes(lines) {
    this.initForCandidate(this.maxSize, this.withFins, lines);
    this.baseUnitsUsed.fill(false);
    const baseStack = this.baseStack;
    this.baseLevel = 1;
    baseStack[0].c0 = baseStack[0].c1 = baseStack[0].c2 = 0;
    baseStack[0].e0 = baseStack[0].e1 = baseStack[0].e2 = 0;
    baseStack[1].aktIndex = 0;
    baseStack[1].lastUnit = -1;
    const maxEndoFins = this.finder.options.maxEndoFins;
    while (true) {
      while (baseStack[this.baseLevel].aktIndex >= this.numberOfBaseUnits) {
        if (baseStack[this.baseLevel].lastUnit !== -1) {
          this.baseUnitsUsed[baseStack[this.baseLevel].lastUnit] = false;
          baseStack[this.baseLevel].lastUnit = -1;
        }
        this.baseLevel--;
        if (this.baseLevel <= 0) {
          return this.steps.length > 0 ? this.steps[0] : null;
        }
      }
      const bEntry = baseStack[this.baseLevel];
      const prev = baseStack[this.baseLevel - 1];
      const aktBaseIndex = bEntry.aktIndex++;
      const akt0 = prev.c0 & this.baseC0[aktBaseIndex];
      const akt1 = prev.c1 & this.baseC1[aktBaseIndex];
      const akt2 = prev.c2 & this.baseC2[aktBaseIndex];
      if (akt0 !== 0 || akt1 !== 0 || akt2 !== 0) {
        if (!this.withFins || !this.withEndoFins || size3(prev.e0, prev.e1, prev.e2) + size3(akt0, akt1, akt2) > maxEndoFins) {
          continue;
        }
      }
      bEntry.c0 = prev.c0 | this.baseC0[aktBaseIndex];
      bEntry.c1 = prev.c1 | this.baseC1[aktBaseIndex];
      bEntry.c2 = prev.c2 | this.baseC2[aktBaseIndex];
      bEntry.e0 = prev.e0 | akt0;
      bEntry.e1 = prev.e1 | akt1;
      bEntry.e2 = prev.e2 | akt2;
      if (bEntry.lastUnit !== -1) this.baseUnitsUsed[bEntry.lastUnit] = false;
      bEntry.lastUnit = this.baseUnits[aktBaseIndex];
      this.baseUnitsUsed[this.baseUnits[aktBaseIndex]] = true;
      if (this.baseLevel >= this.minSize && this.baseLevel <= this.maxSize) {
        const step = this.searchCoverUnits(bEntry.c0, bEntry.c1, bEntry.c2, bEntry.e0, bEntry.e1, bEntry.e2);
        if (step !== null) return step;
      }
      if (this.baseLevel < this.maxSize) {
        this.baseLevel++;
        const next = baseStack[this.baseLevel];
        next.aktIndex = aktBaseIndex + 1;
        next.lastUnit = -1;
      }
    }
  }
  /**
   * The complete cover unit search: all combinations of cover units that are not
   * identical with base units are tried.
   */
  searchCoverUnits(base0, base1, base2, endo0, endo1, endo2) {
    this.numberOfCoverUnits = 0;
    for (let i = 0; i < this.numberOfAllCoverUnits; i++) {
      if (this.baseUnitsUsed[this.allCoverUnits[i]]) continue;
      if ((base0 & this.allCoverC0[i]) === 0 && (base1 & this.allCoverC1[i]) === 0 && (base2 & this.allCoverC2[i]) === 0) {
        continue;
      }
      this.coverUnits[this.numberOfCoverUnits] = this.allCoverUnits[i];
      this.coverC0[this.numberOfCoverUnits] = this.allCoverC0[i];
      this.coverC1[this.numberOfCoverUnits] = this.allCoverC1[i];
      this.coverC2[this.numberOfCoverUnits++] = this.allCoverC2[i];
    }
    this.coverUnitsUsed.fill(false);
    const coverStack = this.coverStack;
    this.coverLevel = 1;
    coverStack[0].c0 = coverStack[0].c1 = coverStack[0].c2 = 0;
    coverStack[0].k0 = coverStack[0].k1 = coverStack[0].k2 = 0;
    coverStack[1].aktIndex = 0;
    coverStack[1].lastUnit = -1;
    const maxFins = this.finder.options.maxFins;
    while (true) {
      while (coverStack[this.coverLevel].aktIndex >= this.numberOfCoverUnits - this.baseLevel + this.coverLevel) {
        if (coverStack[this.coverLevel].lastUnit !== -1) {
          this.coverUnitsUsed[coverStack[this.coverLevel].lastUnit] = false;
          coverStack[this.coverLevel].lastUnit = -1;
        }
        this.coverLevel--;
        if (this.coverLevel <= 0) {
          return this.steps.length > 0 ? this.steps[0] : null;
        }
      }
      const cEntry = coverStack[this.coverLevel];
      const prev = coverStack[this.coverLevel - 1];
      const aktCoverIndex = cEntry.aktIndex++;
      const can0 = prev.c0 & this.coverC0[aktCoverIndex];
      const can1 = prev.c1 & this.coverC1[aktCoverIndex];
      const can2 = prev.c2 & this.coverC2[aktCoverIndex];
      cEntry.c0 = prev.c0 | this.coverC0[aktCoverIndex];
      cEntry.c1 = prev.c1 | this.coverC1[aktCoverIndex];
      cEntry.c2 = prev.c2 | this.coverC2[aktCoverIndex];
      cEntry.k0 = prev.k0 | can0;
      cEntry.k1 = prev.k1 | can1;
      cEntry.k2 = prev.k2 | can2;
      if (cEntry.lastUnit !== -1) this.coverUnitsUsed[cEntry.lastUnit] = false;
      cEntry.lastUnit = this.coverUnits[aktCoverIndex];
      this.coverUnitsUsed[this.coverUnits[aktCoverIndex]] = true;
      if (this.coverLevel === this.baseLevel) {
        const m0 = ~cEntry.c0 & base0;
        const m1 = ~cEntry.c1 & base1;
        const m2 = ~cEntry.c2 & base2;
        const isCovered = m0 === 0 && m1 === 0 && m2 === 0;
        const fins0 = m0 | endo0;
        const fins1 = m1 | endo1;
        const fins2 = m2 | endo2;
        let finSize = 0;
        if (isCovered && this.withoutFins && fins0 === 0 && fins1 === 0 && fins2 === 0) {
          const t0 = cEntry.c0 & ~base0;
          const t1 = cEntry.c1 & ~base1;
          const t2 = cEntry.c2 & ~base2;
          if (t0 !== 0 || t1 !== 0 || t2 !== 0 || cEntry.k0 !== 0 || cEntry.k1 !== 0 || cEntry.k2 !== 0) {
            const step = this.createFishStep(
              this.coverLevel,
              false,
              [fins0, fins1, fins2],
              [t0, t1, t2],
              [cEntry.k0, cEntry.k1, cEntry.k2],
              [endo0, endo1, endo2],
              [t0, t1, t2]
            );
            if (step !== null) return step;
          }
        } else if (this.withFins && (finSize = size3(fins0, fins1, fins2)) > 0 && finSize <= maxFins) {
          this.finSet.setWords(fins0, fins1, fins2);
          getBuddiesOfSet(this.finSet, this.getBuddiesSet);
          const fb = this.getBuddiesSet;
          if (!fb.isEmpty()) {
            let t0 = cEntry.c0 & ~base0;
            let t1 = cEntry.c1 & ~base1;
            let t2 = cEntry.c2 & ~base2;
            const pot0 = t0;
            const pot1 = t1;
            const pot2 = t2;
            t0 &= fb.m0;
            t1 &= fb.m1;
            t2 &= fb.m2;
            const k0 = cEntry.k0 & fb.m0;
            const k1 = cEntry.k1 & fb.m1;
            const k2 = cEntry.k2 & fb.m2;
            if (t0 !== 0 || t1 !== 0 || t2 !== 0 || k0 !== 0 || k1 !== 0 || k2 !== 0) {
              const step = this.createFishStep(
                this.coverLevel,
                true,
                [fins0, fins1, fins2],
                [t0, t1, t2],
                [k0, k1, k2],
                [endo0, endo1, endo2],
                [pot0, pot1, pot2]
              );
              if (step !== null) return step;
            }
          }
        }
      }
      if (this.coverLevel < this.maxSize) {
        this.coverLevel++;
        const next = coverStack[this.coverLevel];
        next.aktIndex = aktCoverIndex + 1;
        next.lastUnit = -1;
      }
    }
  }
  /**
   * Create a new fish step. Returns null if the step can't be used right now: a sashimi fish found
   * while searching finned fish (and vice versa) is cached for a later search.
   */
  createFishStep(size, withFins, fins, del, cannibalistic, endoFins, potentialEliminations) {
    const candidate = this.candidate;
    const baseMask = unitMask(this.baseUnitsUsed);
    const coverMask = unitMask(this.coverUnitsUsed);
    const basicShape = baseMask === LINE_MASK && coverMask === COL_MASK || baseMask === COL_MASK && coverMask === LINE_MASK;
    let isSashimi = false;
    if (basicShape) {
      for (let i = 0; i < this.numberOfBaseUnits; i++) {
        if (this.baseUnitsUsed[this.baseUnits[i]]) {
          const c0 = this.baseC0[i] & ~fins[0];
          const c1 = this.baseC1[i] & ~fins[1];
          const c2 = this.baseC2[i] & ~fins[2];
          if (size3(c0, c1, c2) <= 1) {
            isSashimi = true;
            break;
          }
        }
      }
    }
    let type;
    if (basicShape) {
      type = isSashimi ? SASHIMI_BASIC_TYPES[size - 2] : withFins ? FINNED_BASIC_TYPES[size - 2] : BASIC_TYPES[size - 2];
    } else if ((baseMask === LINE_MASK || baseMask === (LINE_MASK | BLOCK_MASK)) && (coverMask === COL_MASK || coverMask === (COL_MASK | BLOCK_MASK)) || (baseMask === COL_MASK || baseMask === (COL_MASK | BLOCK_MASK)) && (coverMask === LINE_MASK || coverMask === (LINE_MASK | BLOCK_MASK))) {
      type = withFins ? FINNED_FRANKEN_TYPES[size - 2] : FRANKEN_TYPES[size - 2];
    } else {
      type = withFins ? FINNED_MUTANT_TYPES[size - 2] : MUTANT_TYPES[size - 2];
    }
    const step = new SolutionStep(type);
    const set = this.createFishSet;
    step.addValue(candidate);
    const top = this.baseStack[this.baseLevel];
    set.setWords(top.c0 & ~fins[0], top.c1 & ~fins[1], top.c2 & ~fins[2]);
    for (const idx of set) step.addIndex(idx);
    for (let i = 0; i < this.baseUnitsUsed.length; i++) {
      if (this.baseUnitsUsed[i]) {
        step.baseEntities.push({
          type: CONSTRAINT_TYPE_FROM_CONSTRAINT[i],
          number: CONSTRAINT_NUMBER_FROM_CONSTRAINT[i]
        });
      }
    }
    for (let i = 0; i < this.coverUnitsUsed.length; i++) {
      if (this.coverUnitsUsed[i]) {
        step.coverEntities.push({
          type: CONSTRAINT_TYPE_FROM_CONSTRAINT[i],
          number: CONSTRAINT_NUMBER_FROM_CONSTRAINT[i]
        });
      }
    }
    set.setWords(del[0], del[1], del[2]);
    for (const idx of set) step.addCandidateToDelete(idx, candidate);
    set.setWords(cannibalistic[0], cannibalistic[1], cannibalistic[2]);
    for (const idx of set) {
      step.addCannibalistic(idx, candidate);
      step.addCandidateToDelete(idx, candidate);
    }
    set.setWords(fins[0] & ~endoFins[0], fins[1] & ~endoFins[1], fins[2] & ~endoFins[2]);
    for (const idx of set) step.addFin(idx, candidate);
    set.setWords(endoFins[0], endoFins[1], endoFins[2]);
    for (const idx of set) step.addEndoFin(idx, candidate);
    step.potentialEliminations.setWords(potentialEliminations[0], potentialEliminations[1], potentialEliminations[2]);
    step.potentialCannibalisticEliminations.setWords(cannibalistic[0], cannibalistic[1], cannibalistic[2]);
    if (this.fishType === BASIC && this.withFins && this.sashimi !== isSashimi) {
      this.cachedSteps.push(step.clone());
      return null;
    }
    return step;
  }
  /**
   * Calculates all base and cover sets for the current search. Which set is possible depends on
   * the fish category, its size (a base set in a search without fins cannot have more than `size`
   * candidates) and `lines`: if true, the base sets include the lines and the cover sets the columns
   * for basic and Franken fish.
   */
  initForCandidate(size, withFins, lines) {
    this.numberOfBaseUnits = this.numberOfAllCoverUnits = 0;
    for (let i = 0; i < ALL_CONSTRAINTS_TEMPLATES.length; i++) {
      if (i >= 18 && this.fishType === BASIC) continue;
      const unit = ALL_CONSTRAINTS_TEMPLATES[i];
      const t0 = unit.m0 & this.cand0;
      const t1 = unit.m1 & this.cand1;
      const t2 = unit.m2 & this.cand2;
      if (t0 === 0 && t1 === 0 && t2 === 0) continue;
      const mutant = this.fishType === MUTANT;
      if (i < 9) {
        if (lines || mutant) {
          this.addUnit(i, t0, t1, t2, true, size, withFins);
          if (mutant) this.addUnit(i, t0, t1, t2, false, size, withFins);
        } else {
          this.addUnit(i, t0, t1, t2, false, size, withFins);
        }
      } else if (i < 18) {
        if (lines || mutant) {
          this.addUnit(i, t0, t1, t2, false, size, withFins);
          if (mutant) this.addUnit(i, t0, t1, t2, true, size, withFins);
        } else {
          this.addUnit(i, t0, t1, t2, true, size, withFins);
        }
      } else if (this.fishType !== BASIC) {
        this.addUnit(i, t0, t1, t2, false, size, withFins);
        this.addUnit(i, t0, t1, t2, true, size, withFins);
      }
    }
  }
  /** Add a unit to the base or cover units. Without fins a base unit may have at most `size` candidates. */
  addUnit(unit, s0, s1, s2, base, size, withFins) {
    if (base) {
      if (withFins || size3(s0, s1, s2) <= size) {
        this.baseUnits[this.numberOfBaseUnits] = unit;
        this.baseC0[this.numberOfBaseUnits] = s0;
        this.baseC1[this.numberOfBaseUnits] = s1;
        this.baseC2[this.numberOfBaseUnits++] = s2;
      }
    } else {
      this.allCoverUnits[this.numberOfAllCoverUnits] = unit;
      this.allCoverC0[this.numberOfAllCoverUnits] = s0;
      this.allCoverC1[this.numberOfAllCoverUnits] = s1;
      this.allCoverC2[this.numberOfAllCoverUnits++] = s2;
    }
  }
};
function unitMask(used) {
  let mask = 0;
  for (let i = 0; i < used.length; i++) {
    if (used[i]) mask |= UNIT_MASKS[CONSTRAINT_TYPE_FROM_CONSTRAINT[i]];
  }
  return mask;
}
function classify(type) {
  const lists = [
    ["BASIC", BASIC_TYPES],
    ["FINNED", FINNED_BASIC_TYPES],
    ["SASHIMI", SASHIMI_BASIC_TYPES],
    ["FRANKEN", FRANKEN_TYPES],
    ["FINNED_FRANKEN", FINNED_FRANKEN_TYPES],
    ["MUTANT", MUTANT_TYPES],
    ["FINNED_MUTANT", FINNED_MUTANT_TYPES]
  ];
  for (const [kind, types] of lists) {
    const i = types.indexOf(type);
    if (i !== -1) return { size: i + 2, kind };
  }
  return null;
}

// ../core/src/generator/random.ts
function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function nextInt(rng2, max) {
  return Math.floor(rng2() * max);
}

// ../core/src/generator/sudokuGenerator.ts
var RecursionStackEntry = class {
  sudoku = new Sudoku2();
  index = 0;
  candidates = [];
  candIndex = 0;
};
var MAX_PATTERN_TRIES = 1e6;
var SudokuGenerator = class {
  constructor(rng2 = Math.random) {
    this.rng = rng2;
  }
  emptyGrid = new Sudoku2();
  solution = new Array(LENGTH).fill(0);
  solutionCount = 0;
  stack = Array.from({ length: LENGTH + 1 }, () => new RecursionStackEntry());
  generateIndices = new Array(LENGTH).fill(0);
  newFullSudoku = new Array(LENGTH).fill(0);
  newValidSudoku = new Array(LENGTH).fill(0);
  /** The number of solutions (searching stops at 2). If it is exactly 1, the solution is stored in the sudoku. */
  getNumberOfSolutions(sudoku) {
    this.solveSudoku(sudoku);
    if (this.solutionCount === 1) this.storeSolution(sudoku);
    return this.solutionCount;
  }
  /** true if the sudoku has exactly one solution (which is then stored in the sudoku). */
  validSolution(sudoku) {
    return this.getNumberOfSolutions(sudoku) === 1;
  }
  /** The solution found by the last search (only meaningful if there is at least one). */
  getSolution() {
    return this.solution;
  }
  getSolutionCount() {
    return this.solutionCount;
  }
  /** Count solutions of a puzzle given as 81 characters ('1'-'9' for givens, anything else is empty). */
  solveString(puzzle) {
    const stack0 = this.stack[0];
    stack0.sudoku.set(this.emptyGrid);
    stack0.candidates = [];
    stack0.candIndex = 0;
    for (let i = 0; i < puzzle.length && i < LENGTH; i++) {
      const value = puzzle.charCodeAt(i) - 48;
      if (value >= 1 && value <= 9) {
        stack0.sudoku.setCell(i, value, false, false);
        this.setAllExposedSingles(stack0.sudoku);
      }
    }
    this.solveStack();
    return this.solutionCount;
  }
  /** Count solutions of a puzzle given as cell values (0 = empty). */
  solveValues(cellValues) {
    const stack0 = this.stack[0];
    stack0.sudoku.set(this.emptyGrid);
    stack0.candidates = [];
    stack0.candIndex = 0;
    for (let i = 0; i < cellValues.length; i++) {
      if (cellValues[i] >= 1 && cellValues[i] <= 9) stack0.sudoku.setCellBS(i, cellValues[i]);
    }
    stack0.sudoku.rebuildInternalData();
    this.setAllExposedSingles(stack0.sudoku);
    this.solveStack();
  }
  solveSudoku(sudoku) {
    const stack0 = this.stack[0];
    stack0.sudoku.set(sudoku);
    stack0.index = 0;
    stack0.candidates = [];
    stack0.candIndex = 0;
    this.solveStack();
  }
  storeSolution(sudoku) {
    sudoku.solution.set(this.solution);
    sudoku.solutionSet = true;
  }
  /** The search itself; the start sudoku is in stack[0]. */
  solveStack() {
    const stack = this.stack;
    this.solutionCount = 0;
    if (!this.setAllExposedSingles(stack[0].sudoku)) return;
    if (stack[0].sudoku.unsolvedCellsAnz === 0) {
      this.solution = Array.from(stack[0].sudoku.values);
      this.solutionCount++;
      return;
    }
    let level2 = 0;
    while (true) {
      if (stack[level2].sudoku.unsolvedCellsAnz === 0) {
        this.solutionCount++;
        if (this.solutionCount === 1) this.solution = Array.from(stack[level2].sudoku.values);
        else if (this.solutionCount > 1) return;
      } else {
        let index = -1;
        let anzCand = 9;
        const sudoku = stack[level2].sudoku;
        for (let i = 0; i < LENGTH; i++) {
          if (sudoku.getCell(i) !== 0 && ANZ_VALUES[sudoku.getCell(i)] < anzCand) {
            index = i;
            anzCand = ANZ_VALUES[sudoku.getCell(i)];
          }
        }
        level2++;
        if (index < 0) {
          this.solutionCount = 0;
          return;
        }
        stack[level2].index = index;
        stack[level2].candidates = POSSIBLE_VALUES[stack[level2 - 1].sudoku.getCell(index)];
        stack[level2].candIndex = 0;
      }
      let done = false;
      while (true) {
        while (stack[level2].candIndex >= stack[level2].candidates.length) {
          level2--;
          if (level2 <= 0) {
            done = true;
            break;
          }
        }
        if (done) break;
        const nextCand = stack[level2].candidates[stack[level2].candIndex++];
        stack[level2].sudoku.setBS(stack[level2 - 1].sudoku);
        if (!stack[level2].sudoku.setCell(stack[level2].index, nextCand, false, false)) continue;
        if (this.setAllExposedSingles(stack[level2].sudoku)) break;
      }
      if (done) break;
    }
  }
  /** Create a new puzzle with exactly one solution, or null if a pattern can't be satisfied. */
  generateSudoku(options = {}) {
    this.generateFullGrid();
    if (options.pattern === void 0) {
      this.generateInitPos(options.symmetric ?? true);
    } else {
      let ok = false;
      for (let i = 0; i < MAX_PATTERN_TRIES && !ok; i++) {
        if (i > 0) this.generateFullGrid();
        ok = this.generateInitPosPattern(options.pattern);
      }
      if (!ok) return null;
    }
    const sudoku = new Sudoku2();
    for (let i = 0; i < LENGTH; i++) {
      if (this.newValidSudoku[i] !== 0) {
        sudoku.setCell(i, this.newValidSudoku[i]);
        sudoku.fixed[i] = true;
      }
    }
    sudoku.status = "VALID";
    sudoku.statusGivens = "VALID";
    return sudoku;
  }
  generateFullGrid() {
    while (!this.doGenerateFullGrid()) {
    }
  }
  /** Fill an empty grid by backtracking, visiting the cells in random order. Gives up after 100 tries. */
  doGenerateFullGrid() {
    const stack = this.stack;
    const max = this.generateIndices.length;
    for (let i = 0; i < max; i++) this.generateIndices[i] = i;
    for (let i = 0; i < max; i++) {
      const index1 = nextInt(this.rng, max);
      let index2 = nextInt(this.rng, max);
      while (index1 === index2) index2 = nextInt(this.rng, max);
      const dummy = this.generateIndices[index1];
      this.generateIndices[index1] = this.generateIndices[index2];
      this.generateIndices[index2] = dummy;
    }
    stack[0].sudoku.set(this.emptyGrid);
    let level2 = 0;
    stack[0].index = -1;
    let actTries = 0;
    while (true) {
      if (stack[level2].sudoku.unsolvedCellsAnz === 0) {
        this.newFullSudoku = Array.from(stack[level2].sudoku.values);
        return true;
      }
      let index = -1;
      const actValues = stack[level2].sudoku.values;
      for (let i = 0; i < LENGTH; i++) {
        const actTry = this.generateIndices[i];
        if (actValues[actTry] === 0) {
          index = actTry;
          break;
        }
      }
      level2++;
      stack[level2].index = index;
      stack[level2].candidates = POSSIBLE_VALUES[stack[level2 - 1].sudoku.getCell(index)];
      stack[level2].candIndex = 0;
      actTries++;
      if (actTries > 100) return false;
      let done = false;
      while (true) {
        while (stack[level2].candIndex >= stack[level2].candidates.length) {
          level2--;
          if (level2 <= 0) {
            done = true;
            break;
          }
        }
        if (done) break;
        const nextCand = stack[level2].candidates[stack[level2].candIndex++];
        stack[level2].sudoku.setBS(stack[level2 - 1].sudoku);
        if (!stack[level2].sudoku.setCell(stack[level2].index, nextCand, false, false)) continue;
        if (this.setAllExposedSingles(stack[level2].sudoku)) break;
      }
      if (done) break;
    }
    return false;
  }
  /** A pattern says which cells are givens; the puzzle is valid if it has exactly one solution. */
  generateInitPosPattern(pattern) {
    this.newValidSudoku = this.newFullSudoku.slice();
    for (let i = 0; i < pattern.length; i++) {
      if (!pattern[i]) this.newValidSudoku[i] = 0;
    }
    this.solveValues(this.newValidSudoku);
    return this.solutionCount === 1;
  }
  /** Remove clues in random order while the solution stays unique (never going below 17 clues). */
  generateInitPos(isSymmetric) {
    const maxPosToFill = 17;
    const used = new Array(LENGTH).fill(false);
    let usedCount = LENGTH;
    this.newValidSudoku = this.newFullSudoku.slice();
    const valid = this.newValidSudoku;
    let remainingClues = valid.length;
    while (remainingClues > maxPosToFill && usedCount > 1) {
      let i = nextInt(this.rng, LENGTH);
      do {
        i = i < 80 ? i + 1 : 0;
      } while (used[i]);
      used[i] = true;
      usedCount--;
      if (valid[i] === 0) continue;
      const notCenter = Math.floor(i / 9) !== 4 || i % 9 !== 4;
      const symm = 9 * (8 - Math.floor(i / 9)) + (8 - i % 9);
      if (isSymmetric && notCenter && valid[symm] === 0) continue;
      valid[i] = 0;
      remainingClues--;
      if (isSymmetric && notCenter) {
        valid[symm] = 0;
        used[symm] = true;
        usedCount--;
        remainingClues--;
      }
      this.solveValues(valid);
      if (this.solutionCount > 1) {
        valid[i] = this.newFullSudoku[i];
        remainingClues++;
        if (isSymmetric && notCenter) {
          valid[symm] = this.newFullSudoku[symm];
          remainingClues++;
        }
      }
    }
  }
  /** Fill all naked and hidden singles. Returns false if the sudoku becomes invalid. */
  setAllExposedSingles(sudoku) {
    let valid = true;
    const nsQueue = sudoku.nsQueue;
    const hsQueue = sudoku.hsQueue;
    do {
      let singleIndex;
      while (valid && (singleIndex = nsQueue.getSingle()) !== -1) {
        const index = nsQueue.getIndex(singleIndex);
        const value = nsQueue.getValue(singleIndex);
        if ((sudoku.getCell(index) & MASKS[value]) !== 0) valid = sudoku.setCell(index, value, false, false);
      }
      while (valid && (singleIndex = hsQueue.getSingle()) !== -1) {
        const index = hsQueue.getIndex(singleIndex);
        const value = hsQueue.getValue(singleIndex);
        if ((sudoku.getCell(index) & MASKS[value]) !== 0) valid = sudoku.setCell(index, value, false, false);
      }
    } while (valid && !(nsQueue.isEmpty() && hsQueue.isEmpty()));
    return valid;
  }
};

// ../core/src/solver/lastResortSolvers.ts
var BruteForceSolver = class extends AbstractSolver {
  generator = null;
  constructor(finder) {
    super(finder);
  }
  getStep(type) {
    this.sudoku = this.finder.getSudoku();
    return type === "BRUTE_FORCE" ? this.getBruteForce() : null;
  }
  doStep(step) {
    this.sudoku = this.finder.getSudoku();
    if (step.type !== "BRUTE_FORCE") return false;
    const value = step.values[0];
    for (const index of step.indices) this.sudoku.setCell(index, value);
    return true;
  }
  getBruteForce() {
    if (!this.sudoku.solutionSet) {
      this.generator ??= new SudokuGenerator();
      if (!this.generator.validSolution(this.sudoku)) return null;
    }
    const unsolved = new SudokuSet();
    for (let i = 0; i < LENGTH; i++) {
      if (this.sudoku.getValue(i) === 0) unsolved.add(i);
    }
    const index = unsolved.get(Math.floor(unsolved.size() / 2));
    const step = new SolutionStep("BRUTE_FORCE");
    step.addIndex(index);
    step.addValue(this.sudoku.getSolution(index));
    return step;
  }
};
var GiveUpSolver = class extends AbstractSolver {
  constructor(finder) {
    super(finder);
  }
  getStep(type) {
    return type === "GIVE_UP" ? new SolutionStep("GIVE_UP") : null;
  }
  doStep(step) {
    return step.type === "GIVE_UP";
  }
};
var IncompleteSolver = class extends AbstractSolver {
  constructor(finder) {
    super(finder);
  }
  getStep() {
    return null;
  }
  doStep(step) {
    return step.type === "INCOMPLETE";
  }
};

// ../core/src/solver/miscellaneousSolver.ts
var StackEntry2 = class {
  /** The index (into the source set) of the cell that is currently tried */
  aktIndex = 0;
  /** The cells in the current selection */
  indices = new SudokuSet();
  /** The candidates in the current selection */
  candidates = 0;
};
var MiscellaneousSolver = class extends AbstractSolver {
  /** All unsolved cells in the current row/column */
  nonBlockSet = new SudokuSet();
  /** All unsolved cells in the current block */
  blockSet = new SudokuSet();
  /** All unsolved cells in the current intersection */
  intersectionSet = new SudokuSet();
  nonBlockSourceSet = new SudokuSet();
  blockSourceSet = new SudokuSet();
  stack1 = Array.from({ length: UNITS }, () => new StackEntry2());
  stack2 = Array.from({ length: UNITS }, () => new StackEntry2());
  /** Cells of the current subset of the intersection */
  intersectionActSet = new SudokuSet();
  /** Candidates of all cells in {@link intersectionActSet}. */
  intersectionActCandSet = 0;
  /** The current additional cells in the row/column (references a stack entry, like in the original). */
  nonBlockActSet = new SudokuSet();
  nonBlockActCandSet = 0;
  blockAllowedCandSet = 0;
  /** The current additional cells in the block (references a stack entry). */
  blockActSet = new SudokuSet();
  blockActCandSet = 0;
  tmpSet = new SudokuSet();
  /** The step that is being assembled. */
  globalStep = new SolutionStep("SUE_DE_COQ");
  constructor(finder) {
    super(finder);
  }
  getStep(type) {
    this.sudoku = this.finder.getSudoku();
    if (type === "SUE_DE_COQ") {
      return this.getSueDeCoqInt(LINE_TEMPLATES, BLOCK_TEMPLATES) ?? this.getSueDeCoqInt(COL_TEMPLATES, BLOCK_TEMPLATES);
    }
    return null;
  }
  doStep(step) {
    this.sudoku = this.finder.getSudoku();
    if (step.type === "SUE_DE_COQ") {
      for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
      return true;
    }
    return false;
  }
  /** Builds all possible intersections of `blocks` and `nonBlocks` (all lines or all columns) and checks each. */
  getSueDeCoqInt(nonBlocks, blocks) {
    const emptyCells = this.finder.getEmptyCells();
    for (const nonBlock of nonBlocks) {
      this.nonBlockSet.setAnd(nonBlock, emptyCells);
      for (const block of blocks) {
        this.blockSet.setAnd(block, emptyCells);
        this.intersectionSet.set(this.nonBlockSet);
        this.intersectionSet.and(this.blockSet);
        if (this.intersectionSet.size() < 2) continue;
        const step = this.checkIntersection();
        if (step !== null) return step;
      }
    }
    return null;
  }
  /**
   * Checks all combinations of two or three cells in the intersection. If a
   * combination holds at least 2 more candidates than cells, a Sue de Coq is possible.
   */
  checkIntersection() {
    const sudoku = this.sudoku;
    const max = this.intersectionSet.size();
    const actSet = this.intersectionActSet;
    actSet.clear();
    for (let i1 = 0; i1 < max - 1; i1++) {
      const index1 = this.intersectionSet.get(i1);
      actSet.add(index1);
      const cand1 = sudoku.getCell(index1);
      for (let i2 = i1 + 1; i2 < max; i2++) {
        const index2 = this.intersectionSet.get(i2);
        const cand2 = cand1 | sudoku.getCell(index2);
        actSet.add(index2);
        let nPlus = ANZ_VALUES[cand2] - 2;
        if (nPlus >= 2) {
          const step = this.checkHousesFirst(nPlus, cand2);
          if (step !== null) return step;
        }
        for (let i3 = i2 + 1; i3 < max; i3++) {
          const index3 = this.intersectionSet.get(i3);
          const cand3 = cand2 | sudoku.getCell(index3);
          nPlus = ANZ_VALUES[cand3] - 3;
          if (nPlus >= 2) {
            actSet.add(index3);
            const step = this.checkHousesFirst(nPlus, cand3);
            if (step !== null) return step;
            actSet.remove(index3);
          }
        }
        actSet.remove(index2);
      }
      actSet.remove(index1);
    }
    return null;
  }
  /** All cells of the row/column outside the intersection are valid; delegate to the combination search. */
  checkHousesFirst(nPlus, cand) {
    this.intersectionActCandSet = cand;
    this.nonBlockSourceSet.set(this.nonBlockSet);
    this.nonBlockSourceSet.andNot(this.intersectionActSet);
    return this.checkHouses(nPlus, this.nonBlockSourceSet, MAX_MASK, false);
  }
  /**
   * Non-recursive search over all combinations of cells in `sourceSet`.
   *
   * It runs twice. The first run builds sets of cells from the row/column: a set is
   * valid if it contains candidates from the intersection, has at least one cell more
   * than extra candidates (candidates outside the intersection) but leaves candidates of
   * the intersection for the block. Then the second run builds sets of cells for the block;
   * for every combination that meets the criteria, eliminations are looked for.
   */
  checkHouses(nPlus, sourceSet, allowedCandSet, secondCheck) {
    if (sourceSet.isEmpty()) return null;
    const sudoku = this.sudoku;
    const stack = secondCheck ? this.stack2 : this.stack1;
    const max = sourceSet.size();
    let level2 = 1;
    stack[0].aktIndex = -1;
    stack[0].candidates = 0;
    stack[0].indices.clear();
    stack[1].aktIndex = -1;
    while (true) {
      while (stack[level2].aktIndex >= max - 1) {
        level2--;
        if (level2 <= 0) return null;
      }
      stack[level2].aktIndex++;
      stack[level2].indices.set(stack[level2 - 1].indices);
      stack[level2].indices.add(sourceSet.get(stack[level2].aktIndex));
      stack[level2].candidates = stack[level2 - 1].candidates | sudoku.getCell(sourceSet.get(stack[level2].aktIndex));
      if ((stack[level2].candidates & ~allowedCandSet) === 0) {
        let tmpCands = stack[level2].candidates & this.intersectionActCandSet;
        const anzContained = ANZ_VALUES[tmpCands];
        tmpCands = stack[level2].candidates & ~this.intersectionActCandSet;
        const anzExtra = ANZ_VALUES[tmpCands];
        if (!secondCheck) {
          if (anzContained > 0 && level2 > anzExtra && level2 - anzExtra < nPlus) {
            this.nonBlockActSet = stack[level2].indices;
            this.nonBlockActCandSet = stack[level2].candidates;
            this.blockSourceSet.set(this.blockSet);
            this.blockSourceSet.andNot(this.intersectionActSet);
            this.blockSourceSet.andNot(this.nonBlockActSet);
            this.blockAllowedCandSet = this.nonBlockActCandSet;
            this.blockAllowedCandSet &= ~tmpCands;
            this.blockAllowedCandSet = ~this.blockAllowedCandSet;
            const step = this.checkHouses(
              nPlus - (this.nonBlockActSet.size() - anzExtra),
              this.blockSourceSet,
              this.blockAllowedCandSet,
              true
            );
            if (step !== null) return step;
          }
        } else if (anzContained > 0 && stack[level2].indices.size() - anzExtra === nPlus) {
          const step = new SolutionStep("SUE_DE_COQ");
          this.globalStep = step;
          this.blockActSet = stack[level2].indices;
          this.blockActCandSet = stack[level2].candidates;
          const tmpCandSet1 = this.blockActCandSet & this.nonBlockActCandSet;
          const tmpSet = this.tmpSet;
          tmpSet.set(this.blockSet);
          tmpSet.andNot(this.blockActSet);
          tmpSet.andNot(this.intersectionActSet);
          let tmpCandSet = (this.intersectionActCandSet | this.blockActCandSet) & ~this.nonBlockActCandSet | tmpCandSet1;
          this.checkCandidatesToDelete(step, tmpSet, tmpCandSet);
          tmpSet.set(this.nonBlockSet);
          tmpSet.andNot(this.nonBlockActSet);
          tmpSet.andNot(this.intersectionActSet);
          tmpCandSet = (this.intersectionActCandSet | this.nonBlockActCandSet) & ~this.blockActCandSet | tmpCandSet1;
          this.checkCandidatesToDelete(step, tmpSet, tmpCandSet);
          if (step.candidatesToDelete.length > 0) {
            for (const idx of this.intersectionActSet) step.addIndex(idx);
            for (const c of POSSIBLE_VALUES[this.intersectionActCandSet]) step.addValue(c);
            this.getSetCandidates(this.nonBlockActSet, this.intersectionActSet, this.nonBlockActCandSet, step.fins);
            this.getSetCandidates(this.blockActSet, this.intersectionActSet, this.blockActCandSet, step.endoFins);
            step.addAls(this.intersectionActSet, this.intersectionActCandSet);
            step.addAls(this.blockActSet, this.blockActCandSet);
            step.addAls(this.nonBlockActSet, this.nonBlockActCandSet);
            return step;
          }
        }
      }
      if (stack[level2].aktIndex < max - 1) {
        level2++;
        stack[level2].aktIndex = stack[level2 - 1].aktIndex;
      }
    }
  }
  /** Write all candidates of `candSet` that are in a cell of `srcSet1` or `srcSet2` to `dest` (display only). */
  getSetCandidates(srcSet1, srcSet2, candSet, dest) {
    this.tmpSet.set(srcSet1);
    this.tmpSet.or(srcSet2);
    for (const index of this.tmpSet) {
      const mask = this.sudoku.getCell(index) & candSet;
      if (mask !== 0) {
        for (const c of POSSIBLE_VALUES[mask]) dest.push(new Candidate(index, c));
      }
    }
  }
  /** The candidates of `tmpCandSet` in the cells of `tmpSet` can be eliminated. */
  checkCandidatesToDelete(step, tmpSet, tmpCandSet) {
    if (tmpSet.size() > 0 && ANZ_VALUES[tmpCandSet] > 0) {
      for (const index of tmpSet) {
        const elimCandMask = this.sudoku.getCell(index) & tmpCandSet;
        if (elimCandMask === 0) continue;
        for (const c of POSSIBLE_VALUES[elimCandMask]) step.addCandidateToDelete(index, c);
      }
    }
  }
};

// ../core/src/solver/simpleSolver.ts
var SimpleSolver = class extends AbstractSolver {
  /** The list with all newly found steps (used when searching for all steps). */
  steps = [];
  sameConstraint = [false, false, false];
  foundConstraint = [false, false, false];
  constraint = [0, 0, 0];
  /** Steps that were found but cannot be used right now. */
  cachedSteps = [];
  /** finder.stepNumber that was valid when cachedSteps was filled. */
  cachedStepsNumber = -1;
  tmpArr1 = new Array(9).fill(0);
  /** Bitmaps for indices per candidate in one unit. */
  ipcMask = new Array(10).fill(0);
  constructor(finder) {
    super(finder);
  }
  getStep(type) {
    this.sudoku = this.finder.getSudoku();
    switch (type) {
      case "FULL_HOUSE":
        return this.findFullHouse();
      case "HIDDEN_SINGLE":
        return this.findHiddenSingle();
      case "HIDDEN_PAIR":
        return this.findHiddenXle(2);
      case "HIDDEN_TRIPLE":
        return this.findHiddenXle(3);
      case "HIDDEN_QUADRUPLE":
        return this.findHiddenXle(4);
      case "NAKED_SINGLE":
        return this.findNakedSingle();
      case "LOCKED_PAIR":
        return this.findNakedXle(2, true);
      case "NAKED_PAIR":
        return this.findNakedXle(2, false);
      case "LOCKED_TRIPLE":
        return this.findNakedXle(3, true);
      case "NAKED_TRIPLE":
        return this.findNakedXle(3, false);
      case "NAKED_QUADRUPLE":
        return this.findNakedXle(4, false);
      case "LOCKED_CANDIDATES":
      case "LOCKED_CANDIDATES_1":
      case "LOCKED_CANDIDATES_2":
        return this.findLockedCandidates(type);
      default:
        return null;
    }
  }
  doStep(step) {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case "FULL_HOUSE":
      case "HIDDEN_SINGLE":
      case "NAKED_SINGLE":
        this.sudoku.setCell(step.indices[0], step.values[0]);
        return true;
      case "HIDDEN_PAIR":
      case "HIDDEN_TRIPLE":
      case "HIDDEN_QUADRUPLE":
      case "NAKED_PAIR":
      case "NAKED_TRIPLE":
      case "NAKED_QUADRUPLE":
      case "LOCKED_PAIR":
      case "LOCKED_TRIPLE":
      case "LOCKED_CANDIDATES":
      case "LOCKED_CANDIDATES_1":
      case "LOCKED_CANDIDATES_2":
        for (const cand of step.candidatesToDelete) {
          this.sudoku.delCandidate(cand.index, cand.value);
        }
        return true;
      default:
        return false;
    }
  }
  /**
   * Full House: last unset cell in a unit. A Full House is always also a
   * Naked Single, so the Naked Single queue is traversed and the other
   * candidates in the unit are checked.
   */
  findFullHouse() {
    const free = this.sudoku.free;
    const nsQueue = this.sudoku.nsQueue;
    let queueIndex = nsQueue.getFirstIndex();
    while (queueIndex !== -1) {
      const index = nsQueue.getIndex(queueIndex);
      const value = nsQueue.getValue(queueIndex);
      if (this.sudoku.getValue(index) === 0) {
        for (const constr of CONSTRAINTS[index]) {
          let valid = true;
          for (let j = 1; j <= 9; j++) {
            if (j !== value && free[constr][j] !== 0) {
              valid = false;
              break;
            }
          }
          if (valid) {
            const step = new SolutionStep("FULL_HOUSE");
            step.addValue(value);
            step.addIndex(index);
            return step;
          }
        }
      }
      queueIndex = nsQueue.getNextIndex();
    }
    return null;
  }
  /** All Naked Singles in the queue (the queue is not changed). */
  findAllNakedSingles() {
    this.sudoku = this.finder.getSudoku();
    const result = [];
    const nsQueue = this.sudoku.nsQueue;
    let queueIndex = nsQueue.getFirstIndex();
    while (queueIndex !== -1) {
      const index = nsQueue.getIndex(queueIndex);
      const value = nsQueue.getValue(queueIndex);
      if (this.sudoku.getValue(index) === 0) {
        const step = new SolutionStep("NAKED_SINGLE");
        step.addValue(value);
        step.addIndex(index);
        result.push(step);
      }
      queueIndex = nsQueue.getNextIndex();
    }
    return result.sort((a, b) => a.compareTo(b));
  }
  /**
   * All Hidden Singles in the queue (the queue is not changed). Only one single is recorded
   * per cell.
   */
  findAllHiddenSingles() {
    this.sudoku = this.finder.getSudoku();
    const result = [];
    const singleFound = new Array(81).fill(false);
    const free = this.sudoku.free;
    const hsQueue = this.sudoku.hsQueue;
    let queueIndex = hsQueue.getFirstIndex();
    while (queueIndex !== -1) {
      const index = hsQueue.getIndex(queueIndex);
      const value = hsQueue.getValue(queueIndex);
      if (this.sudoku.getValue(index) === 0 && !singleFound[index]) {
        for (let i = 0; i < CONSTRAINTS[index].length; i++) {
          if (free[CONSTRAINTS[index][i]][value] === 1) {
            const step = new SolutionStep("HIDDEN_SINGLE");
            step.addValue(value);
            step.addIndex(index);
            step.entity = i;
            result.push(step);
            singleFound[index] = true;
            break;
          }
        }
      }
      queueIndex = hsQueue.getNextIndex();
    }
    return result.sort((a, b) => a.compareTo(b));
  }
  /** The next Naked Single in the grid (removed from the queue). */
  findNakedSingle() {
    const nsQueue = this.sudoku.nsQueue;
    let queueIndex;
    while ((queueIndex = nsQueue.getSingle()) !== -1) {
      const index = nsQueue.getIndex(queueIndex);
      const value = nsQueue.getValue(queueIndex);
      if (this.sudoku.getValue(index) === 0) {
        const step = new SolutionStep("NAKED_SINGLE");
        step.addValue(value);
        step.addIndex(index);
        return step;
      }
    }
    return null;
  }
  /** The next Hidden Single in the grid (removed from the queue). */
  findHiddenSingle() {
    const free = this.sudoku.free;
    const hsQueue = this.sudoku.hsQueue;
    let queueIndex;
    while ((queueIndex = hsQueue.getSingle()) !== -1) {
      const index = hsQueue.getIndex(queueIndex);
      const value = hsQueue.getValue(queueIndex);
      if (this.sudoku.getValue(index) === 0) {
        for (const constr of CONSTRAINTS[index]) {
          if (free[constr][value] === 1) {
            const step = new SolutionStep("HIDDEN_SINGLE");
            step.addValue(value);
            step.addIndex(index);
            return step;
          }
        }
        return null;
      }
    }
    return null;
  }
  /**
   * The next Naked Subset of size `anz`. If `lockedOnly` is true only Locked
   * Subsets are found and Naked Subsets are cached. If the step number has
   * not changed since the last call, the cache is searched first.
   */
  findNakedXle(anz, lockedOnly) {
    this.steps = [];
    if (this.cachedSteps.length > 0 && this.cachedStepsNumber === this.finder.getStepNumber()) {
      let type = "NAKED_PAIR";
      if (anz === 2 && lockedOnly) type = "LOCKED_PAIR";
      if (anz === 3 && !lockedOnly) type = "NAKED_TRIPLE";
      if (anz === 3 && lockedOnly) type = "LOCKED_TRIPLE";
      if (anz === 4) type = "NAKED_QUADRUPLE";
      for (const step2 of this.cachedSteps) {
        if (step2.type === type) return step2;
      }
    }
    this.cachedSteps = [];
    this.cachedStepsNumber = this.finder.getStepNumber();
    let step = this.findNakedXleInEntity(BLOCKS, anz, lockedOnly, !lockedOnly, true);
    if (step !== null || lockedOnly) return step;
    step = this.findNakedXleInEntity(LINES, anz, lockedOnly, !lockedOnly, true);
    if (step !== null) return step;
    return this.findNakedXleInEntity(COLS, anz, lockedOnly, !lockedOnly, true);
  }
  /**
   * Searches for Naked Subsets in a group of units. Uses nested loops instead
   * of recursion, like the original.
   */
  findNakedXleInEntity(indices, anz, lockedOnly, nakedOnly, onlyOne) {
    const tmp = this.tmpArr1;
    for (let entity = 0; entity < indices.length; entity++) {
      let maxIndex = 0;
      for (let i = 0; i < indices[entity].length; i++) {
        const tmpAnz = ANZ_VALUES[this.sudoku.getCell(indices[entity][i])];
        if (tmpAnz !== 0 && tmpAnz <= anz) tmp[maxIndex++] = indices[entity][i];
      }
      if (maxIndex < anz) continue;
      for (let i1 = 0; i1 < maxIndex - anz + 1; i1++) {
        const cell1 = this.sudoku.getCell(tmp[i1]);
        for (let i2 = i1 + 1; i2 < maxIndex - anz + 2; i2++) {
          const cell2 = cell1 | this.sudoku.getCell(tmp[i2]);
          if (ANZ_VALUES[cell2] > anz) continue;
          if (anz === 2) {
            if (ANZ_VALUES[cell2] === anz) {
              const step = this.createSubsetStep([tmp[i1], tmp[i2]], cell2, "NAKED_PAIR", lockedOnly, nakedOnly);
              if (step !== null && onlyOne) return step;
            }
          } else {
            for (let i3 = i2 + 1; i3 < maxIndex - anz + 3; i3++) {
              const cell3 = cell2 | this.sudoku.getCell(tmp[i3]);
              if (ANZ_VALUES[cell3] > anz) continue;
              if (anz === 3) {
                if (ANZ_VALUES[cell3] === anz) {
                  const step = this.createSubsetStep(
                    [tmp[i1], tmp[i2], tmp[i3]],
                    cell3,
                    "NAKED_TRIPLE",
                    lockedOnly,
                    nakedOnly
                  );
                  if (step !== null && onlyOne) return step;
                }
              } else {
                for (let i4 = i3 + 1; i4 < maxIndex; i4++) {
                  const cell4 = cell3 | this.sudoku.getCell(tmp[i4]);
                  if (ANZ_VALUES[cell4] > anz) continue;
                  if (ANZ_VALUES[cell4] === anz) {
                    const step = this.createSubsetStep(
                      [tmp[i1], tmp[i2], tmp[i3], tmp[i4]],
                      cell4,
                      "NAKED_QUADRUPLE",
                      lockedOnly,
                      nakedOnly
                    );
                    if (step !== null && onlyOne) return step;
                  }
                }
              }
            }
          }
        }
      }
    }
    return null;
  }
  /** The next Hidden Subset with size `anz` (blocks first, then lines, then columns). */
  findHiddenXle(anz) {
    this.steps = [];
    return this.findHiddenXleInEntity(2 * UNITS, BLOCKS, anz, true) ?? this.findHiddenXleInEntity(0, LINES, anz, true) ?? this.findHiddenXleInEntity(UNITS, COLS, anz, true);
  }
  findHiddenXleInEntity(constraintBase, indices, anz, onlyOne) {
    const ipcMask = this.ipcMask;
    for (let entity = 0; entity < indices.length; entity++) {
      let maxIndex = 0;
      for (let i = 0; i < indices[entity].length; i++) {
        if (this.sudoku.getCell(indices[entity][i]) !== 0) maxIndex++;
      }
      if (maxIndex <= anz) continue;
      let candMask = 0;
      const free = this.sudoku.free;
      for (let i = 1; i <= 9; i++) {
        const actFree = free[constraintBase + entity][i];
        if (actFree !== 0 && actFree <= anz) {
          candMask |= MASKS[i];
          ipcMask[i] = 0;
          for (let j = 0; j < UNITS; j++) {
            if ((this.sudoku.getCell(indices[entity][j]) & MASKS[i]) !== 0) ipcMask[i] |= MASKS[j + 1];
          }
        }
      }
      if (ANZ_VALUES[candMask] < anz) continue;
      const candArr = POSSIBLE_VALUES[candMask];
      const unit = indices[entity];
      for (let i1 = 0; i1 < candArr.length - anz + 1; i1++) {
        const cand1 = MASKS[candArr[i1]];
        const cell1 = ipcMask[candArr[i1]];
        for (let i2 = i1 + 1; i2 < candArr.length - anz + 2; i2++) {
          const cand2 = cand1 | MASKS[candArr[i2]];
          const cell2 = cell1 | ipcMask[candArr[i2]];
          if (anz === 2) {
            if (ANZ_VALUES[cell2] === anz) {
              const t = POSSIBLE_VALUES[cell2];
              const step = this.createSubsetStep(
                [unit[t[0] - 1], unit[t[1] - 1]],
                cand2,
                "HIDDEN_PAIR",
                onlyOne,
                onlyOne
              );
              if (step !== null && onlyOne) return step;
            }
          } else {
            for (let i3 = i2 + 1; i3 < candArr.length - anz + 3; i3++) {
              const cand3 = cand2 | MASKS[candArr[i3]];
              const cell3 = cell2 | ipcMask[candArr[i3]];
              if (anz === 3) {
                if (ANZ_VALUES[cell3] === anz) {
                  const t = POSSIBLE_VALUES[cell3];
                  const step = this.createSubsetStep(
                    [unit[t[0] - 1], unit[t[1] - 1], unit[t[2] - 1]],
                    cand3,
                    "HIDDEN_TRIPLE",
                    onlyOne,
                    onlyOne
                  );
                  if (step !== null && onlyOne) return step;
                }
              } else {
                for (let i4 = i3 + 1; i4 < candArr.length; i4++) {
                  const cand4 = cand3 | MASKS[candArr[i4]];
                  const cell4 = cell3 | ipcMask[candArr[i4]];
                  if (ANZ_VALUES[cell4] === anz) {
                    const t = POSSIBLE_VALUES[cell4];
                    const step = this.createSubsetStep(
                      [unit[t[0] - 1], unit[t[1] - 1], unit[t[2] - 1], unit[t[3] - 1]],
                      cand4,
                      "HIDDEN_QUADRUPLE",
                      onlyOne,
                      onlyOne
                    );
                    if (step !== null && onlyOne) return step;
                  }
                }
              }
            }
          }
        }
      }
    }
    return null;
  }
  /** The next Locked Candidates step. Type 1 (pointing) is searched first. */
  findLockedCandidates(type) {
    this.steps = [];
    if (type === "LOCKED_CANDIDATES" || type === "LOCKED_CANDIDATES_1") {
      const step = this.findLockedCandidatesInEntityN(18, BLOCKS);
      if (step !== null) return step;
    }
    if (type === "LOCKED_CANDIDATES" || type === "LOCKED_CANDIDATES_2") {
      return this.findLockedCandidatesInEntityN(0, LINES) ?? this.findLockedCandidatesInEntityN(9, COLS);
    }
    return null;
  }
  /**
   * A Locked Candidates move is present if a candidate occurs exactly 2 or 3
   * times in a unit, all instances share another unit and that other unit
   * has additional candidates. With `constraintBase == 18` (search in blocks)
   * Type 1 is possible, otherwise Type 2.
   */
  findLockedCandidatesInEntityN(constraintBase, indices) {
    const free = this.sudoku.free;
    const sameConstraint = this.sameConstraint;
    const constraint = this.constraint;
    for (let constr = 0; constr < UNITS; constr++) {
      for (let cand = 1; cand <= 9; cand++) {
        const unitFree = free[constr + constraintBase][cand];
        if (unitFree !== 2 && unitFree !== 3) continue;
        let first = true;
        sameConstraint[0] = sameConstraint[1] = sameConstraint[2] = true;
        for (let i = 0; i < indices[constr].length; i++) {
          const index = indices[constr][i];
          if ((this.sudoku.getCell(index) & MASKS[cand]) === 0) continue;
          if (first) {
            constraint[0] = CONSTRAINTS[index][0];
            constraint[1] = CONSTRAINTS[index][1];
            constraint[2] = CONSTRAINTS[index][2];
            first = false;
          } else {
            for (let j = 0; j < 3; j++) {
              if (sameConstraint[j] && constraint[j] !== CONSTRAINTS[index][j]) sameConstraint[j] = false;
            }
          }
        }
        const skipConstraint = constraintBase + constr;
        if (constraintBase === 18) {
          let aktConstraint;
          if (sameConstraint[0] && free[constraint[0]][cand] > unitFree) aktConstraint = constraint[0];
          else if (sameConstraint[1] && free[constraint[1]][cand] > unitFree) aktConstraint = constraint[1];
          else continue;
          return this.createLockedCandidatesStep(
            "LOCKED_CANDIDATES_1",
            cand,
            skipConstraint,
            ALL_UNITS[aktConstraint]
          );
        }
        if (sameConstraint[2] && free[constraint[2]][cand] > unitFree) {
          return this.createLockedCandidatesStep("LOCKED_CANDIDATES_2", cand, skipConstraint, ALL_UNITS[constraint[2]]);
        }
      }
    }
    return null;
  }
  /**
   * A Locked Candidates step for `cand`. All candidates to delete are in the
   * unit `indices`; cells that belong to `skipConstraint` are part of the
   * pattern itself and are kept.
   */
  createLockedCandidatesStep(type, cand, skipConstraint, indices) {
    const step = new SolutionStep(type);
    step.addValue(cand);
    step.entity = CONSTRAINT_TYPE_FROM_CONSTRAINT[skipConstraint];
    step.entityNumber = CONSTRAINT_NUMBER_FROM_CONSTRAINT[skipConstraint];
    for (const index of indices) {
      if ((this.sudoku.getCell(index) & MASKS[cand]) !== 0) {
        const c = CONSTRAINTS[index];
        if (c[0] === skipConstraint || c[1] === skipConstraint || c[2] === skipConstraint) {
          step.addIndex(index);
        } else {
          step.addCandidateToDelete(index, cand);
        }
      }
    }
    return step;
  }
  /**
   * Check the subset in `indices` for eliminations and, if there are any,
   * create the step. Handles Naked and Hidden subsets (by `type`).
   *
   * For Naked subsets all candidates in `cands` are deleted from the other
   * cells of all common units; for Hidden subsets all candidates except
   * `cands` are deleted from the cells in `indices`.
   *
   * If `lockedOnly` or `nakedHiddenOnly` is set the search is for one step
   * only; a step of the wrong kind (Locked instead of Naked or vice versa)
   * is cached. If neither is set the step is added to `steps`.
   */
  createSubsetStep(indices, cands, type, lockedOnly, nakedHiddenOnly) {
    const step = new SolutionStep(type);
    const sameConstraint = this.sameConstraint;
    const constraint = this.constraint;
    sameConstraint[0] = sameConstraint[1] = sameConstraint[2] = true;
    constraint[0] = CONSTRAINTS[indices[0]][0];
    constraint[1] = CONSTRAINTS[indices[0]][1];
    constraint[2] = CONSTRAINTS[indices[0]][2];
    for (let i = 1; i < indices.length; i++) {
      for (let j = 0; j < 3; j++) {
        if (sameConstraint[j] && constraint[j] !== CONSTRAINTS[indices[i]][j]) sameConstraint[j] = false;
      }
    }
    let anzFoundConstraints = 0;
    if (isHiddenSubset(type)) {
      for (const idx of indices) {
        const candsToDelete = this.sudoku.getCell(idx) & ~cands;
        if (candsToDelete === 0) continue;
        for (const c of POSSIBLE_VALUES[candsToDelete]) step.addCandidateToDelete(idx, c);
      }
    } else {
      const foundConstraint = this.foundConstraint;
      foundConstraint[0] = foundConstraint[1] = foundConstraint[2] = false;
      for (let i = 0; i < sameConstraint.length; i++) {
        if (!sameConstraint[i]) continue;
        const cells = ALL_UNITS[constraint[i]];
        for (const cell of cells) {
          if (indices.includes(cell)) continue;
          const candsToDelete = this.sudoku.getCell(cell) & cands;
          if (candsToDelete === 0) continue;
          for (const c of POSSIBLE_VALUES[candsToDelete]) {
            step.addCandidateToDelete(cell, c);
            if (!foundConstraint[i] && (i === 2 || CONSTRAINTS[cell][2] !== constraint[2])) {
              foundConstraint[i] = true;
              anzFoundConstraints++;
            }
          }
        }
      }
    }
    if (step.getAnzCandidatesToDelete() === 0) return null;
    const isLocked = indices.length < 4 && anzFoundConstraints > 1 && !isHiddenSubset(type) && (sameConstraint[2] && sameConstraint[0] || sameConstraint[2] && sameConstraint[1]);
    if (isLocked) {
      if (type === "NAKED_PAIR") step.type = "LOCKED_PAIR";
      if (type === "NAKED_TRIPLE") step.type = "LOCKED_TRIPLE";
    }
    for (const idx of indices) step.addIndex(idx);
    for (const c of POSSIBLE_VALUES[cands]) step.addValue(c);
    let result = step;
    if (lockedOnly && !nakedHiddenOnly) {
      if (!isLocked) {
        this.cachedSteps.push(step);
        result = null;
      }
    } else if (nakedHiddenOnly && !lockedOnly) {
      if (isLocked) {
        this.cachedSteps.push(step);
        result = null;
      }
    } else if (!lockedOnly && !nakedHiddenOnly) {
      this.steps.push(step);
    }
    return result;
  }
};

// ../core/src/solver/singleDigitPatternSolver.ts
var ER_OFFSETS = [
  [0, 1, 9, 10],
  [0, 2, 9, 11],
  [1, 2, 10, 11],
  [0, 1, 18, 19],
  [0, 2, 18, 20],
  [1, 2, 19, 20],
  [9, 10, 18, 19],
  [9, 11, 18, 20],
  [10, 11, 19, 20]
];
var ER_LINE_OFFSETS = [2, 2, 2, 1, 1, 1, 0, 0, 0];
var ER_COL_OFFSETS = [2, 1, 0, 2, 1, 0, 2, 1, 0];
var ER_SETS = [];
var ER_LINES = [];
var ER_COLS = [];
{
  let indexOffset = 0;
  let lineOffset = 0;
  let colOffset = 0;
  for (let i = 0; i < BLOCKS.length; i++) {
    ER_SETS[i] = ER_OFFSETS.map((offsets) => SudokuSet.fromValues(offsets.map((o) => o + indexOffset)));
    ER_LINES[i] = ER_LINE_OFFSETS.map((o) => o + lineOffset);
    ER_COLS[i] = ER_COL_OFFSETS.map((o) => o + colOffset);
    indexOffset += 3;
    colOffset += 3;
    if (i % 3 === 2) {
      indexOffset += 18;
      lineOffset += 3;
      colOffset = 0;
    }
  }
}
var SingleDigitPatternSolver = class extends AbstractSolver {
  blockCands = new SudokuSet();
  tmpSet = new SudokuSet();
  /** For all units with exactly two candidates the indices of the two cells. */
  only2Indices = Array.from({ length: 2 * UNITS }, () => [0, 0]);
  firstUnit = new SudokuSet();
  constructor(finder) {
    super(finder);
  }
  getStep(type) {
    this.sudoku = this.finder.getSudoku();
    switch (type) {
      case "SKYSCRAPER":
        return this.findSkyscraper(true, true) ?? this.findSkyscraper(false, true);
      case "TWO_STRING_KITE":
        this.requireNoDuals();
        return this.findTwoStringKite();
      case "EMPTY_RECTANGLE":
        this.requireNoDuals();
        return this.findEmptyRectangles();
      default:
        return null;
    }
  }
  doStep(step) {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case "SKYSCRAPER":
      case "TWO_STRING_KITE":
      case "DUAL_TWO_STRING_KITE":
      case "EMPTY_RECTANGLE":
      case "DUAL_EMPTY_RECTANGLE":
        for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        return true;
      default:
        return false;
    }
  }
  requireNoDuals() {
    if (this.finder.options.allowDualsAndSiamese) {
      throw new Error("allowDualsAndSiamese is not supported yet");
    }
  }
  /**
   * Empty Rectangle: a block in which a candidate is confined to one line and
   * one column (the "ER"), plus a conjugate pair in another line/column that
   * points into the ER. Candidates are searched in ascending order.
   */
  findEmptyRectangles() {
    for (let cand = 1; cand <= 9; cand++) {
      const step = this.findEmptyRectanglesForCandidate(cand);
      if (step !== null) return step;
    }
    return null;
  }
  /**
   * Try all blocks: for every block check whether all the cells in ER_SETS[block][i]
   * lack the candidate. If so, neither the ER line nor the ER column may be empty
   * (without the crossing point) and at least one of them has to hold at least
   * two candidates. Then look for a conjugate pair that eliminates something.
   */
  findEmptyRectanglesForCandidate(cand) {
    const free = this.sudoku.free;
    const blockCands = this.blockCands;
    const tmpSet = this.tmpSet;
    for (let i = 0; i < BLOCK_TEMPLATES.length; i++) {
      if (free[18 + i][cand] < 2 || free[18 + i][cand] > 5) continue;
      blockCands.set(this.finder.getCandidates()[cand]);
      blockCands.and(BLOCK_TEMPLATES[i]);
      for (let j = 0; j < ER_SETS[i].length; j++) {
        let notEnoughCandidates = true;
        tmpSet.setAnd(blockCands, ER_SETS[i][j]);
        if (!tmpSet.isEmpty()) continue;
        tmpSet.setAnd(blockCands, LINE_TEMPLATES[ER_LINES[i][j]]);
        if (tmpSet.size() >= 2) notEnoughCandidates = false;
        tmpSet.andNot(COL_TEMPLATES[ER_COLS[i][j]]);
        if (tmpSet.isEmpty()) continue;
        const erLine = ER_LINES[i][j];
        tmpSet.setAnd(blockCands, COL_TEMPLATES[ER_COLS[i][j]]);
        if (tmpSet.size() >= 2) notEnoughCandidates = false;
        tmpSet.andNot(LINE_TEMPLATES[ER_LINES[i][j]]);
        if (tmpSet.isEmpty()) continue;
        const erCol = ER_COLS[i][j];
        if (notEnoughCandidates && !this.finder.options.allowErsWithOnlyTwoCandidates) {
          continue;
        }
        let step = this.checkEmptyRectangle(cand, i, blockCands, LINES[erLine], LINE_TEMPLATES, COL_TEMPLATES, erCol, false);
        if (step !== null) return step;
        step = this.checkEmptyRectangle(cand, i, blockCands, COLS[erCol], COL_TEMPLATES, LINE_TEMPLATES, erLine, true);
        if (step !== null) return step;
      }
    }
    return null;
  }
  /**
   * Possible eliminations for a given ER. The parameter names fit a conjugate
   * pair search in the columns; for lines all line/column parameters are
   * exchanged (`lineColReversed`).
   *
   * Looks for a conjugate pair in a column where one of the candidates is in
   * `indices`. If so, the candidates in the line of the pair's second cell are
   * checked: one that lies in column `firstCol` can be eliminated.
   */
  checkEmptyRectangle(cand, block, blockCands, indices, lineTemplates, colTemplates, firstCol, lineColReversed) {
    const tmpSet = this.tmpSet;
    const candidates = this.finder.getCandidates();
    for (const index of indices) {
      if (this.sudoku.getValue(index) !== 0) continue;
      if (getBlock(index) === block) continue;
      if (!this.sudoku.isCandidate(index, cand)) continue;
      tmpSet.set(candidates[cand]);
      const actCol = lineColReversed ? getLine(index) : getCol(index);
      tmpSet.and(colTemplates[actCol]);
      if (tmpSet.size() !== 2) continue;
      let index2 = tmpSet.get(0);
      if (index2 === index) index2 = tmpSet.get(1);
      const actLine = lineColReversed ? getCol(index2) : getLine(index2);
      tmpSet.set(candidates[cand]);
      tmpSet.and(lineTemplates[actLine]);
      for (let j = 0; j < tmpSet.size(); j++) {
        const indexDel = tmpSet.get(j);
        if (getBlock(indexDel) === block) continue;
        const colDel = lineColReversed ? getLine(indexDel) : getCol(indexDel);
        if (colDel === firstCol) {
          const step = new SolutionStep("EMPTY_RECTANGLE");
          step.entity = 0;
          step.entityNumber = block + 1;
          step.addValue(cand);
          step.addIndex(index);
          step.addIndex(index2);
          for (const k of blockCands) step.addFin(k, cand);
          step.addCandidateToDelete(indexDel, cand);
          return step;
        }
      }
    }
    return null;
  }
  /**
   * Skyscraper in the lines (`lines`) or the columns. Two calls are needed to
   * get all possible steps: two units with exactly two candidates each,
   * one end of each in the same column (row), the free ends not in the same
   * unit (that would be an X-Wing), and a candidate seen by both free ends.
   */
  findSkyscraper(lines, onlyOne) {
    const cStart = lines ? 0 : 9;
    const cEnd = lines ? 9 : 18;
    const free = this.sudoku.free;
    const only2Indices = this.only2Indices;
    for (let cand = 1; cand <= 9; cand++) {
      let constrCount = 0;
      for (let constr = cStart; constr < cEnd; constr++) {
        if (free[constr][cand] === 2) {
          let candIndex = 0;
          for (const idx of ALL_UNITS[constr]) {
            if (this.sudoku.isCandidate(idx, cand)) {
              only2Indices[constrCount][candIndex++] = idx;
              if (candIndex >= 2) break;
            }
          }
          constrCount++;
        }
      }
      for (let i = 0; i < constrCount; i++) {
        for (let j = i + 1; j < constrCount; j++) {
          const sameUnit = lines ? getCol : getLine;
          let found = false;
          let otherIndex = 1;
          if (sameUnit(only2Indices[i][0]) === sameUnit(only2Indices[j][0])) {
            found = true;
          }
          if (!found && sameUnit(only2Indices[i][1]) === sameUnit(only2Indices[j][1])) {
            found = true;
            otherIndex = 0;
          }
          if (!found) continue;
          if (sameUnit(only2Indices[i][otherIndex]) === sameUnit(only2Indices[j][otherIndex])) continue;
          this.firstUnit.setAnd(this.finder.getCandidates()[cand], BUDDIES[only2Indices[i][otherIndex]]);
          this.firstUnit.and(BUDDIES[only2Indices[j][otherIndex]]);
          if (this.firstUnit.isEmpty()) continue;
          const step = new SolutionStep("SKYSCRAPER");
          step.addValue(cand);
          if (otherIndex === 0) {
            step.addIndex(only2Indices[i][0]);
            step.addIndex(only2Indices[j][0]);
            step.addIndex(only2Indices[i][1]);
            step.addIndex(only2Indices[j][1]);
          } else {
            step.addIndex(only2Indices[i][1]);
            step.addIndex(only2Indices[j][1]);
            step.addIndex(only2Indices[i][0]);
            step.addIndex(only2Indices[j][0]);
          }
          for (const k of this.firstUnit) step.addCandidateToDelete(k, cand);
          if (onlyOne) return step;
        }
      }
    }
    return null;
  }
  /**
   * 2-String Kite: a strong link in a line and one in a column, connected by a
   * block; a candidate that sees both free ends can be eliminated. The
   * `only2Indices` rows are swapped in place while searching, exactly like in
   * the original (later combinations see the swapped order).
   */
  findTwoStringKite() {
    const free = this.sudoku.free;
    const only2Indices = this.only2Indices;
    for (let cand = 1; cand <= 9; cand++) {
      let constr1Count = 0;
      let constr2Count = 0;
      for (let constr = 0; constr < 18; constr++) {
        if (free[constr][cand] === 2) {
          let candIndex = 0;
          for (const idx of ALL_UNITS[constr]) {
            if (this.sudoku.isCandidate(idx, cand)) {
              only2Indices[constr1Count + constr2Count][candIndex++] = idx;
              if (candIndex >= 2) break;
            }
          }
          if (constr < 9) constr1Count++;
          else constr2Count++;
        }
      }
      for (let i = 0; i < constr1Count; i++) {
        for (let j = constr1Count; j < constr1Count + constr2Count; j++) {
          const a = only2Indices[i];
          const b = only2Indices[j];
          if (getBlock(a[0]) === getBlock(b[0])) {
          } else if (getBlock(a[0]) === getBlock(b[1])) {
            [b[0], b[1]] = [b[1], b[0]];
          } else if (getBlock(a[1]) === getBlock(b[0])) {
            [a[0], a[1]] = [a[1], a[0]];
          } else if (getBlock(a[1]) === getBlock(b[1])) {
            [b[0], b[1]] = [b[1], b[0]];
            [a[0], a[1]] = [a[1], a[0]];
          } else {
            continue;
          }
          if (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]) continue;
          const crossIndex = getIndex(getLine(b[1]), getCol(a[1]));
          if (this.sudoku.isCandidate(crossIndex, cand)) {
            const step = new SolutionStep("TWO_STRING_KITE");
            step.addValue(cand);
            step.addIndex(a[1]);
            step.addIndex(b[1]);
            step.addIndex(a[0]);
            step.addIndex(b[0]);
            step.addCandidateToDelete(crossIndex, cand);
            step.addFin(a[0], cand);
            step.addFin(b[0], cand);
            return step;
          }
        }
      }
    }
    return null;
  }
};

// ../core/src/solver/groupNode.ts
var GroupNode = class _GroupNode {
  /** the cells of the node */
  indices = new SudokuSet();
  /** all cells that see all cells in the group node */
  buddies = new SudokuSet();
  /** the candidate of the grouped link */
  cand;
  /** the line of the cells, or -1 */
  line = -1;
  /** the column of the cells, or -1 */
  col = -1;
  /** the block of the cells */
  block;
  index1;
  index2;
  /** index of the third cell, or -1 if the node has only two cells */
  index3 = -1;
  constructor(cand, indices) {
    this.cand = cand;
    this.indices.set(indices);
    this.index1 = indices.get(0);
    this.index2 = indices.get(1);
    if (indices.size() > 2) this.index3 = indices.get(2);
    this.block = getBlock(this.index1);
    if (getLine(this.index1) === getLine(this.index2)) this.line = getLine(this.index1);
    if (getCol(this.index1) === getCol(this.index2)) this.col = getCol(this.index1);
    this.buddies.set(BUDDIES[this.index1]);
    this.buddies.and(BUDDIES[this.index2]);
    if (this.index3 >= 0) this.buddies.and(BUDDIES[this.index3]);
  }
  /** All group nodes of the grid: first those in lines, then those in columns. */
  static getGroupNodes(candidates) {
    const groupNodes = [];
    _GroupNode.getForHouseType(groupNodes, candidates, LINE_TEMPLATES);
    _GroupNode.getForHouseType(groupNodes, candidates, COL_TEMPLATES);
    return groupNodes;
  }
  static getForHouseType(groupNodes, candidates, houses) {
    const candInHouse = new SudokuSet();
    const tmpSet = new SudokuSet();
    for (const house of houses) {
      for (let cand = 1; cand <= 9; cand++) {
        candInHouse.set(house);
        candInHouse.and(candidates[cand]);
        if (candInHouse.isEmpty()) continue;
        for (const block of BLOCK_TEMPLATES) {
          tmpSet.set(candInHouse);
          tmpSet.and(block);
          if (tmpSet.size() >= 2) groupNodes.push(new _GroupNode(cand, tmpSet));
        }
      }
    }
  }
};

// ../core/src/solver/tableEntry.ts
var MAX_TABLE_ENTRY_LENGTH = 1e3;
var TableEntry = class _TableEntry {
  /** Index of the next free entry. */
  index = 0;
  /** The conclusions (Chain entry format). Synchronized with the ret index arrays. */
  entries;
  // the five predecessor indices, the distance and the flags of every entry
  r1;
  r2;
  r3;
  r4;
  r5;
  dist;
  flags;
  static EXPANDED = 1;
  static ON_TABLE = 2;
  static EXTENDED_TABLE = 4;
  /** All cells for every candidate that can be set as a result of the premise. */
  onSets = Array.from({ length: 10 }, () => new SudokuSet());
  /** All cells for every candidate that can be eliminated as a result of the premise. */
  offSets = Array.from({ length: 10 }, () => new SudokuSet());
  /** Reverse lookup: the index in `entries` for every entry. */
  indices = /* @__PURE__ */ new Map();
  constructor(length = MAX_TABLE_ENTRY_LENGTH) {
    this.entries = new Int32Array(length);
    this.r1 = new Int16Array(length);
    this.r2 = new Int16Array(length);
    this.r3 = new Int16Array(length);
    this.r4 = new Int16Array(length);
    this.r5 = new Int16Array(length);
    this.dist = new Int16Array(length);
    this.flags = new Uint8Array(length);
  }
  /** Clears the whole table. Unused entries are always zero, so only the used part is cleared. */
  reset() {
    const n = this.index;
    this.entries.fill(0, 0, n);
    this.r1.fill(0, 0, n);
    this.r2.fill(0, 0, n);
    this.r3.fill(0, 0, n);
    this.r4.fill(0, 0, n);
    this.r5.fill(0, 0, n);
    this.dist.fill(0, 0, n);
    this.flags.fill(0, 0, n);
    this.index = 0;
    this.indices.clear();
    for (let i = 0; i < this.onSets.length; i++) {
      this.onSets[i].clear();
      this.offSets[i].clear();
    }
  }
  /** Add an entry for a single cell. */
  addEntry(cellIndex, cand, set, reverseIndex = 0, penalty = 0) {
    this.addEntryFull(cellIndex, -1, -1, NORMAL_NODE, cand, set, reverseIndex, 0, 0, 0, 0, penalty);
  }
  addEntryFull(cellIndex1, cellIndex2, cellIndex3, nodeType, cand, set, ri1, ri2, ri3, ri4, ri5, penalty) {
    if (this.index >= this.entries.length) return;
    if (nodeType === NORMAL_NODE) {
      if (set && this.onSets[cand].contains(cellIndex1) || !set && this.offSets[cand].contains(cellIndex1)) {
        return;
      }
    }
    const entry = Chain.makeSEntryFull(cellIndex1, cellIndex2, cellIndex3, cand, set, nodeType);
    const index = this.index;
    this.entries[index] = entry;
    this.setRetIndex(index, ri1, ri2, ri3, ri4, ri5);
    if (ri1 < this.entries.length) this.setDistance(index, this.getDistance(ri1) + 1);
    if (nodeType === NORMAL_NODE) {
      if (set) this.onSets[cand].add(cellIndex1);
      else this.offSets[cand].add(cellIndex1);
    }
    this.setDistance(index, this.getDistance(index) + penalty);
    this.indices.set(entry, index);
    this.index++;
  }
  getEntryIndexOf(cellIndex, set, cand) {
    return this.indices.get(Chain.makeSEntry(cellIndex, cand, set)) ?? 0;
  }
  getEntryIndex(entry) {
    const ret = this.indices.get(entry);
    if (ret === void 0) throw new Error(`TableEntry: no index for entry ${entry}`);
    return ret;
  }
  isFull() {
    return this.index === this.entries.length;
  }
  getCellIndex(index) {
    return Chain.getSCellIndex(this.entries[index]);
  }
  isStrong(index) {
    return Chain.isSStrong(this.entries[index]);
  }
  getCandidate(index) {
    return Chain.getSCandidate(this.entries[index]);
  }
  getNodeType(index) {
    return Chain.getSNodeType(this.entries[index]);
  }
  /**
   * Set the predecessor indices of an entry (this clears distance and flags, like assigning
   * a freshly built ret index in the original). The largest index always goes first, so that the
   * shortest chain becomes the "main" chain in nets.
   */
  setRetIndex(index, i1, i2, i3, i4, i5) {
    let t;
    if (i1 > 4096) i1 = 0;
    if (i2 > 1023) i2 = 0;
    if (i3 > 1023) i3 = 0;
    if (i4 > 1023) i4 = 0;
    if (i5 > 1023) i5 = 0;
    if (i2 > i1) {
      t = i2;
      i2 = i1;
      i1 = t;
    }
    if (i3 > i1) {
      t = i3;
      i3 = i1;
      i1 = t;
    }
    if (i4 > i1) {
      t = i4;
      i4 = i1;
      i1 = t;
    }
    if (i5 > i1) {
      t = i5;
      i5 = i1;
      i1 = t;
    }
    this.r1[index] = i1;
    this.r2[index] = i2;
    this.r3[index] = i3;
    this.r4[index] = i4;
    this.r5[index] = i5;
    this.dist[index] = 0;
    this.flags[index] = 0;
  }
  /** The `which`-th (0-4) predecessor index of an entry. */
  getRetIndex(index, which) {
    switch (which) {
      case 0:
        return this.r1[index];
      case 1:
        return this.r2[index];
      case 2:
        return this.r3[index];
      case 3:
        return this.r4[index];
      default:
        return this.r5[index];
    }
  }
  setDistance(index, distance) {
    this.dist[index] = distance & 511;
  }
  getDistance(index) {
    return this.dist[index];
  }
  isExpanded(index) {
    return (this.flags[index] & _TableEntry.EXPANDED) !== 0;
  }
  setExpanded(index) {
    this.flags[index] |= _TableEntry.EXPANDED;
  }
  isOnTable(index) {
    return (this.flags[index] & _TableEntry.ON_TABLE) !== 0;
  }
  setOnTable(index) {
    this.flags[index] |= _TableEntry.ON_TABLE;
  }
  isExtendedTable(index) {
    return (this.flags[index] & _TableEntry.EXTENDED_TABLE) !== 0;
  }
  setExtendedTable(index) {
    this.flags[index] |= _TableEntry.EXTENDED_TABLE;
  }
};

// ../core/src/solver/tablingSolver.ts
function compareTablingSteps(o1, o2) {
  if (o1.indices.length > 0 && o2.indices.length === 0) return -1;
  if (o1.indices.length === 0 && o2.indices.length > 0) return 1;
  if (o1.indices.length > 0) {
    let result = o2.indices.length - o1.indices.length;
    if (result !== 0) return result;
    if (!o1.isEquivalent(o2)) {
      const sum1 = sum2(o1.indices);
      const sum22 = sum2(o2.indices);
      return sum1 === sum22 ? 1 : sum1 - sum22;
    }
    result = o1.getChainLength() - o2.getChainLength();
    if (result !== 0) return result;
  } else {
    let result = o2.candidatesToDelete.length - o1.candidatesToDelete.length;
    if (result !== 0) return result;
    if (!o1.isEquivalent(o2)) {
      result = o1.compareCandidatesToDelete(o2);
      if (result !== 0) return result;
    }
    result = o1.getChainLength() - o2.getChainLength();
    if (result !== 0) return result;
  }
  return 0;
}
function sum2(list) {
  return list.reduce((a, b) => a + b, 0);
}
var TablingSolver = class extends AbstractSolver {
  steps = [];
  /** the step that is being assembled */
  globalStep = new SolutionStep("HIDDEN_SINGLE");
  /** all chains found so far: eliminations -> index in `steps` */
  deletesMap = /* @__PURE__ */ new Map();
  /** search only for chains, not for nets */
  chainsOnly = true;
  /** include group nodes in the search */
  withGroupNodes = false;
  /** accept steps only if they contain group nodes */
  onlyGroupedNiceLoops = false;
  /** one table per premise, index cell * 10 + candidate: "candidate set in cell" */
  onTable = [];
  /** "candidate deleted from cell" */
  offTable = [];
  entryList = [];
  tmpSet = new SudokuSet();
  tmpSet1 = new SudokuSet();
  tmpSet2 = new SudokuSet();
  /** for building chains: all cells of the chain */
  tmpSetC = new SudokuSet();
  tmpOnSets = Array.from({ length: 10 }, () => new SudokuSet());
  tmpOffSets = Array.from({ length: 10 }, () => new SudokuSet());
  /** the sudoku in its initial state (for building the tables of nets) */
  savedSudoku;
  retIndices = [0, 0, 0, 0, 0];
  groupNodes = [];
  simpleFinder = null;
  chain = new Array(MAX_TABLE_ENTRY_LENGTH).fill(0);
  chainIndex = 0;
  /** chains for networks */
  mins = Array.from({ length: 200 }, () => new Array(MAX_TABLE_ENTRY_LENGTH).fill(0));
  minIndexes = new Array(200).fill(0);
  actMin = 0;
  tmpChain = new Array(MAX_TABLE_ENTRY_LENGTH).fill(0);
  tmpChains = Array.from(
    { length: 9 },
    () => new Chain(0, 0, new Array(MAX_TABLE_ENTRY_LENGTH).fill(0))
  );
  tmpChainsIndex = 0;
  /** for addChain: all cells of the chain */
  lassoSet = new SudokuSet();
  extendedTable = [];
  /** entry -> index in the extended table */
  extendedTableMap = /* @__PURE__ */ new Map();
  extendedTableIndex = 0;
  initialized = false;
  constructor(finder) {
    super(finder);
  }
  /** Late initialization of the memory intensive tables. */
  initialize() {
    if (this.initialized) return;
    this.onTable = Array.from({ length: 810 }, () => new TableEntry());
    this.offTable = Array.from({ length: 810 }, () => new TableEntry());
    this.extendedTable = [];
    this.extendedTableMap.clear();
    this.extendedTableIndex = 0;
    this.initialized = true;
  }
  resetTmpChains() {
    for (const c of this.tmpChains) {
      c.start = 0;
      c.end = 0;
      c.resetLength();
    }
    this.tmpChainsIndex = 0;
  }
  /** Start a new global step of the given type. */
  newStep(type) {
    this.globalStep = new SolutionStep(type);
    return this.globalStep;
  }
  checkAlsOption() {
    if (this.finder.options.allowAlsInTablingChains) {
      throw new Error("allowAlsInTablingChains is not supported yet");
    }
  }
  getStep(type) {
    this.sudoku = this.finder.getSudoku();
    this.checkAlsOption();
    switch (type) {
      case "NICE_LOOP":
      case "CONTINUOUS_NICE_LOOP":
      case "DISCONTINUOUS_NICE_LOOP":
      case "AIC":
        this.withGroupNodes = false;
        return this.getNiceLoops();
      case "GROUPED_NICE_LOOP":
      case "GROUPED_CONTINUOUS_NICE_LOOP":
      case "GROUPED_DISCONTINUOUS_NICE_LOOP":
      case "GROUPED_AIC":
        this.withGroupNodes = true;
        return this.getNiceLoops();
      case "FORCING_CHAIN":
      case "FORCING_CHAIN_CONTRADICTION":
      case "FORCING_CHAIN_VERITY":
        this.steps = [];
        this.withGroupNodes = true;
        this.initialize();
        this.chainsOnly = true;
        this.doGetForcingChains();
        if (this.steps.length > 0) {
          this.steps.sort(compareTablingSteps);
          return this.steps[0];
        }
        return null;
      case "FORCING_NET":
      case "FORCING_NET_CONTRADICTION":
      case "FORCING_NET_VERITY":
        this.steps = [];
        this.withGroupNodes = true;
        this.initialize();
        this.chainsOnly = false;
        this.doGetForcingChains();
        if (this.steps.length > 0) {
          this.steps.sort(compareTablingSteps);
          return this.steps[0];
        }
        return null;
      default:
        return null;
    }
  }
  doStep(step) {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case "NICE_LOOP":
      case "CONTINUOUS_NICE_LOOP":
      case "DISCONTINUOUS_NICE_LOOP":
      case "AIC":
      case "GROUPED_NICE_LOOP":
      case "GROUPED_CONTINUOUS_NICE_LOOP":
      case "GROUPED_DISCONTINUOUS_NICE_LOOP":
      case "GROUPED_AIC":
        for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        return true;
      case "FORCING_CHAIN":
      case "FORCING_CHAIN_CONTRADICTION":
      case "FORCING_CHAIN_VERITY":
      case "FORCING_NET":
      case "FORCING_NET_CONTRADICTION":
      case "FORCING_NET_VERITY":
        if (step.values.length > 0) {
          for (let i = 0; i < step.values.length; i++) this.sudoku.setCell(step.indices[i], step.values[i]);
        } else {
          for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        }
        return true;
      default:
        return false;
    }
  }
  /** The shortest Nice Loop / AIC in the grid. */
  getNiceLoops() {
    this.initialize();
    this.steps = [];
    this.doGetNiceLoops();
    if (this.steps.length > 0) {
      this.steps.sort((a, b) => a.compareTo(b));
      return this.steps[0];
    }
    return null;
  }
  /** The search for all types of Nice Loops and AICs. */
  doGetNiceLoops() {
    this.deletesMap.clear();
    this.chainsOnly = true;
    this.fillTables();
    if (this.withGroupNodes) this.fillTablesWithGroupNodes();
    this.expandTables(this.onTable);
    this.expandTables(this.offTable);
    this.checkNiceLoops(this.onTable);
    this.checkNiceLoops(this.offTable);
    this.checkAics(this.offTable);
  }
  doGetForcingChains() {
    this.deletesMap.clear();
    this.fillTables();
    if (this.withGroupNodes) this.fillTablesWithGroupNodes();
    this.expandTables(this.onTable);
    this.expandTables(this.offTable);
    this.checkForcingChains();
  }
  checkForcingChains() {
    for (let i = 0; i < this.onTable.length; i++) {
      this.checkOneChain(this.onTable[i]);
      this.checkOneChain(this.offTable[i]);
    }
    for (let i = 0; i < this.onTable.length; i++) {
      this.checkTwoChains(this.onTable[i], this.offTable[i]);
    }
    this.checkAllChainsForHouse(null);
    this.checkAllChainsForHouse(LINE_TEMPLATES);
    this.checkAllChainsForHouse(COL_TEMPLATES);
    this.checkAllChainsForHouse(BLOCK_TEMPLATES);
  }
  /**
   * Check all chains for every unsolved cell (all candidates of the cell; `houseSets == null`) or for
   * every candidate in every house.
   */
  checkAllChainsForHouse(houseSets) {
    const sudoku = this.sudoku;
    if (houseSets === null) {
      for (let i = 0; i < LENGTH; i++) {
        if (sudoku.getValue(i) !== 0) continue;
        this.entryList.length = 0;
        for (const cand of sudoku.getAllCandidates(i)) this.entryList.push(this.onTable[i * 10 + cand]);
        this.checkEntryList(this.entryList);
      }
    } else {
      const candidates = this.finder.getCandidates();
      for (const house of houseSets) {
        for (let j = 1; j < candidates.length; j++) {
          this.tmpSet.set(house);
          this.tmpSet.and(candidates[j]);
          if (!this.tmpSet.isEmpty()) {
            this.entryList.length = 0;
            for (const k of this.tmpSet) this.entryList.push(this.onTable[k * 10 + j]);
            this.checkEntryList(this.entryList);
          }
        }
      }
    }
  }
  /**
   * All chains in the list start at the candidates of one cell, or all places of one candidate in a
   * house: if they all lead to the same value in a cell, or the same elimination, that is a verity.
   */
  checkEntryList(entryList) {
    for (let i = 0; i < entryList.length; i++) {
      const entry = entryList[i];
      for (let j = 1; j < this.tmpOnSets.length; j++) {
        if (i === 0) {
          this.tmpOnSets[j].set(entry.onSets[j]);
          this.tmpOffSets[j].set(entry.offSets[j]);
        } else {
          this.tmpOnSets[j].and(entry.onSets[j]);
          this.tmpOffSets[j].and(entry.offSets[j]);
        }
      }
    }
    for (let j = 1; j < this.tmpOnSets.length; j++) {
      if (!this.tmpOnSets[j].isEmpty()) {
        for (const cell of [...this.tmpOnSets[j]]) {
          const step = this.newStep("FORCING_CHAIN_VERITY");
          step.addIndex(cell);
          step.addValue(j);
          this.resetTmpChains();
          for (const e of entryList) this.addChain(e, cell, j, true);
          this.replaceOrCopyStep();
        }
      }
      if (!this.tmpOffSets[j].isEmpty()) {
        for (const cell of [...this.tmpOffSets[j]]) {
          const step = this.newStep("FORCING_CHAIN_VERITY");
          step.addCandidateToDelete(cell, j);
          this.resetTmpChains();
          for (const e of entryList) this.addChain(e, cell, j, false);
          this.replaceOrCopyStep();
        }
      }
    }
  }
  /** If a step contains a net, FORCING_CHAIN_x becomes FORCING_NET_x. */
  adjustType(step) {
    if (step.isNet()) {
      if (step.type === "FORCING_CHAIN_CONTRADICTION") step.type = "FORCING_NET_CONTRADICTION";
      if (step.type === "FORCING_CHAIN_VERITY") step.type = "FORCING_NET_VERITY";
    }
  }
  /**
   * Overwrite the content of `dest` with the content of `src` (both are the same step, but `src`
   * has the shorter chain).
   */
  replaceStep(src, dest) {
    this.adjustType(src);
    dest.type = src.type;
    if (src.indices.length > 0) {
      for (let i2 = 0; i2 < src.indices.length; i2++) {
        dest.indices[i2] = src.indices[i2];
        dest.values[i2] = src.values[i2];
      }
    } else {
      for (let i2 = 0; i2 < src.candidatesToDelete.length; i2++) dest.candidatesToDelete[i2] = src.candidatesToDelete[i2];
    }
    if (src.alses.length > 0) dest.alses = src.alses.map((a) => ({ indices: a.indices.slice(), candidates: a.candidates }));
    dest.endoFins = src.endoFins.slice();
    dest.entity = src.entity;
    dest.entityNumber = src.entityNumber;
    let i = 0;
    for (i = 0; i < src.chains.length; i++) {
      const localTmpChain = src.chains[i];
      const toShort = dest.chains.length > i && dest.chains[i].chain.length < localTmpChain.end + 1;
      if (i >= dest.chains.length || toShort) {
        const tmp = localTmpChain.chain.slice(0, localTmpChain.end + 1);
        if (toShort) {
          const destChain = dest.chains[i];
          destChain.chain = tmp;
          destChain.start = localTmpChain.start;
          destChain.end = localTmpChain.end;
          destChain.resetLength();
        } else {
          dest.addChain(0, localTmpChain.end, tmp);
        }
      } else {
        const destChain = dest.chains[i];
        for (let j = 0; j <= localTmpChain.end; j++) destChain.chain[j] = localTmpChain.chain[j];
        destChain.start = localTmpChain.start;
        destChain.end = localTmpChain.end;
        destChain.resetLength();
      }
    }
    dest.chains.length = Math.min(dest.chains.length, i);
  }
  /**
   * Store `globalStep` in `steps`: if a step for the same eliminations (or cells) exists already it is
   * replaced if the new chain is shorter.
   */
  replaceOrCopyStep() {
    const step = this.globalStep;
    this.adjustType(step);
    if (!this.chainsOnly && (step.type === "FORCING_CHAIN_CONTRADICTION" || step.type === "FORCING_CHAIN_VERITY")) {
      return;
    }
    let del = null;
    if (this.finder.options.onlyOneChainPerStep) {
      del = step.candidatesToDelete.length > 0 ? step.getCandidateKey(true) : step.getSingleCandidateKey();
      const oldIndex = this.deletesMap.get(del);
      const actStep = oldIndex !== void 0 ? this.steps[oldIndex] : null;
      if (actStep) {
        if (actStep.getChainLength() > step.getChainLength()) this.replaceStep(step, actStep);
        return;
      }
    }
    const chainAnz = step.chains.length;
    step.chains = [];
    for (let i = 0; i < chainAnz; i++) step.chains.push(this.tmpChains[i].clone());
    this.steps.push(step.clone());
    if (del !== null) this.deletesMap.set(del, this.steps.length - 1);
  }
  checkTwoChains(on, off) {
    if (on.index === 0 || off.index === 0) return;
    for (let i = 1; i < on.onSets.length; i++) {
      this.tmpSet.set(on.onSets[i]);
      this.tmpSet.and(off.onSets[i]);
      this.tmpSet.remove(on.getCellIndex(0));
      if (!this.tmpSet.isEmpty()) {
        for (const cell of [...this.tmpSet]) {
          const step = this.newStep("FORCING_CHAIN_VERITY");
          step.addIndex(cell);
          step.addValue(i);
          this.resetTmpChains();
          this.addChain(on, cell, i, true);
          this.addChain(off, cell, i, true);
          this.replaceOrCopyStep();
        }
      }
    }
    for (let i = 1; i < on.offSets.length; i++) {
      this.tmpSet.set(on.offSets[i]);
      this.tmpSet.and(off.offSets[i]);
      this.tmpSet.remove(on.getCellIndex(0));
      if (!this.tmpSet.isEmpty()) {
        for (const cell of [...this.tmpSet]) {
          const step = this.newStep("FORCING_CHAIN_VERITY");
          step.addCandidateToDelete(cell, i);
          this.resetTmpChains();
          this.addChain(on, cell, i, false);
          this.addChain(off, cell, i, false);
          this.replaceOrCopyStep();
        }
      }
    }
  }
  /** Start a contradiction step for a premise: the premise is wrong, so do the opposite. */
  newContradictionStep(entry, entity, entityNumber) {
    const step = this.newStep("FORCING_CHAIN_CONTRADICTION");
    if (entry.isStrong(0)) {
      step.addCandidateToDelete(entry.getCellIndex(0), entry.getCandidate(0));
    } else {
      step.addIndex(entry.getCellIndex(0));
      step.addValue(entry.getCandidate(0));
    }
    step.entity = entity;
    step.entityNumber = entityNumber;
    return step;
  }
  checkOneChain(entry) {
    if (entry.index === 0) return;
    const sudoku = this.sudoku;
    const candidates = this.finder.getCandidates();
    if (entry.isStrong(0) && entry.offSets[entry.getCandidate(0)].contains(entry.getCellIndex(0)) || !entry.isStrong(0) && entry.onSets[entry.getCandidate(0)].contains(entry.getCellIndex(0))) {
      this.newContradictionStep(entry, CELL, this.tmpSet.isEmpty() ? 0 : this.tmpSet.get(0));
      this.resetTmpChains();
      this.addChain(entry, entry.getCellIndex(0), entry.getCandidate(0), !entry.isStrong(0));
      this.replaceOrCopyStep();
    }
    for (let i = 0; i < entry.onSets.length; i++) {
      this.tmpSet.set(entry.onSets[i]);
      this.tmpSet.and(entry.offSets[i]);
      if (!this.tmpSet.isEmpty()) {
        this.newContradictionStep(entry, CELL, this.tmpSet.get(0));
        this.resetTmpChains();
        this.addChain(entry, this.tmpSet.get(0), i, false);
        this.addChain(entry, this.tmpSet.get(0), i, true);
        this.replaceOrCopyStep();
      }
    }
    for (let i = 1; i < entry.onSets.length; i++) {
      for (let j = i + 1; j < entry.onSets.length; j++) {
        this.tmpSet.set(entry.onSets[i]);
        this.tmpSet.and(entry.onSets[j]);
        if (!this.tmpSet.isEmpty()) {
          this.newContradictionStep(entry, CELL, this.tmpSet.get(0));
          this.resetTmpChains();
          this.addChain(entry, this.tmpSet.get(0), i, true);
          this.addChain(entry, this.tmpSet.get(0), j, true);
          this.replaceOrCopyStep();
        }
      }
    }
    this.checkHouseSet(entry, LINE_TEMPLATES, LINE);
    this.checkHouseSet(entry, COL_TEMPLATES, COL);
    this.checkHouseSet(entry, BLOCK_TEMPLATES, BLOCK);
    this.tmpSet.setAll();
    for (let i = 1; i < entry.offSets.length; i++) {
      this.tmpSet1.set(entry.offSets[i]);
      this.tmpSet1.orNot(candidates[i]);
      this.tmpSet.and(this.tmpSet1);
    }
    for (let i = 0; i < entry.onSets.length; i++) this.tmpSet.andNot(entry.onSets[i]);
    this.tmpSet2.clear();
    const positions = this.finder.getPositions();
    for (let i = 1; i < positions.length; i++) this.tmpSet2.or(positions[i]);
    this.tmpSet.andNot(this.tmpSet2);
    if (!this.tmpSet.isEmpty()) {
      for (const cell of [...this.tmpSet]) {
        this.newContradictionStep(entry, CELL, cell);
        this.resetTmpChains();
        for (const cand of sudoku.getAllCandidates(cell)) this.addChain(entry, cell, cand, false);
        this.replaceOrCopyStep();
      }
    }
    this.checkHouseDel(entry, LINE_TEMPLATES, LINE);
    this.checkHouseDel(entry, COL_TEMPLATES, COL);
    this.checkHouseDel(entry, BLOCK_TEMPLATES, BLOCK);
  }
  checkHouseDel(entry, houseSets, entityTyp) {
    const allowed = this.finder.getCandidatesAllowed();
    for (let i = 1; i < entry.offSets.length; i++) {
      for (let j = 0; j < houseSets.length; j++) {
        this.tmpSet.set(houseSets[j]);
        this.tmpSet.and(allowed[i]);
        if (!this.tmpSet.isEmpty() && entry.offSets[i].containsSet(this.tmpSet)) {
          this.newContradictionStep(entry, entityTyp, j);
          this.resetTmpChains();
          for (const k of [...this.tmpSet]) this.addChain(entry, k, i, false);
          this.replaceOrCopyStep();
        }
      }
    }
  }
  checkHouseSet(entry, houseSets, entityTyp) {
    for (let i = 1; i < entry.onSets.length; i++) {
      for (let j = 0; j < houseSets.length; j++) {
        this.tmpSet.setAnd(houseSets[j], entry.onSets[i]);
        if (this.tmpSet.size() > 1) {
          this.newContradictionStep(entry, entityTyp, j);
          this.resetTmpChains();
          for (const k of [...this.tmpSet]) this.addChain(entry, k, i, true);
          this.replaceOrCopyStep();
        }
      }
    }
  }
  /** Loops: an entry in a table that links back to the cell the table starts in. */
  checkNiceLoops(tables) {
    for (const table of tables) {
      const startIndex = table.getCellIndex(0);
      for (let j = 1; j < table.index; j++) {
        if (table.getNodeType(j) === NORMAL_NODE && table.getCellIndex(j) === startIndex) {
          this.checkNiceLoop(table, j);
        }
      }
    }
  }
  /** AICs: a strong entry whose end points can eliminate something. */
  checkAics(tables) {
    const candidates = this.finder.getCandidates();
    for (const table of tables) {
      const startIndex = table.getCellIndex(0);
      const startCandidate = table.getCandidate(0);
      const buddies = BUDDIES[startIndex];
      for (let j = 1; j < table.index; j++) {
        if (table.getNodeType(j) !== NORMAL_NODE || !table.isStrong(j) || table.getCellIndex(j) === startIndex) continue;
        if (startCandidate === table.getCandidate(j)) {
          this.tmpSet.set(buddies);
          this.tmpSet.and(BUDDIES[table.getCellIndex(j)]);
          this.tmpSet.and(candidates[startCandidate]);
          if (!this.tmpSet.isEmpty() && this.tmpSet.size() >= 2) this.checkAic(table, j);
        } else {
          if (!buddies.contains(table.getCellIndex(j))) continue;
          if (this.sudoku.isCandidate(table.getCellIndex(j), startCandidate) && this.sudoku.isCandidate(startIndex, table.getCandidate(j))) {
            this.checkAic(table, j);
          }
        }
      }
    }
  }
  checkNiceLoop(entry, entryIndex) {
    const sudoku = this.sudoku;
    if (entry.getDistance(entryIndex) <= 2) return;
    const step = this.newStep("DISCONTINUOUS_NICE_LOOP");
    this.resetTmpChains();
    this.addChain(entry, entry.getCellIndex(entryIndex), entry.getCandidate(entryIndex), entry.isStrong(entryIndex), true);
    if (step.chains.length === 0) return;
    const localTmpChain = step.chains[0];
    if (localTmpChain.getCellIndex(0) === localTmpChain.getCellIndex(1)) return;
    const nlChain = localTmpChain.chain;
    const nlChainIndex = localTmpChain.end;
    const nlChainLength = localTmpChain.getLength();
    const firstLinkStrong = entry.isStrong(1);
    const lastLinkStrong = entry.isStrong(entryIndex);
    const startCandidate = entry.getCandidate(0);
    const endCandidate = entry.getCandidate(entryIndex);
    const startIndex = entry.getCellIndex(0);
    if (!firstLinkStrong && !lastLinkStrong && startCandidate === endCandidate) {
      step.addCandidateToDelete(startIndex, startCandidate);
    } else if (firstLinkStrong && lastLinkStrong && startCandidate === endCandidate) {
      for (const c of sudoku.getAllCandidates(startIndex)) {
        if (c !== startCandidate) step.addCandidateToDelete(startIndex, c);
      }
    } else if (firstLinkStrong !== lastLinkStrong && startCandidate !== endCandidate) {
      step.addCandidateToDelete(startIndex, !firstLinkStrong ? startCandidate : endCandidate);
    } else if (!firstLinkStrong && !lastLinkStrong && sudoku.getAnzCandidates(startIndex) === 2 && startCandidate !== endCandidate || firstLinkStrong && lastLinkStrong && startCandidate !== endCandidate || firstLinkStrong !== lastLinkStrong && startCandidate === endCandidate) {
      step.type = "CONTINUOUS_NICE_LOOP";
      for (let i = 0; i <= nlChainIndex; i++) {
        if (i === 0 && firstLinkStrong && lastLinkStrong || i > 0 && Chain.isSStrong(nlChain[i]) && i <= nlChainIndex - 2 && Chain.getSCellIndex(nlChain[i - 1]) !== Chain.getSCellIndex(nlChain[i])) {
          if (i === 0 || !Chain.isSStrong(nlChain[i + 1]) && Chain.getSCellIndex(nlChain[i]) === Chain.getSCellIndex(nlChain[i + 1]) && Chain.isSStrong(nlChain[i + 2]) && Chain.getSCellIndex(nlChain[i + 1]) !== Chain.getSCellIndex(nlChain[i + 2])) {
            let c1 = Chain.getSCandidate(nlChain[i]);
            let c2 = Chain.getSCandidate(nlChain[i + 2]);
            if (i === 0) {
              c1 = startCandidate;
              c2 = endCandidate;
            }
            for (const c of sudoku.getAllCandidates(Chain.getSCellIndex(nlChain[i]))) {
              if (c !== c1 && c !== c2) step.addCandidateToDelete(Chain.getSCellIndex(nlChain[i]), c);
            }
          }
        }
        if (i > 0 && !Chain.isSStrong(nlChain[i]) && Chain.getSCellIndex(nlChain[i - 1]) !== Chain.getSCellIndex(nlChain[i])) {
          const actCand = Chain.getSCandidate(nlChain[i]);
          Chain.getSNodeBuddies(nlChain[i - 1], this.tmpSet);
          Chain.getSNodeBuddies(nlChain[i], this.tmpSet1);
          this.tmpSet.and(this.tmpSet1);
          this.tmpSet.andNot(this.tmpSetC);
          this.tmpSet.remove(startIndex);
          this.tmpSet.and(this.finder.getCandidates()[actCand]);
          if (!this.tmpSet.isEmpty()) {
            for (const j of this.tmpSet) step.addCandidateToDelete(j, actCand);
          }
        }
      }
    }
    if (step.candidatesToDelete.length > 0) {
      let grouped = false;
      let newChain = step.chains[0];
      for (let i = newChain.start; i <= newChain.end; i++) {
        if (Chain.getSNodeType(newChain.chain[i]) !== NORMAL_NODE) {
          grouped = true;
          break;
        }
      }
      if (grouped) {
        if (step.type === "DISCONTINUOUS_NICE_LOOP") step.type = "GROUPED_DISCONTINUOUS_NICE_LOOP";
        if (step.type === "CONTINUOUS_NICE_LOOP") step.type = "GROUPED_CONTINUOUS_NICE_LOOP";
        if (step.type === "AIC") step.type = "GROUPED_AIC";
      }
      if (this.onlyGroupedNiceLoops && !grouped) return;
      const del = step.getCandidateKey(true);
      const oldIndex = this.deletesMap.get(del);
      if (oldIndex !== void 0 && this.steps[oldIndex].getChainLength() <= nlChainLength) return;
      this.deletesMap.set(del, this.steps.length);
      newChain = step.chains[0].clone();
      step.chains = [newChain];
      this.steps.push(step.clone());
    }
  }
  /** AIC between the start of the table and a strong entry. */
  checkAic(entry, entryIndex) {
    const sudoku = this.sudoku;
    if (entry.getDistance(entryIndex) <= 2) return;
    const step = this.newStep("AIC");
    const startCandidate = entry.getCandidate(0);
    const endCandidate = entry.getCandidate(entryIndex);
    const startIndex = entry.getCellIndex(0);
    const endIndex = entry.getCellIndex(entryIndex);
    if (startCandidate === endCandidate) {
      this.tmpSet.set(BUDDIES[startIndex]);
      this.tmpSet.and(BUDDIES[endIndex]);
      this.tmpSet.and(this.finder.getCandidates()[startCandidate]);
      if (this.tmpSet.size() > 1) {
        for (const c of this.tmpSet) {
          if (c !== startIndex) step.addCandidateToDelete(c, startCandidate);
        }
      }
    } else {
      if (sudoku.isCandidate(startIndex, endCandidate)) step.addCandidateToDelete(startIndex, endCandidate);
      if (sudoku.isCandidate(endIndex, startCandidate)) step.addCandidateToDelete(endIndex, startCandidate);
    }
    if (step.getAnzCandidatesToDelete() === 0) return;
    this.resetTmpChains();
    this.addChain(entry, entry.getCellIndex(entryIndex), entry.getCandidate(entryIndex), entry.isStrong(entryIndex), false, true);
    if (step.chains.length === 0) return;
    let grouped = false;
    let newChain = step.chains[0];
    for (let i = newChain.start; i <= newChain.end; i++) {
      if (Chain.getSNodeType(newChain.chain[i]) !== NORMAL_NODE) {
        grouped = true;
        break;
      }
    }
    if (grouped && step.type === "AIC") step.type = "GROUPED_AIC";
    if (this.onlyGroupedNiceLoops && !grouped) return;
    const del = step.getCandidateKey(true);
    const oldIndex = this.deletesMap.get(del);
    if (oldIndex !== void 0 && this.steps[oldIndex].getChainLength() <= step.chains[0].getLength()) return;
    this.deletesMap.set(del, this.steps.length);
    newChain = step.chains[0].clone();
    step.chains = [newChain];
    this.steps.push(step.clone());
  }
  /**
   * Fill the tables. For chains only the direct consequences of a premise are entered; for nets
   * (`chainsOnly == false`) every premise is played through with singles (look-ahead).
   */
  fillTables() {
    const sudoku = this.sudoku;
    for (let i = 0; i < this.onTable.length; i++) {
      this.onTable[i].reset();
      this.offTable[i].reset();
    }
    this.extendedTableMap.clear();
    this.extendedTableIndex = 0;
    if (this.chainsOnly) {
      const candidates = this.finder.getCandidates();
      for (let i = 0; i < LENGTH; i++) {
        if (sudoku.getValue(i) !== 0) continue;
        for (let cand = 1; cand <= 9; cand++) {
          if (!sudoku.isCandidate(i, cand)) continue;
          this.onTable[i * 10 + cand].addEntry(i, cand, true);
          this.offTable[i * 10 + cand].addEntry(i, cand, false);
          const cands = sudoku.getAllCandidates(i);
          for (const otherCand of cands) {
            if (otherCand === cand) continue;
            this.onTable[i * 10 + cand].addEntry(i, otherCand, false);
            if (cands.length === 2) this.offTable[i * 10 + cand].addEntry(i, otherCand, true);
          }
          this.tmpSet1.set(candidates[cand]);
          this.tmpSet1.remove(i);
          for (const constr of CONSTRAINTS[i]) {
            const anzCands = sudoku.free[constr][cand];
            if (anzCands < 2) continue;
            this.tmpSet.set(this.tmpSet1);
            this.tmpSet.and(ALL_CONSTRAINTS_TEMPLATES[constr]);
            if (this.tmpSet.isEmpty()) continue;
            for (const k of this.tmpSet) this.onTable[i * 10 + cand].addEntry(k, cand, false);
            if (anzCands === 2) this.offTable[i * 10 + cand].addEntry(this.tmpSet.get(0), cand, true);
          }
        }
      }
    } else {
      this.savedSudoku = sudoku.clone();
      this.simpleFinder = this.simpleFinder ?? new SudokuStepFinder(this.finder.options, true);
      for (let i = 0; i < LENGTH; i++) {
        if (this.savedSudoku.getValue(i) !== 0) continue;
        for (const cand of this.savedSudoku.getAllCandidates(i)) {
          sudoku.set(this.savedSudoku);
          this.getTableEntry(this.onTable[i * 10 + cand], i, cand, true);
          sudoku.set(this.savedSudoku);
          this.getTableEntry(this.offTable[i * 10 + cand], i, cand, false);
        }
      }
      sudoku.set(this.savedSudoku);
    }
  }
  /** Group nodes become entries in the extended table; the normal tables get entries for them too. */
  fillTablesWithGroupNodes() {
    const candidates = this.finder.getCandidates();
    this.groupNodes = GroupNode.getGroupNodes(candidates);
    const groupNodes = this.groupNodes;
    for (let i = 0; i < groupNodes.length; i++) {
      const gn = groupNodes[i];
      const onEntry = this.getNextExtendedTableEntry(this.extendedTableIndex);
      onEntry.addEntryFull(gn.index1, gn.index2, gn.index3, GROUP_NODE, gn.cand, true, 0, 0, 0, 0, 0, 0);
      this.extendedTableMap.set(onEntry.entries[0], this.extendedTableIndex);
      this.extendedTableIndex++;
      const offEntry = this.getNextExtendedTableEntry(this.extendedTableIndex);
      offEntry.addEntryFull(gn.index1, gn.index2, gn.index3, GROUP_NODE, gn.cand, false, 0, 0, 0, 0, 0, 0);
      this.extendedTableMap.set(offEntry.entries[0], this.extendedTableIndex);
      this.extendedTableIndex++;
      this.tmpSet.set(candidates[gn.cand]);
      this.tmpSet.and(gn.buddies);
      if (!this.tmpSet.isEmpty()) {
        for (const index of this.tmpSet) {
          onEntry.addEntry(index, gn.cand, false);
          this.onTable[index * 10 + gn.cand].addEntryFull(gn.index1, gn.index2, gn.index3, GROUP_NODE, gn.cand, false, 0, 0, 0, 0, 0, 0);
        }
        this.tmpSet1.set(this.tmpSet);
        this.tmpSet1.and(BLOCK_TEMPLATES[gn.block]);
        if (!this.tmpSet1.isEmpty() && this.tmpSet1.size() === 1) {
          offEntry.addEntry(this.tmpSet1.get(0), gn.cand, true);
          this.offTable[this.tmpSet1.get(0) * 10 + gn.cand].addEntryFull(gn.index1, gn.index2, gn.index3, GROUP_NODE, gn.cand, true, 0, 0, 0, 0, 0, 0);
        }
        this.tmpSet1.set(this.tmpSet);
        if (gn.line !== -1) this.tmpSet1.and(LINE_TEMPLATES[gn.line]);
        else this.tmpSet1.and(COL_TEMPLATES[gn.col]);
        if (!this.tmpSet1.isEmpty() && this.tmpSet1.size() === 1) {
          offEntry.addEntry(this.tmpSet1.get(0), gn.cand, true);
          this.offTable[this.tmpSet1.get(0) * 10 + gn.cand].addEntryFull(gn.index1, gn.index2, gn.index3, GROUP_NODE, gn.cand, true, 0, 0, 0, 0, 0, 0);
        }
      }
      let lineAnz = 0;
      let line1Index = -1;
      let colAnz = 0;
      let col1Index = -1;
      let blockAnz = 0;
      let block1Index = -1;
      for (let j = 0; j < groupNodes.length; j++) {
        const gn2 = groupNodes[j];
        if (j === i) continue;
        if (gn.cand !== gn2.cand) continue;
        this.tmpSet2.set(gn.indices);
        if (!this.tmpSet2.andEmpty(gn2.indices)) continue;
        if (gn.line !== -1 && gn.line === gn2.line) {
          lineAnz++;
          if (lineAnz === 1) line1Index = j;
          onEntry.addEntryFull(gn2.index1, gn2.index2, gn2.index3, GROUP_NODE, gn.cand, false, 0, 0, 0, 0, 0, 0);
        }
        if (gn.col !== -1 && gn.col === gn2.col) {
          colAnz++;
          if (colAnz === 1) col1Index = j;
          onEntry.addEntryFull(gn2.index1, gn2.index2, gn2.index3, GROUP_NODE, gn.cand, false, 0, 0, 0, 0, 0, 0);
        }
        if (gn.block === gn2.block) {
          blockAnz++;
          if (blockAnz === 1) block1Index = j;
          onEntry.addEntryFull(gn2.index1, gn2.index2, gn2.index3, GROUP_NODE, gn.cand, false, 0, 0, 0, 0, 0, 0);
        }
      }
      if (lineAnz === 1) {
        const gn2 = groupNodes[line1Index];
        this.tmpSet.set(LINE_TEMPLATES[gn.line]);
        this.tmpSet.and(candidates[gn.cand]);
        this.tmpSet.andNot(gn.indices);
        this.tmpSet.andNot(gn2.indices);
        if (this.tmpSet.isEmpty()) {
          offEntry.addEntryFull(gn2.index1, gn2.index2, gn2.index3, GROUP_NODE, gn.cand, true, 0, 0, 0, 0, 0, 0);
        }
      }
      if (colAnz === 1) {
        const gn2 = groupNodes[col1Index];
        this.tmpSet.set(COL_TEMPLATES[gn.col]);
        this.tmpSet.and(candidates[gn.cand]);
        this.tmpSet.andNot(gn.indices);
        this.tmpSet.andNot(gn2.indices);
        if (this.tmpSet.isEmpty()) {
          offEntry.addEntryFull(gn2.index1, gn2.index2, gn2.index3, GROUP_NODE, gn.cand, true, 0, 0, 0, 0, 0, 0);
        }
      }
      if (blockAnz === 1) {
        const gn2 = groupNodes[block1Index];
        this.tmpSet.set(BLOCK_TEMPLATES[gn.block]);
        this.tmpSet.and(candidates[gn.cand]);
        this.tmpSet.andNot(gn.indices);
        this.tmpSet.andNot(gn2.indices);
        if (this.tmpSet.isEmpty()) {
          offEntry.addEntryFull(gn2.index1, gn2.index2, gn2.index3, GROUP_NODE, gn.cand, true, 0, 0, 0, 0, 0, 0);
        }
      }
    }
  }
  getNextExtendedTableEntry(tableIndex) {
    if (tableIndex >= this.extendedTable.length) {
      const entry2 = new TableEntry();
      this.extendedTable.push(entry2);
      return entry2;
    }
    const entry = this.extendedTable[tableIndex];
    entry.reset();
    return entry;
  }
  /**
   * Play through a premise (nets): enter the premise, then look ahead for a number of rounds
   * and enter every naked and hidden single as a new conclusion (with the entries that caused it).
   */
  getTableEntry(entry, cellIndex, cand, set) {
    const sudoku = this.sudoku;
    const simpleFinder = this.simpleFinder;
    if (set) {
      this.setCellForTable(cellIndex, cand, entry, false, false);
    } else {
      sudoku.delCandidate(cellIndex, cand);
      entry.addEntry(cellIndex, cand, false, 0);
      if (sudoku.getAnzCandidates(cellIndex) === 1) {
        const setCand = sudoku.getAllCandidates(cellIndex)[0];
        this.setCellForTable(cellIndex, setCand, entry, false, true);
      }
    }
    for (let j = 0; j < this.finder.options.anzTableLookAhead; j++) {
      const singleSteps = [...simpleFinder.findAllNakedSingles(sudoku), ...simpleFinder.findAllHiddenSingles(sudoku)];
      for (const step of singleSteps) {
        this.setCellForTable(step.indices[0], step.values[0], entry, true, step.type === "NAKED_SINGLE");
      }
    }
  }
  /** Set a cell in the sudoku and enter the consequences in the table. */
  setCellForTable(cellIndex, cand, entry, getRetIndices, nakedSingle) {
    const sudoku = this.sudoku;
    const retIndices = this.retIndices;
    this.tmpSet.set(this.finder.getCandidates()[cand]);
    this.tmpSet.remove(cellIndex);
    this.tmpSet.and(BUDDIES[cellIndex]);
    const cands = sudoku.getAllCandidates(cellIndex);
    let entityType = LINE;
    let entityNumberFree = sudoku.free[CONSTRAINTS[cellIndex][0]][cand];
    let dummy = sudoku.free[CONSTRAINTS[cellIndex][1]][cand];
    if (dummy < entityNumberFree) {
      entityType = COL;
      entityNumberFree = dummy;
    }
    dummy = sudoku.free[CONSTRAINTS[cellIndex][2]][cand];
    if (dummy < entityNumberFree) {
      entityType = BLOCK;
      entityNumberFree = dummy;
    }
    sudoku.setCell(cellIndex, cand);
    const retIndex = entry.index;
    if (getRetIndices) {
      retIndices.fill(0);
      if (nakedSingle) {
        const cellCands = this.savedSudoku.getAllCandidates(cellIndex);
        let ri = 0;
        for (let i = 0; i < cellCands.length && ri < retIndices.length; i++) {
          if (cellCands[i] === cand) continue;
          retIndices[ri++] = entry.getEntryIndexOf(cellIndex, false, cellCands[i]);
        }
      } else if (entityType === LINE) {
        this.getRetIndicesForHouse(cellIndex, cand, LINE_TEMPLATES[Math.floor(cellIndex / 9)], entry);
      } else if (entityType === COL) {
        this.getRetIndicesForHouse(cellIndex, cand, COL_TEMPLATES[cellIndex % 9], entry);
      } else {
        this.getRetIndicesForHouse(cellIndex, cand, BLOCK_TEMPLATES[CONSTRAINTS[cellIndex][2] - 18], entry);
      }
      entry.addEntryFull(cellIndex, -1, -1, NORMAL_NODE, cand, true, retIndices[0], retIndices[1], retIndices[2], retIndices[3], retIndices[4], 0);
    } else {
      entry.addEntry(cellIndex, cand, true);
    }
    for (const k of this.tmpSet) entry.addEntry(k, cand, false, retIndex);
    for (const c of cands) {
      if (c !== cand) entry.addEntry(cellIndex, c, false, retIndex);
    }
  }
  /** The entries (deletions of the candidate in the other cells of the house) that made a hidden single. */
  getRetIndicesForHouse(cellIndex, cand, houseSet, entry) {
    this.tmpSet1.set(this.finder.getCandidates()[cand]);
    this.tmpSet1.remove(cellIndex);
    this.tmpSet1.and(houseSet);
    let ri = 0;
    for (let i = 0; i < this.tmpSet1.size() && ri < this.retIndices.length; i++) {
      this.retIndices[ri++] = entry.getEntryIndexOf(this.tmpSet1.get(i), false, cand);
    }
  }
  /**
   * Expand a table: for every outcome all outcomes from the table of that outcome are added
   * (transitive closure), keeping the shortest way to every outcome.
   */
  expandTables(table) {
    for (let i = 0; i < table.length; i++) {
      if (table[i].index === 0) continue;
      const dest = table[i];
      for (let j = 1; j < dest.entries.length; j++) {
        if (dest.entries[j] === 0) break;
        if (dest.isFull()) break;
        let src;
        let srcTableIndex = dest.getCellIndex(j) * 10 + dest.getCandidate(j);
        let isFromExtendedTable = false;
        let isFromOnTable = false;
        if (Chain.getSNodeType(dest.entries[j]) !== NORMAL_NODE) {
          const tmpSI = this.extendedTableMap.get(dest.entries[j]);
          if (tmpSI === void 0) continue;
          srcTableIndex = tmpSI;
          src = this.extendedTable[srcTableIndex];
          isFromExtendedTable = true;
        } else {
          if (dest.isStrong(j)) src = this.onTable[srcTableIndex];
          else src = this.offTable[srcTableIndex];
          isFromOnTable = dest.isStrong(j);
        }
        if (src.index === 0) continue;
        const srcBaseDistance = dest.getDistance(j);
        for (let k = 1; k < src.index; k++) {
          if (src.isExpanded(k)) continue;
          const srcDistance = src.getDistance(k);
          if (dest.indices.has(src.entries[k])) {
            const orgIndex = dest.getEntryIndex(src.entries[k]);
            if (dest.isExpanded(orgIndex) && (dest.getDistance(orgIndex) > srcBaseDistance + srcDistance || dest.getDistance(orgIndex) === srcBaseDistance + srcDistance && dest.getNodeType(orgIndex) > src.getNodeType(k))) {
              dest.setRetIndex(orgIndex, srcTableIndex, 0, 0, 0, 0);
              dest.setExpanded(orgIndex);
              if (isFromExtendedTable) dest.setExtendedTable(orgIndex);
              else if (isFromOnTable) dest.setOnTable(orgIndex);
              dest.setDistance(orgIndex, srcBaseDistance + srcDistance);
            }
          } else {
            const srcCand = src.getCandidate(k);
            const srcStrong = src.isStrong(k);
            if (Chain.getSNodeType(src.entries[k]) === NORMAL_NODE) {
              dest.addEntry(src.getCellIndex(k), srcCand, srcStrong, srcTableIndex);
            } else {
              const tmp = src.entries[k];
              dest.addEntryFull(
                Chain.getSCellIndex(tmp),
                Chain.getSCellIndex2(tmp),
                Chain.getSCellIndex3(tmp),
                Chain.getSNodeType(tmp),
                srcCand,
                srcStrong,
                srcTableIndex,
                0,
                0,
                0,
                0,
                0
              );
            }
            const last = dest.index - 1;
            dest.setExpanded(last);
            if (isFromExtendedTable) dest.setExtendedTable(last);
            else if (isFromOnTable) dest.setOnTable(last);
            dest.setDistance(last, srcBaseDistance + srcDistance);
          }
        }
      }
    }
  }
  /**
   * Build the chain that leads from the premise of `entry` to the conclusion (cell, cand, set) and
   * add it to the global step (as a chain; nets add the other chains behind separators).
   * With `isNiceLoop`/`isAic` the chain is checked for lassos.
   */
  addChain(entry, cellIndex, cand, set, isNiceLoop = false, isAic = false) {
    this.buildChain(entry, cellIndex, cand, set);
    let j = 0;
    if (isNiceLoop || isAic) {
      this.lassoSet.clear();
      if (isNiceLoop && Chain.getSCellIndex(this.chain[0]) === Chain.getSCellIndex(this.chain[1])) return;
    }
    let lastCellIndex = -1;
    let lastCellEntry = -1;
    const firstCellIndex = Chain.getSCellIndex(this.chain[this.chainIndex - 1]);
    for (let i = this.chainIndex - 1; i >= 0; i--) {
      const oldEntry = this.chain[i];
      const newCellIndex = Chain.getSCellIndex(oldEntry);
      if (isNiceLoop || isAic) {
        if (this.lassoSet.contains(newCellIndex)) return;
        if (lastCellIndex !== -1 && (lastCellIndex !== firstCellIndex || isAic)) {
          this.lassoSet.add(lastCellIndex);
          if (Chain.getSNodeType(lastCellEntry) === GROUP_NODE) {
            let tmp = Chain.getSCellIndex2(lastCellEntry);
            if (tmp !== -1) this.lassoSet.add(tmp);
            tmp = Chain.getSCellIndex3(lastCellEntry);
            if (tmp !== -1) this.lassoSet.add(tmp);
          }
        }
      }
      lastCellIndex = newCellIndex;
      lastCellEntry = oldEntry;
      this.tmpChain[j++] = oldEntry;
      for (let k = 0; k < this.actMin; k++) {
        if (this.mins[k][this.minIndexes[k] - 1] === oldEntry) {
          for (let l = this.minIndexes[k] - 2; l >= 0; l--) this.tmpChain[j++] = -this.mins[k][l];
          this.tmpChain[j++] = -2147483648;
        }
      }
    }
    if (j > 0) {
      const target = this.tmpChains[this.tmpChainsIndex];
      for (let i = 0; i < j; i++) target.chain[i] = this.tmpChain[i];
      target.start = 0;
      target.end = j - 1;
      target.resetLength();
      this.globalStep.addChainObject(target);
      this.tmpChainsIndex++;
    }
  }
  /** Build the main chain and the chains of the other predecessors (nets). */
  buildChain(entry, cellIndex, cand, set) {
    this.chainIndex = 0;
    const chainEntry = Chain.makeSEntry(cellIndex, cand, set);
    let index = -1;
    for (let i = 0; i < entry.entries.length; i++) {
      if (entry.entries[i] === chainEntry) {
        index = i;
        break;
      }
    }
    if (index === -1) return;
    this.actMin = 0;
    this.minIndexes.fill(0);
    this.tmpSetC.clear();
    this.chainIndex = this.buildChainRecursive(entry, index, this.chain, false, this.tmpSetC);
    let minIndex = 0;
    while (minIndex < this.actMin) {
      this.minIndexes[minIndex] = this.buildChainRecursive(
        entry,
        entry.getEntryIndex(this.mins[minIndex][0]),
        this.mins[minIndex],
        true,
        this.tmpSetC
      );
      minIndex++;
    }
  }
  /**
   * Follow the predecessors from an entry back to the premise. Expanded entries point into the table
   * they came from. Returns the length of the chain written to `actChain`.
   */
  buildChainRecursive(startEntry, entryIndexStart, actChain, isMin, chainSet) {
    let entry = startEntry;
    let entryIndex = entryIndexStart;
    let actChainIndex = 0;
    actChain[actChainIndex++] = entry.entries[entryIndex];
    let firstEntryIndex = entryIndex;
    let expanded = false;
    const orgEntry = entry;
    while (firstEntryIndex !== 0 && actChainIndex < actChain.length) {
      if (entry.isExpanded(firstEntryIndex)) {
        if (entry.isExtendedTable(firstEntryIndex)) entry = this.extendedTable[orgEntry.getRetIndex(firstEntryIndex, 0)];
        else if (entry.isOnTable(firstEntryIndex)) entry = this.onTable[orgEntry.getRetIndex(firstEntryIndex, 0)];
        else entry = this.offTable[orgEntry.getRetIndex(firstEntryIndex, 0)];
        expanded = true;
        firstEntryIndex = entry.getEntryIndex(orgEntry.entries[firstEntryIndex]);
      }
      const tmpEntryIndex = firstEntryIndex;
      for (let i = 0; i < 5; i++) {
        entryIndex = entry.getRetIndex(tmpEntryIndex, i);
        if (i === 0) {
          firstEntryIndex = entryIndex;
          actChain[actChainIndex++] = entry.entries[entryIndex];
          if (!isMin) {
            chainSet.add(entry.getCellIndex(entryIndex));
            if (Chain.getSNodeType(entry.entries[entryIndex]) === GROUP_NODE) {
              let tmp = Chain.getSCellIndex2(entry.entries[entryIndex]);
              if (tmp !== -1) chainSet.add(tmp);
              tmp = Chain.getSCellIndex3(entry.entries[entryIndex]);
              if (tmp !== -1) chainSet.add(tmp);
            }
          } else if (chainSet.contains(entry.getCellIndex(entryIndex))) {
            for (let j = 0; j < this.chainIndex; j++) {
              if (this.chain[j] === entry.entries[entryIndex]) return actChainIndex;
            }
          }
        } else if (entryIndex !== 0 && !isMin) {
          this.mins[this.actMin][0] = entry.entries[entryIndex];
          this.minIndexes[this.actMin++] = 1;
        }
      }
      if (expanded && firstEntryIndex === 0) {
        const retEntry = entry.entries[0];
        entry = orgEntry;
        firstEntryIndex = entry.getEntryIndex(retEntry);
        expanded = false;
      }
    }
    return actChainIndex;
  }
};

// ../core/src/solver/uniquenessSolver.ts
var UniquenessSolver = class _UniquenessSolver extends AbstractSolver {
  bugConstraints = [-1, -1, -1];
  /** All already checked rectangles: one number per rectangle built from the sorted corner indices. */
  rectangles = [];
  static MAX_RECTANGLES = 400;
  /** The indices of the current rectangle */
  indexe = [0, 0, 0, 0];
  tmpRect = [0, 0, 0, 0];
  /** The two candidates of the UR (kept between calls like in the original) */
  cand1 = 0;
  cand2 = 0;
  cachedSteps = [];
  /** finder.stepNumber under which the cached steps were found */
  stepNumber = -1;
  /** cells of the UR that hold only cand1 and/or cand2 */
  twoCandidates = new SudokuSet();
  /** cells of the UR that hold additional candidates */
  additionalCandidates = new SudokuSet();
  tmpSet = new SudokuSet();
  tmpSet1 = new SudokuSet();
  lastSearchWasUR = false;
  lastSearchWasAR = false;
  constructor(finder) {
    super(finder);
  }
  getStep(type) {
    this.sudoku = this.finder.getSudoku();
    if (this.sudoku.status !== "VALID") return null;
    switch (type) {
      case "UNIQUENESS_1":
      case "UNIQUENESS_2":
      case "UNIQUENESS_3":
      case "UNIQUENESS_4":
      case "UNIQUENESS_5":
      case "UNIQUENESS_6":
      case "HIDDEN_RECTANGLE":
        return this.getUniqueness(type);
      case "AVOIDABLE_RECTANGLE_1":
      case "AVOIDABLE_RECTANGLE_2":
        if (this.sudoku.statusGivens !== "VALID") return null;
        return this.getAvoidableRectangle(type);
      case "BUG_PLUS_1":
        return this.getBugPlus1();
      default:
        return null;
    }
  }
  doStep(step) {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case "UNIQUENESS_1":
      case "UNIQUENESS_2":
      case "UNIQUENESS_3":
      case "UNIQUENESS_4":
      case "UNIQUENESS_5":
      case "UNIQUENESS_6":
      case "HIDDEN_RECTANGLE":
      case "AVOIDABLE_RECTANGLE_1":
      case "AVOIDABLE_RECTANGLE_2":
      case "BUG_PLUS_1":
        for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        return true;
      default:
        return false;
    }
  }
  /**
   * Try to get a step of `type` from the cache. If none is available, or the
   * sudoku has changed since the last call, search again. If nothing is found
   * but the sudoku has not changed, the already checked rectangles are not
   * reset (a step in them would have been cached).
   */
  getUniqueness(type) {
    if (this.finder.getStepNumber() === this.stepNumber && this.lastSearchWasUR) {
      const cached = this.cachedSteps.find((s) => s.type === type);
      if (cached) return cached;
    } else {
      this.stepNumber = this.finder.getStepNumber();
      this.cachedSteps = [];
      this.rectangles.length = 0;
    }
    this.lastSearchWasUR = true;
    this.lastSearchWasAR = false;
    return this.getAllUniquenessInternal(type);
  }
  /** Like {@link getUniqueness}, for Avoidable Rectangles. */
  getAvoidableRectangle(type) {
    if (this.finder.getStepNumber() === this.stepNumber && this.lastSearchWasAR) {
      const cached = this.cachedSteps.find((s) => s.type === type);
      if (cached) return cached;
    } else {
      this.stepNumber = this.finder.getStepNumber();
      this.cachedSteps = [];
      this.rectangles.length = 0;
    }
    this.lastSearchWasUR = false;
    this.lastSearchWasAR = true;
    return this.getAllAvoidableRectangles(type);
  }
  /** The first Avoidable Rectangle found, starting from solved cells that are not givens. */
  getAllAvoidableRectangles(type) {
    for (let i = 0; i < LENGTH; i++) {
      if (this.sudoku.getValue(i) === 0 || this.sudoku.isFixed(i)) continue;
      this.cand1 = this.sudoku.getValue(i);
      let step = this.findUniquenessForStartCell(i, true, type);
      if (step !== null) return step;
      step = this.findUniquenessForStartCell(i, true, type);
      if (step !== null) return step;
    }
    return null;
  }
  /** All bivalue cells are starting points for a search. */
  getAllUniquenessInternal(type) {
    for (let i = 0; i < LENGTH; i++) {
      if (this.sudoku.getAnzCandidates(i) === 2) {
        const cands = this.sudoku.getAllCandidates(i);
        this.cand1 = cands[0];
        this.cand2 = cands[1];
        const step = this.findUniquenessForStartCell(i, false, type);
        if (step !== null) return step;
      }
    }
    return null;
  }
  /**
   * BUG+1: only one cell has three candidates, all others have two. All
   * candidates appear in all units exactly twice, except one of the
   * candidates in the cell with three candidates.
   */
  getBugPlus1() {
    const sudoku = this.sudoku;
    let index3 = -1;
    for (let i = 0; i < LENGTH; i++) {
      const anz = sudoku.getAnzCandidates(i);
      if (anz > 3) return null;
      if (anz === 3) {
        if (index3 !== -1) return null;
        index3 = i;
      }
    }
    if (index3 === -1) return null;
    let cand3 = -1;
    const bugConstraints = this.bugConstraints;
    bugConstraints[0] = bugConstraints[1] = bugConstraints[2] = -1;
    const free = sudoku.free;
    for (let constr = 0; constr < free.length; constr++) {
      for (let cand = 1; cand <= 9; cand++) {
        const anz = free[constr][cand];
        if (anz > 3) return null;
        if (anz === 3) {
          if (bugConstraints[Math.floor(constr / 9)] !== -1 || cand3 !== -1 && cand3 !== cand) return null;
          cand3 = cand;
          bugConstraints[Math.floor(constr / 9)] = constr;
        }
      }
    }
    if (sudoku.isCandidate(index3, cand3) && CONSTRAINTS[index3][0] === bugConstraints[0] && CONSTRAINTS[index3][1] === bugConstraints[1] && CONSTRAINTS[index3][2] === bugConstraints[2]) {
      const step = new SolutionStep("BUG_PLUS_1");
      for (const c of sudoku.getAllCandidates(index3)) {
        if (c !== cand3) step.addCandidateToDelete(index3, c);
      }
      return step;
    }
    return null;
  }
  /**
   * Starting at a cell: find a second cell in the same block (and the same line
   * or column) with the same two candidates, then the opposite two cells in
   * another block. For Avoidable Rectangles `index11`/`index12` are solved cells
   * (not givens) that designate the candidates; the opposite side needs at
   * least one unsolved cell.
   */
  findUniquenessForStartCell(index11, avoidable, type) {
    const sudoku = this.sudoku;
    const allowMissing = this.finder.options.allowUniquenessMissingCandidates;
    const line11 = getLine(index11);
    const col11 = getCol(index11);
    const block11 = getBlock(index11);
    const cell11 = sudoku.getCell(index11);
    const allowedCand1 = this.finder.getCandidatesAllowed()[this.cand1];
    const allowedCand2 = this.finder.getCandidatesAllowed()[this.cand2];
    for (const index12 of BLOCKS[block11]) {
      if (index12 === index11) continue;
      if (line11 !== getLine(index12) && col11 !== getCol(index12)) continue;
      const cell12 = sudoku.getCell(index12);
      if (!avoidable && sudoku.getValue(index12) === 0 && (!allowMissing && (cell11 & cell12) === cell11 || allowMissing && allowedCand1.contains(index12) && allowedCand2.contains(index12)) || avoidable && sudoku.getValue(index12) !== 0 && !sudoku.isFixed(index12)) {
        if (avoidable) this.cand2 = sudoku.getValue(index12);
        const isLines = line11 === getLine(index12);
        const unit11 = ALL_UNITS[isLines ? getCol(index11) + 9 : getLine(index11)];
        const unit12 = ALL_UNITS[isLines ? getCol(index12) + 9 : getLine(index12)];
        for (let j = 0; j < unit11.length; j++) {
          if (getBlock(unit11[j]) === block11) continue;
          const index21 = unit11[j];
          const index22 = unit12[j];
          const cell21 = sudoku.getCell(index21);
          const cell22 = sudoku.getCell(index22);
          const { cand1, cand2 } = this;
          if (!avoidable && !allowMissing && (cell21 & cell11) === cell11 && (cell22 & cell11) === cell11 || allowMissing && allowedCand1.contains(index21) && allowedCand1.contains(index22) && allowedCand2.contains(index22) && allowedCand2.contains(index22) || avoidable && (sudoku.getValue(index21) === cand2 && !sudoku.isFixed(index21) && sudoku.getValue(index22) === 0 && sudoku.isCandidate(index22, cand1) && sudoku.getAnzCandidates(index22) === 2 || sudoku.getValue(index22) === cand1 && !sudoku.isFixed(index22) && sudoku.getValue(index21) === 0 && sudoku.isCandidate(index21, cand2) && sudoku.getAnzCandidates(index21) === 2 || sudoku.getValue(index21) === 0 && sudoku.isCandidate(index21, cand2) && sudoku.getAnzCandidates(index21) === 2 && sudoku.getValue(index22) === 0 && sudoku.isCandidate(index22, cand1) && sudoku.getAnzCandidates(index22) === 2)) {
            if (this.checkRect(index11, index12, index21, index22)) {
              this.indexe[0] = index11;
              this.indexe[1] = index12;
              this.indexe[2] = index21;
              this.indexe[3] = index22;
              const step = avoidable ? this.checkAvoidableRectangle(index21, index22, type) : this.checkURForStep(type);
              if (step !== null) return step;
            }
          }
        }
      }
    }
    return null;
  }
  /** Use `step` as result if it is of the searched type, otherwise remember it for later. */
  offer(step, searchType) {
    if (searchType === step.type) return step;
    this.cachedSteps.push(step);
    return null;
  }
  /**
   * Check the UR in `indexe` for all UR types at once. A step of the searched
   * type is returned immediately; steps of other types are cached.
   */
  checkURForStep(searchType) {
    const sudoku = this.sudoku;
    const { cand1, cand2 } = this;
    const twoCandidates = this.twoCandidates;
    const additionalCandidates = this.additionalCandidates;
    const tmpSet = this.tmpSet;
    const tmpSet1 = this.tmpSet1;
    this.initCheck(this.indexe);
    const twoSize = twoCandidates.size();
    const urMask = MASKS[cand1] | MASKS[cand2];
    if (twoSize === 3) {
      const step = this.initStep("UNIQUENESS_1");
      const delIndex = additionalCandidates.get(0);
      if (sudoku.isCandidate(delIndex, cand1)) step.addCandidateToDelete(delIndex, cand1);
      if (sudoku.isCandidate(delIndex, cand2)) step.addCandidateToDelete(delIndex, cand2);
      if (step.candidatesToDelete.length > 0) {
        const result = this.offer(step, searchType);
        if (result !== null) return result;
      }
    }
    if (twoSize === 2 || twoSize === 1) {
      let addMask = 0;
      tmpSet.setAll();
      for (let i = 0; i < additionalCandidates.size(); i++) {
        const index3 = additionalCandidates.get(i);
        addMask |= sudoku.getCell(index3) & ~urMask;
        if (ANZ_VALUES[addMask] > 1) break;
        tmpSet.and(BUDDIES[index3]);
      }
      if (ANZ_VALUES[addMask] === 1) {
        const addCand = CAND_FROM_MASK[addMask];
        tmpSet.and(this.finder.getCandidates()[addCand]);
        if (!tmpSet.isEmpty()) {
          let type = "UNIQUENESS_2";
          const i1 = additionalCandidates.get(0);
          const i2 = additionalCandidates.get(1);
          if (additionalCandidates.size() === 3 || getLine(i1) !== getLine(i2) && getCol(i1) !== getCol(i2)) {
            type = "UNIQUENESS_5";
          }
          const step = this.initStep(type);
          for (const c of tmpSet) step.addCandidateToDelete(c, addCand);
          const result = this.offer(step, searchType);
          if (result !== null) return result;
        }
      }
    }
    if (twoSize === 2) {
      let u3Cands = 0;
      for (let i = 0; i < additionalCandidates.size(); i++) {
        u3Cands |= this.sudoku.getCell(additionalCandidates.get(i)) & ~urMask;
      }
      const i1 = additionalCandidates.get(0);
      const i2 = additionalCandidates.get(1);
      if (getLine(i1) === getLine(i2)) {
        const step = this.checkUniqueness3(LINE, LINES[getLine(i1)], u3Cands, urMask, searchType);
        if (step !== null) return step;
      }
      if (getCol(i1) === getCol(i2)) {
        const step = this.checkUniqueness3(COL, COLS[getCol(i1)], u3Cands, urMask, searchType);
        if (step !== null) return step;
      }
      if (getBlock(i1) === getBlock(i2)) {
        const step = this.checkUniqueness3(BLOCK, BLOCKS[getBlock(i1)], u3Cands, urMask, searchType);
        if (step !== null) return step;
      }
    }
    if (twoSize === 2) {
      const i1 = additionalCandidates.get(0);
      const i2 = additionalCandidates.get(1);
      if (getLine(i1) === getLine(i2) || getCol(i1) === getCol(i2)) {
        tmpSet.setAnd(BUDDIES[i1], BUDDIES[i2]);
        let delCand = -1;
        tmpSet1.setAnd(tmpSet, this.finder.getCandidates()[cand1]);
        if (tmpSet1.isEmpty()) {
          delCand = cand2;
        } else {
          tmpSet1.setAnd(tmpSet, this.finder.getCandidates()[cand2]);
          if (tmpSet1.isEmpty()) delCand = cand1;
        }
        if (delCand !== -1) {
          const step = this.initStep("UNIQUENESS_4");
          if (sudoku.isCandidate(i1, delCand)) step.addCandidateToDelete(i1, delCand);
          if (sudoku.isCandidate(i2, delCand)) step.addCandidateToDelete(i2, delCand);
          if (step.candidatesToDelete.length > 0) {
            const result = this.offer(step, searchType);
            if (result !== null) return result;
          }
        }
      }
    }
    if (twoSize === 2) {
      const i1 = additionalCandidates.get(0);
      const i2 = additionalCandidates.get(1);
      if (getLine(i1) !== getLine(i2) && getCol(i1) !== getCol(i2)) {
        tmpSet.set(LINE_TEMPLATES[getLine(i1)]);
        tmpSet.or(COL_TEMPLATES[getCol(i1)]);
        tmpSet.or(LINE_TEMPLATES[getLine(i2)]);
        tmpSet.or(COL_TEMPLATES[getCol(i2)]);
        tmpSet.andNot(additionalCandidates);
        tmpSet.andNot(twoCandidates);
        let delCand = -1;
        tmpSet1.setAnd(tmpSet, this.finder.getCandidates()[cand1]);
        if (tmpSet1.isEmpty()) {
          delCand = cand1;
        } else {
          tmpSet1.setAnd(tmpSet, this.finder.getCandidates()[cand2]);
          if (tmpSet1.isEmpty()) delCand = cand2;
        }
        if (delCand !== -1) {
          const step = this.initStep("UNIQUENESS_6");
          if (sudoku.isCandidate(i1, delCand)) step.addCandidateToDelete(i1, delCand);
          if (sudoku.isCandidate(i2, delCand)) step.addCandidateToDelete(i2, delCand);
          if (step.candidatesToDelete.length > 0) {
            const result = this.offer(step, searchType);
            if (result !== null) return result;
          }
        }
      }
    }
    if (twoSize === 2 || twoSize === 1) {
      const i1 = twoCandidates.get(0);
      const i2 = twoCandidates.get(1);
      let doCheck = true;
      if (twoSize === 2) {
        if (getLine(i1) === getLine(i2) || getCol(i1) === getCol(i2)) doCheck = false;
      }
      if (doCheck) {
        let step = this.checkHiddenRectangle(i1, searchType);
        if (step !== null) return step;
        if (twoCandidates.size() === 2) {
          step = this.checkHiddenRectangle(i2, searchType);
          if (step !== null) return step;
        }
      }
    }
    return null;
  }
  /**
   * Avoidable Rectangle: if only one of cell21/cell22 is unsolved, cand1/cand2
   * can be deleted from it. If both are unsolved, cell21 must contain cand2,
   * cell22 must contain cand1 and both need the same additional candidate;
   * that candidate can be deleted from all cells that see both.
   */
  checkAvoidableRectangle(index21, index22, type) {
    const sudoku = this.sudoku;
    const { cand1, cand2 } = this;
    if (sudoku.getValue(index21) !== 0 || sudoku.getValue(index22) !== 0) {
      const step = this.initStep("AVOIDABLE_RECTANGLE_1");
      if (sudoku.getValue(index21) !== 0) {
        if (sudoku.isCandidate(index22, cand1)) step.addCandidateToDelete(index22, cand1);
      } else if (sudoku.isCandidate(index21, cand2)) {
        step.addCandidateToDelete(index21, cand2);
      }
      if (step.candidatesToDelete.length > 0) {
        if (type === "AVOIDABLE_RECTANGLE_1") return step;
        this.cachedSteps.push(step);
      }
    } else {
      const cands = sudoku.getAllCandidates(index21);
      let additionalCand = cands[0];
      if (additionalCand === cand2) additionalCand = cands[1];
      if (!sudoku.isCandidate(index22, additionalCand)) return null;
      const tmpSet = this.tmpSet;
      tmpSet.set(BUDDIES[index21]);
      tmpSet.and(BUDDIES[index22]);
      tmpSet.and(this.finder.getCandidates()[additionalCand]);
      if (tmpSet.isEmpty()) return null;
      const step = this.initStep("AVOIDABLE_RECTANGLE_2");
      for (const c of tmpSet) step.addCandidateToDelete(c, additionalCand);
      step.addEndoFin(index21, additionalCand);
      step.addEndoFin(index22, additionalCand);
      if (type === "AVOIDABLE_RECTANGLE_2") return step;
      this.cachedSteps.push(step);
    }
    return null;
  }
  checkHiddenRectangle(cornerIndex, type) {
    const lineC = getLine(cornerIndex);
    const colC = getCol(cornerIndex);
    const i1 = this.additionalCandidates.get(0);
    const i2 = this.additionalCandidates.get(1);
    let line1 = getLine(i1);
    if (line1 === lineC) line1 = getLine(i2);
    let col1 = getCol(i1);
    if (col1 === colC) col1 = getCol(i2);
    const { cand1, cand2 } = this;
    return this.checkCandForHiddenRectangle(line1, col1, cand1, cand2, type) ?? this.checkCandForHiddenRectangle(line1, col1, cand2, cand1, type);
  }
  /**
   * In line `line` and column `col` the candidate `cand1` may appear only in the UR cells.
   * Then `cand2` can be deleted from the cell at the intersection of line and column.
   */
  checkCandForHiddenRectangle(line, col, cand1, cand2, type) {
    const { tmpSet, tmpSet1 } = this;
    tmpSet1.setOr(this.twoCandidates, this.additionalCandidates);
    tmpSet.set(this.finder.getCandidates()[cand1]);
    tmpSet.and(LINE_TEMPLATES[line]);
    tmpSet.andNot(tmpSet1);
    if (!tmpSet.isEmpty()) return null;
    tmpSet.set(this.finder.getCandidates()[cand1]);
    tmpSet.and(COL_TEMPLATES[col]);
    tmpSet.andNot(tmpSet1);
    if (!tmpSet.isEmpty()) return null;
    const delIndex = getIndex(line, col);
    const step = this.initStep("HIDDEN_RECTANGLE");
    if (this.sudoku.isCandidate(delIndex, cand2)) step.addCandidateToDelete(delIndex, cand2);
    if (step.candidatesToDelete.length > 0) return this.offer(step, type);
    return null;
  }
  /** Collect all cells to be checked for UR 3 and call the recursive check. */
  checkUniqueness3(unitType, unit, u3Cands, urMask, searchType) {
    const u3Indices = new SudokuSet();
    const tmpSet = this.tmpSet;
    tmpSet.set(this.twoCandidates);
    tmpSet.or(this.additionalCandidates);
    for (const idx of unit) {
      const cell = this.sudoku.getCell(idx);
      if (cell !== 0 && (cell & urMask) === 0 && !tmpSet.contains(idx)) u3Indices.add(idx);
    }
    if (!u3Indices.isEmpty()) {
      return this.checkUniqueness3Recursive(
        unitType,
        unit,
        u3Indices,
        u3Cands,
        new SudokuSet(this.additionalCandidates),
        0,
        searchType
      );
    }
    return null;
  }
  checkUniqueness3Recursive(type, unit, u3Indices, candsIncluded, indicesIncluded, startIndex, searchType) {
    const sudoku = this.sudoku;
    for (let i = startIndex; i < u3Indices.size(); i++) {
      let aktCands = candsIncluded;
      const aktIndices = indicesIncluded.clone();
      aktIndices.add(u3Indices.get(i));
      aktCands |= sudoku.getCell(u3Indices.get(i));
      if (type !== BLOCK || !this.isSameLineOrCol(aktIndices)) {
        if (ANZ_VALUES[aktCands] === aktIndices.size() - 1) {
          const step2 = this.initStep("UNIQUENESS_3");
          for (const u of unit) {
            if (sudoku.getValue(u) === 0 && !aktIndices.contains(u)) {
              const delCands = sudoku.getCell(u) & aktCands;
              if (ANZ_VALUES[delCands] === 0) continue;
              for (const c of POSSIBLE_VALUES[delCands]) step2.addCandidateToDelete(u, c);
            }
          }
          if (step2.candidatesToDelete.length > 0) {
            for (const cTmp of POSSIBLE_VALUES[aktCands]) {
              for (let l = 0; l < aktIndices.size(); l++) {
                if (sudoku.isCandidate(aktIndices.get(l), cTmp)) step2.addFin(aktIndices.get(l), cTmp);
              }
            }
            if (type === LINE || type === COL) {
              const block = this.getBlockForCheck3(aktIndices);
              if (block !== -1) {
                for (const u of BLOCKS[block]) {
                  if (sudoku.getValue(u) === 0 && !aktIndices.contains(u)) {
                    const delCands = sudoku.getCell(u) & aktCands;
                    if (ANZ_VALUES[delCands] === 0) continue;
                    for (const c of POSSIBLE_VALUES[delCands]) step2.addCandidateToDelete(u, c);
                  }
                }
              }
            }
            const result = this.offer(step2, searchType);
            if (result !== null) return result;
          }
        }
      }
      const step = this.checkUniqueness3Recursive(type, unit, u3Indices, aktCands, aktIndices, i + 1, searchType);
      if (step !== null) return step;
    }
    return null;
  }
  /** If all cells belong to the same block, return that block, otherwise -1. */
  getBlockForCheck3(aktIndices) {
    if (aktIndices.isEmpty()) return -1;
    const block = getBlock(aktIndices.get(0));
    for (let i = 1; i < aktIndices.size(); i++) {
      if (getBlock(aktIndices.get(i)) !== block) return -1;
    }
    return block;
  }
  /** true if all cells are in the same line or the same column. */
  isSameLineOrCol(aktIndices) {
    if (aktIndices.isEmpty()) return false;
    let sameLine = true;
    let sameCol = true;
    const line = getLine(aktIndices.get(0));
    const col = getCol(aktIndices.get(0));
    for (let i = 1; i < aktIndices.size(); i++) {
      if (getLine(aktIndices.get(i)) !== line) sameLine = false;
      if (getCol(aktIndices.get(i)) !== col) sameCol = false;
    }
    return sameLine || sameCol;
  }
  /** A new step for the current UR: values are the two UR candidates, indices the four corners. */
  initStep(type) {
    const step = new SolutionStep(type);
    step.addValue(this.cand1);
    step.addValue(this.cand2);
    for (const idx of this.indexe) step.addIndex(idx);
    return step;
  }
  /** Collect the cells that hold only cand1/cand2 and the cells with additional candidates. */
  initCheck(indices) {
    this.twoCandidates.clear();
    this.additionalCandidates.clear();
    const mask = ~(MASKS[this.cand1] | MASKS[this.cand2]);
    for (const idx of indices) {
      if ((this.sudoku.getCell(idx) & mask) === 0) this.twoCandidates.add(idx);
      else this.additionalCandidates.add(idx);
    }
  }
  /**
   * Is the UR formed by the four indices new? If the buffer for checked
   * rectangles is full, the UR is treated as if it were new.
   */
  checkRect(i11, i12, i21, i22) {
    const tmpRect = this.tmpRect;
    tmpRect[0] = i11;
    tmpRect[1] = i12;
    tmpRect[2] = i21;
    tmpRect[3] = i22;
    tmpRect.sort((a, b) => a - b);
    const rect = ((tmpRect[0] * 10 + tmpRect[1]) * 10 + tmpRect[2]) * 10 + tmpRect[3];
    if (this.rectangles.includes(rect)) return false;
    if (this.rectangles.length < _UniquenessSolver.MAX_RECTANGLES) this.rectangles.push(rect);
    return true;
  }
};

// ../core/src/solver/wingSolver.ts
var WingSolver = class extends AbstractSolver {
  preCalcSet1 = new SudokuSet();
  preCalcSet2 = new SudokuSet();
  elimSet = new SudokuSet();
  /** The indices of all bivalue cells (for XY-Wing) */
  biCells = new Array(LENGTH).fill(0);
  /** The indices of all trivalue cells (for XYZ-Wing) */
  triCells = new Array(LENGTH).fill(0);
  /** The two cells of the strong link of a W-Wing */
  wIndex1 = -1;
  wIndex2 = -1;
  constructor(finder) {
    super(finder);
  }
  getStep(type) {
    this.sudoku = this.finder.getSudoku();
    switch (type) {
      case "XY_WING":
        return this.getWing(false);
      case "XYZ_WING":
        return this.getWing(true);
      case "W_WING":
        return this.getWWing();
      default:
        return null;
    }
  }
  doStep(step) {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case "XY_WING":
      case "W_WING":
      case "XYZ_WING":
        for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        return true;
      default:
        return false;
    }
  }
  /**
   * Try all combinations of three bivalue cells (for XYZ: one trivalue and two
   * bivalue cells). The three cells must have exactly three candidates
   * together; the first cell (pivot) must see both other cells (pincers); the
   * pincers must share exactly one candidate z. z can be eliminated from all
   * cells that see both pincers (for XYZ also the pivot).
   */
  getWing(xyz) {
    const sudoku = this.sudoku;
    const biCells = this.biCells;
    const triCells = this.triCells;
    let biValueCount = 0;
    let triValueCount = 0;
    for (let i = 0; i < LENGTH; i++) {
      if (sudoku.getAnzCandidates(i) === 2) biCells[biValueCount++] = i;
      if (xyz && sudoku.getAnzCandidates(i) === 3) triCells[triValueCount++] = i;
    }
    const endIndex = xyz ? triValueCount : biValueCount;
    const biTri = xyz ? triCells : biCells;
    for (let i = 0; i < endIndex; i++) {
      for (let j = xyz ? 0 : i + 1; j < biValueCount; j++) {
        if (ANZ_VALUES[sudoku.getCell(biTri[i]) | sudoku.getCell(biCells[j])] !== 3) continue;
        for (let k = j + 1; k < biValueCount; k++) {
          let index1 = biTri[i];
          let index2 = biCells[j];
          let index3 = biCells[k];
          let cell1 = sudoku.getCell(index1);
          let cell2 = sudoku.getCell(index2);
          let cell3 = sudoku.getCell(index3);
          if (ANZ_VALUES[cell1 | cell2 | cell3] !== 3) continue;
          if (cell1 === cell2 || cell2 === cell3 || cell3 === cell1) continue;
          const maxTries2 = xyz ? 1 : 3;
          for (let tries = 0; tries < maxTries2; tries++) {
            if (tries === 1) {
              index1 = biCells[j];
              index2 = biTri[i];
              cell1 = sudoku.getCell(index1);
              cell2 = sudoku.getCell(index2);
            } else if (tries === 2) {
              index1 = biCells[k];
              index2 = biCells[j];
              index3 = biTri[i];
              cell1 = sudoku.getCell(index1);
              cell2 = sudoku.getCell(index2);
              cell3 = sudoku.getCell(index3);
            }
            if (!BUDDIES[index1].contains(index2) || !BUDDIES[index1].contains(index3)) continue;
            const cell = cell2 & cell3;
            if (ANZ_VALUES[cell] !== 1) continue;
            const candZ = CAND_FROM_MASK[cell];
            this.elimSet.setAnd(BUDDIES[index2], BUDDIES[index3]);
            this.elimSet.and(this.finder.getCandidates()[candZ]);
            if (xyz) this.elimSet.and(BUDDIES[index1]);
            if (this.elimSet.isEmpty()) continue;
            const step = new SolutionStep(xyz ? "XYZ_WING" : "XY_WING");
            const cands = sudoku.getAllCandidates(index1);
            step.addValue(cands[0]);
            step.addValue(cands[1]);
            step.addValue(xyz ? cands[2] : candZ);
            step.addIndex(index1);
            step.addIndex(index2);
            step.addIndex(index3);
            if (xyz) step.addFin(index1, candZ);
            step.addFin(index2, candZ);
            step.addFin(index3, candZ);
            for (const l of this.elimSet) step.addCandidateToDelete(l, candZ);
            return step;
          }
        }
      }
    }
    return null;
  }
  /**
   * W-Wing: two bivalue cells with the same candidates; if they could
   * eliminate something, a connecting strong link is searched for.
   */
  getWWing() {
    const sudoku = this.sudoku;
    const candidates = this.finder.getCandidates();
    for (let i = 0; i < LENGTH; i++) {
      if (sudoku.getValue(i) !== 0 || sudoku.getAnzCandidates(i) !== 2) continue;
      const cell1 = sudoku.getCell(i);
      const cand1 = sudoku.getAllCandidates(i)[0];
      const cand2 = sudoku.getAllCandidates(i)[1];
      this.preCalcSet1.setAnd(BUDDIES[i], candidates[cand1]);
      this.preCalcSet2.setAnd(BUDDIES[i], candidates[cand2]);
      for (let j = i + 1; j < LENGTH; j++) {
        if (sudoku.getCell(j) !== cell1) continue;
        this.elimSet.setAnd(this.preCalcSet1, BUDDIES[j]);
        if (!this.elimSet.isEmpty()) {
          const step = this.checkLink(cand1, cand2, i, j);
          if (step !== null) return step;
        }
        this.elimSet.setAnd(this.preCalcSet2, BUDDIES[j]);
        if (!this.elimSet.isEmpty()) {
          const step = this.checkLink(cand2, cand1, i, j);
          if (step !== null) return step;
        }
      }
    }
    return null;
  }
  /**
   * Search for a strong link for candidate `cand2` that connects `index1` and
   * `index2` (each end is seen by one of the bivalue cells).
   */
  checkLink(cand1, cand2, index1, index2) {
    const sudoku = this.sudoku;
    const free = sudoku.free;
    for (let constr = 0; constr < free.length; constr++) {
      if (free[constr][cand2] !== 2) continue;
      let sees1 = false;
      let sees2 = false;
      for (const aktIndex of ALL_UNITS[constr]) {
        if (aktIndex !== index1 && aktIndex !== index2 && sudoku.isCandidate(aktIndex, cand2)) {
          if (BUDDIES[aktIndex].contains(index1)) {
            sees1 = true;
            this.wIndex1 = aktIndex;
          } else if (BUDDIES[aktIndex].contains(index2)) {
            sees2 = true;
            this.wIndex2 = aktIndex;
          }
        }
        if (sees1 && sees2) break;
      }
      if (sees1 && sees2) {
        const step = new SolutionStep("W_WING");
        step.addValue(cand1);
        step.addValue(cand2);
        step.addIndex(index1);
        step.addIndex(index2);
        step.addFin(index1, cand2);
        step.addFin(index2, cand2);
        step.addFin(this.wIndex1, cand2);
        step.addFin(this.wIndex2, cand2);
        for (const e of this.elimSet) step.addCandidateToDelete(e, cand1);
        return step;
      }
    }
    return null;
  }
};

// ../core/src/solver/stepFinder.ts
var SudokuStepFinder = class {
  /**
   * @param simpleOnly if true the finder only has a SimpleSolver (used by the tabling solver for nets)
   */
  constructor(options = { ...DEFAULT_SOLVER_OPTIONS }, simpleOnly = false) {
    this.options = options;
    this.simpleSolver = new SimpleSolver(this);
    if (simpleOnly) {
      this.solvers = [this.simpleSolver];
      return;
    }
    this.solvers = [this.simpleSolver, new FishSolver(this), new SingleDigitPatternSolver(this), new UniquenessSolver(this), new WingSolver(this), new ColoringSolver(this), new ChainSolver(this), new AlsSolver(this), new MiscellaneousSolver(this), new TablingSolver(this), new BruteForceSolver(this), new IncompleteSolver(this), new GiveUpSolver(this)];
  }
  sudoku;
  /**
   * Incremented whenever a step is found or the sudoku changes. Solvers use it
   * to know whether data they cached is still valid.
   */
  stepNumber = 0;
  solvers;
  simpleSolver;
  // Data used by more than one solver; computed lazily, recomputed after every change.
  candidates = Array.from({ length: 10 }, () => new SudokuSet());
  candidatesDirty = true;
  positions = Array.from({ length: 10 }, () => new SudokuSet());
  positionsDirty = true;
  candidatesAllowed = Array.from({ length: 10 }, () => new SudokuSet());
  emptyCells = new SudokuSet();
  candidatesAllowedDirty = true;
  // ALS and restricted commons cache (valid for one step number)
  alsesOnlyLargerThanOne = null;
  alsesOnlyLargerThanOneStepNumber = -1;
  alsesWithOne = null;
  alsesWithOneStepNumber = -1;
  restrictedCommons = [];
  /** start/end indices into `restrictedCommons` for every ALS */
  startIndices = [];
  endIndices = [];
  lastRcAllowOverlap = false;
  lastRcStepNumber = -1;
  lastRcAlsList = null;
  lastRcOnlyForward = true;
  /** collect RCs for forward search only */
  rcOnlyForward = true;
  getSudoku() {
    return this.sudoku;
  }
  setSudoku(sudoku) {
    this.sudoku = sudoku;
    this.setSudokuDirty();
  }
  getStepNumber() {
    return this.stepNumber;
  }
  /** The sudoku has been changed: all precalculated data is invalid. */
  setSudokuDirty() {
    this.candidatesDirty = true;
    this.candidatesAllowedDirty = true;
    this.positionsDirty = true;
    this.stepNumber++;
  }
  /** For each digit 1-9 the set of cells in which it is still a candidate (index 0 unused). */
  getCandidates() {
    if (this.candidatesDirty) {
      for (let i = 1; i < 10; i++) this.candidates[i].clear();
      for (let i = 0; i < LENGTH; i++) {
        for (const cand of POSSIBLE_VALUES[this.sudoku.cells[i]]) this.candidates[cand].add(i);
      }
      this.candidatesDirty = false;
    }
    return this.candidates;
  }
  /** For each digit 1-9 the set of cells in which it is set as a value (index 0 unused). */
  getPositions() {
    if (this.positionsDirty) {
      for (let i = 1; i < 10; i++) this.positions[i].clear();
      for (let i = 0; i < LENGTH; i++) {
        const v = this.sudoku.values[i];
        if (v !== 0) this.positions[v].add(i);
      }
      this.positionsDirty = false;
    }
    return this.positions;
  }
  /** For each digit 1-9 the set of empty cells in which it is not excluded by a set value (index 0 unused). */
  getCandidatesAllowed() {
    this.initCandidatesAllowed();
    return this.candidatesAllowed;
  }
  getEmptyCells() {
    this.initCandidatesAllowed();
    return this.emptyCells;
  }
  initCandidatesAllowed() {
    if (!this.candidatesAllowedDirty) return;
    this.emptyCells.setAll();
    for (let i = 1; i < 10; i++) this.candidatesAllowed[i].setAll();
    for (let i = 0; i < LENGTH; i++) {
      const v = this.sudoku.values[i];
      if (v !== 0) {
        this.candidatesAllowed[v].andNot(BUDDIES[i]);
        this.emptyCells.remove(i);
      }
    }
    for (let i = 1; i < 10; i++) this.candidatesAllowed[i].and(this.emptyCells);
    this.candidatesAllowedDirty = false;
  }
  /** All Naked Singles of `sudoku` (without changing it). */
  findAllNakedSingles(sudoku) {
    this.setSudoku(sudoku);
    return this.simpleSolver.findAllNakedSingles();
  }
  /** All Hidden Singles of `sudoku` (without changing it). */
  findAllHiddenSingles(sudoku) {
    this.setSudoku(sudoku);
    return this.simpleSolver.findAllHiddenSingles();
  }
  /** The next step of the given type, or null. */
  getStep(type) {
    for (const solver of this.solvers) {
      const result = solver.getStep(type);
      if (result !== null) {
        this.stepNumber++;
        return result;
      }
    }
    return null;
  }
  /** Execute a step on the current sudoku. */
  doStep(step) {
    for (const solver of this.solvers) {
      if (solver.doStep(step)) {
        this.setSudokuDirty();
        return;
      }
    }
    throw new Error(`Invalid solution step in doStep() (${step.type})`);
  }
  // ---- ALS and restricted commons (cached until the sudoku changes)
  /** All ALS of the current grid. With `onlyLargerThanOne` single cells (bivalue cells) are left out. */
  getAlses(onlyLargerThanOne = false) {
    if (onlyLargerThanOne) {
      if (this.alsesOnlyLargerThanOneStepNumber !== this.stepNumber || this.alsesOnlyLargerThanOne === null) {
        this.alsesOnlyLargerThanOne = this.doGetAlses(true);
        this.alsesOnlyLargerThanOneStepNumber = this.stepNumber;
      }
      return this.alsesOnlyLargerThanOne;
    }
    if (this.alsesWithOneStepNumber !== this.stepNumber || this.alsesWithOne === null) {
      this.alsesWithOne = this.doGetAlses(false);
      this.alsesWithOneStepNumber = this.stepNumber;
    }
    return this.alsesWithOne;
  }
  doGetAlses(onlyLargerThanOne) {
    const alses = [];
    const indexSet = new SudokuSet();
    const candSets = new Array(10).fill(0);
    const check = (anzahl, startIndex, indexe) => {
      anzahl++;
      if (anzahl > indexe.length - 1) return;
      for (let i = startIndex; i < indexe.length; i++) {
        const houseIndex = indexe[i];
        if (this.sudoku.getValue(houseIndex) !== 0) continue;
        indexSet.add(houseIndex);
        candSets[anzahl] = candSets[anzahl - 1] | this.sudoku.getCell(houseIndex);
        if (ANZ_VALUES[candSets[anzahl]] - anzahl === 1) {
          if (!onlyLargerThanOne || indexSet.size() > 1) {
            const newAls = new Als(indexSet, candSets[anzahl]);
            if (!alses.some((a) => a.equals(newAls))) alses.push(newAls);
          }
        }
        check(anzahl, i + 1, indexe);
        indexSet.remove(houseIndex);
      }
    };
    for (const unit of ALL_UNITS) {
      for (let j = 0; j < unit.length; j++) {
        indexSet.clear();
        candSets[0] = 0;
        check(0, j, unit);
      }
    }
    for (const als of alses) als.computeFields(this.getCandidates());
    return alses;
  }
  /** Collect restricted commons for forward references only (the default) or in both directions. */
  setRcOnlyForward(onlyForward) {
    this.rcOnlyForward = onlyForward;
  }
  getRestrictedCommons(alses, allowOverlap) {
    if (this.lastRcStepNumber !== this.stepNumber || this.lastRcAllowOverlap !== allowOverlap || this.lastRcAlsList !== alses || this.lastRcOnlyForward !== this.rcOnlyForward) {
      this.restrictedCommons = this.doGetRestrictedCommons(alses, allowOverlap);
      this.lastRcStepNumber = this.stepNumber;
      this.lastRcAllowOverlap = allowOverlap;
      this.lastRcOnlyForward = this.rcOnlyForward;
      this.lastRcAlsList = alses;
    }
    return this.restrictedCommons;
  }
  /** The index of the first RC in the RC list for every ALS. */
  getStartIndices() {
    return this.startIndices;
  }
  /** The index of the last RC + 1 in the RC list for every ALS. */
  getEndIndices() {
    return this.endIndices;
  }
  doGetRestrictedCommons(alses, withOverlap) {
    this.startIndices = new Array(alses.length).fill(0);
    this.endIndices = new Array(alses.length).fill(0);
    const rcs = [];
    const intersectionSet = new SudokuSet();
    const indexSet = new SudokuSet();
    const buddiesSet = new SudokuSet();
    for (let i = 0; i < alses.length; i++) {
      const als1 = alses[i];
      this.startIndices[i] = rcs.length;
      const start2 = this.rcOnlyForward ? i + 1 : 0;
      for (let j = start2; j < alses.length; j++) {
        if (i === j) continue;
        const als2 = alses[j];
        intersectionSet.set(als1.indices);
        intersectionSet.and(als2.indices);
        if (!withOverlap && !intersectionSet.isEmpty()) continue;
        const possibleRestrictedCommonsSet = als1.candidates & als2.candidates;
        if (possibleRestrictedCommonsSet === 0) continue;
        let rcAnz = 0;
        let newRC = null;
        for (const cand of POSSIBLE_VALUES[possibleRestrictedCommonsSet]) {
          indexSet.set(als1.indicesPerCandidat[cand]);
          indexSet.or(als2.indicesPerCandidat[cand]);
          if (!indexSet.andEmpty(intersectionSet)) continue;
          buddiesSet.setAnd(als1.buddiesAlsPerCandidat[cand], als2.buddiesAlsPerCandidat[cand]);
          if (buddiesSet.containsSet(indexSet)) {
            if (rcAnz === 0) {
              newRC = new RestrictedCommon(i, j, cand);
              rcs.push(newRC);
            } else {
              newRC.cand2 = cand;
            }
            rcAnz++;
          }
        }
      }
      this.endIndices[i] = rcs.length;
    }
    return rcs;
  }
};

// ../core/src/solver/sudokuSolver.ts
var EXTREME = 5;
var SudokuSolver = class {
  stepFinder = new SudokuStepFinder();
  sudoku;
  steps = [];
  level = getDifficultyLevel(1);
  maxLevel = getDifficultyLevel(EXTREME);
  score = 0;
  defaultSteps = defaultSolverSteps();
  setSudoku(sudoku) {
    this.steps = [];
    this.sudoku = sudoku;
    this.stepFinder.setSudoku(sudoku);
  }
  getSudoku() {
    return this.sudoku;
  }
  /** The steps of the last {@link solve}. */
  getSteps() {
    return this.steps;
  }
  getScore() {
    return this.score;
  }
  getLevel() {
    return this.level;
  }
  /**
   * Solve the sudoku that was set with {@link setSudoku}; the sudoku is modified.
   * Returns true if it is solved completely (and not too hard for `maxLevel`).
   */
  solve(options = {}) {
    const maxLevel = options.maxLevel ?? getDifficultyLevel(EXTREME);
    const stepConfigs = options.stepConfigs ?? this.defaultSteps;
    const sudoku = this.sudoku;
    if (81 - sudoku.unsolvedCellsAnz < 10) return false;
    this.maxLevel = maxLevel;
    this.score = 0;
    this.level = getDifficultyLevel(1);
    let step;
    do {
      step = this.getHint(options.singlesOnly ?? false, stepConfigs);
      if (step !== null) {
        this.steps.push(step);
        this.stepFinder.doStep(step);
        if (step.type === "GIVE_UP") step = null;
      }
    } while (step !== null);
    while (this.score > this.level.maxScore) this.level = getDifficultyLevel(this.level.ordinal + 1);
    if (this.level.ordinal > maxLevel.ordinal) return false;
    if (options.rejectTooLowScore && this.level.ordinal > 1) {
      if (this.score < getDifficultyLevel(this.level.ordinal - 1).maxScore) return false;
    }
    sudoku.score = this.score;
    if (sudoku.isSolved()) {
      sudoku.level = this.level.ordinal;
      return true;
    }
    sudoku.level = EXTREME;
    return false;
  }
  /**
   * Find the next step for the solver's sudoku and apply it, recording it in
   * {@link getSteps} and the score. Returns null if no technique finds anything.
   * Used to run the solver one step at a time (the loop in {@link solve} does the same).
   */
  step(options = {}) {
    const stepConfigs = options.stepConfigs ?? this.defaultSteps;
    const step = this.nextStep(options.singlesOnly ?? false, stepConfigs);
    if (step !== null) {
      this.steps.push(step);
      this.stepFinder.doStep(step);
    }
    return step;
  }
  getHint(a, b) {
    if (typeof a === "boolean") return this.nextStep(a, b);
    const save = this.sudoku;
    const oldMaxLevel = this.maxLevel;
    const oldLevel = this.level;
    this.maxLevel = getDifficultyLevel(EXTREME);
    this.level = getDifficultyLevel(1);
    this.sudoku = a;
    this.stepFinder.setSudoku(a);
    const step = this.nextStep(b ?? false, this.defaultSteps);
    this.maxLevel = oldMaxLevel;
    this.level = oldLevel;
    this.sudoku = save;
    if (save) this.stepFinder.setSudoku(save);
    return step;
  }
  nextStep(singlesOnly, stepConfigs) {
    if (this.sudoku.isSolved()) return null;
    for (const config of stepConfigs) {
      if (!config.enabled) continue;
      if (singlesOnly && !isSingle(config.type)) continue;
      const hint = this.stepFinder.getStep(config.type);
      if (hint !== null) {
        this.score += config.baseScore;
        const stepLevel = getDifficultyLevel(config.level);
        if (stepLevel.ordinal > this.level.ordinal) this.level = stepLevel;
        if (this.level.ordinal > this.maxLevel.ordinal || this.score >= this.maxLevel.maxScore) return null;
        return hint;
      }
    }
    return null;
  }
};

// ../core/src/generator/levelGenerator.ts
function generatePuzzle(level2, options = {}) {
  const generator = new SudokuGenerator(options.rng);
  const solver = new SudokuSolver();
  const maxTries2 = options.maxTries ?? 2e4;
  const wanted = getDifficultyLevel(level2);
  for (let tries = 1; tries <= maxTries2; tries++) {
    const sudoku = generator.generateSudoku({ symmetric: options.symmetric ?? true });
    if (sudoku === null) return null;
    const solved = sudoku.clone();
    solver.setSudoku(solved);
    const ok = solver.solve({ maxLevel: wanted, rejectTooLowScore: true });
    if (ok && solved.level === wanted.ordinal) {
      sudoku.level = solved.level;
      sudoku.score = solved.score;
      return { sudoku, puzzle: sudoku.getCluesString(), level: wanted.ordinal, score: solved.score, tries };
    }
  }
  return null;
}

// scripts/gen-bank.ts
var [levelArg, countArg, seedArg, out, triesArg] = process.argv.slice(2);
var level = Number(levelArg);
var count = Number(countArg);
var rng = seededRng(Number(seedArg));
var maxTries = triesArg ? Number(triesArg) : 2e4;
var made = 0;
var start = Date.now();
while (made < count) {
  const p = generatePuzzle(level, { rng, maxTries });
  if (p === null) {
    console.log(`level ${level}: no puzzle within ${maxTries} tries`);
    continue;
  }
  appendFileSync(out, JSON.stringify({ p: p.puzzle, l: p.level, s: p.score }) + "\n");
  made++;
  console.log(`level ${level}: ${made}/${count} (${((Date.now() - start) / 1e3).toFixed(0)}s)`);
}

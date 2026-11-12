/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Compact, single-column receipt PNG export using the existing print puzzles.
 */
import { LEVEL_NAMES, type PrintSudoku } from './protocol';
import { drawQr, encodePuzzleQr } from './qrPuzzle';

export const RECEIPT_WIDTH = 384;
export const RECEIPT_CARD_HEIGHT = 476;
/** Scan-to-open footer under each grid: a version 6 QR code at 4px per module (41 + 2x4 quiet modules). */
export const RECEIPT_FOOTER_HEIGHT = 206;
export const RECEIPT_SLOT_HEIGHT = RECEIPT_CARD_HEIGHT + RECEIPT_FOOTER_HEIGHT;
/** Blank paper with a dashed cut line below the last puzzle of each strip. */
export const RECEIPT_TEAR_HEIGHT = 56;
export const RECEIPT_CARDS_PER_STRIP = 6;

/** Pixel height of a strip holding this many puzzles. */
export const receiptStripHeight = (cards: number): number => cards * RECEIPT_SLOT_HEIGHT + RECEIPT_TEAR_HEIGHT;

/** Coordinates from the 384px thermal-printer reference sheet. */
export const RECEIPT_X_LINES = [13, 52, 92, 133, 172, 212, 253, 292, 332, 373] as const;
export const RECEIPT_Y_LINES = [71, 110, 150, 191, 230, 270, 311, 350, 390, 431] as const;

export interface ReceiptCard {
  puzzle: PrintSudoku;
  /** Position within the exported, possibly shuffled batch. */
  order: number;
  /** Per-difficulty serial number, starting at 1 for each export. */
  number: number;
}

/** Group by difficulty first; optionally shuffle *within* each group. Never mutates the input. */
export function prepareReceiptCards(
  puzzles: readonly PrintSudoku[],
  shuffle = false,
  random: () => number = Math.random,
): ReceiptCard[] {
  // Preserve the first occurrence of each difficulty, as chosen in Extended Print.
  const groups = new Map<number, PrintSudoku[]>();
  for (const puzzle of puzzles) {
    const group = groups.get(puzzle.level) ?? [];
    group.push(puzzle);
    groups.set(puzzle.level, group);
  }
  const ordered: PrintSudoku[] = [];
  for (const group of groups.values()) {
    if (shuffle) {
      // Fisher–Yates, independently applied to this difficulty only.
      for (let i = group.length - 1; i > 0; i--) {
        const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
        [group[i], group[j]] = [group[j], group[i]];
      }
    }
    ordered.push(...group);
  }
  const counts = new Map<number, number>();
  return ordered.map((puzzle, i) => {
    const number = (counts.get(puzzle.level) ?? 0) + 1;
    counts.set(puzzle.level, number);
    return { puzzle, order: i + 1, number };
  });
}

export function splitReceiptCards(cards: readonly ReceiptCard[], perStrip = RECEIPT_CARDS_PER_STRIP): ReceiptCard[][] {
  if (!Number.isInteger(perStrip) || perStrip < 1) throw new RangeError('Invalid receipt strip length.');
  const strips: ReceiptCard[][] = [];
  for (let i = 0; i < cards.length; i += perStrip) strips.push(cards.slice(i, i + perStrip));
  return strips;
}

export interface ReceiptStrip {
  level: number;
  part: number;
  cards: ReceiptCard[];
}

/** Split each difficulty independently, so no exported strip mixes levels. */
export function planReceiptStrips(cards: readonly ReceiptCard[], perStrip = RECEIPT_CARDS_PER_STRIP): ReceiptStrip[] {
  const groups = new Map<number, ReceiptCard[]>();
  for (const card of cards) {
    const group = groups.get(card.puzzle.level) ?? [];
    group.push(card);
    groups.set(card.puzzle.level, group);
  }
  const out: ReceiptStrip[] = [];
  for (const [level, group] of groups) {
    splitReceiptCards(group, perStrip).forEach((part, index) =>
      out.push({ level, part: index + 1, cards: part }),
    );
  }
  return out;
}

/** Draw 384x476px cards using the original receipt layout and true white background.
 * Exact local reference fonts: DejaVu Sans Bold 24px title/26px digits,
 * DejaVu Sans Mono Bold 16px score header. Browser fallback fonts may differ
 * unless these fonts are installed on the client's device.
 */
function drawCard(ctx: CanvasRenderingContext2D, card: ReceiptCard, y: number, answer: boolean): void {
  const { puzzle, number } = card;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, y, RECEIPT_WIDTH, RECEIPT_CARD_HEIGHT);

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '700 24px "DejaVu Sans", sans-serif';
  ctx.fillText('SUDOKU', 12, y + 18);

  const label = String(LEVEL_NAMES[puzzle.level] ?? 'Sudoku').toUpperCase();
  ctx.font = '700 16px "DejaVu Sans Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(label + ' #' + String(number).padStart(2, '0') + ' ' + puzzle.score, 372, y + 22);

  // Source geometry: 4px 3x3 dividers, 1px cell boundaries, pure black.
  const left = RECEIPT_X_LINES[0] - 2;
  const top = RECEIPT_Y_LINES[0] - 2;
  const width = RECEIPT_X_LINES[9] - RECEIPT_X_LINES[0] + 4;
  const height = RECEIPT_Y_LINES[9] - RECEIPT_Y_LINES[0] + 4;
  for (let i = 0; i <= 9; i++) {
    const thick = i % 3 === 0;
    ctx.fillRect(thick ? RECEIPT_X_LINES[i] - 2 : RECEIPT_X_LINES[i], y + top, thick ? 4 : 1, height);
    ctx.fillRect(left, y + (thick ? RECEIPT_Y_LINES[i] - 2 : RECEIPT_Y_LINES[i]), width, thick ? 4 : 1);
  }

  const digits = answer ? puzzle.solution : [...puzzle.givens].map((v) => (v === '.' || v === '0' ? 0 : Number(v)));
  if (!digits || digits.length !== 81) throw new Error('This puzzle has no 81-cell solution for the answer strip.');
  ctx.font = '700 26px "DejaVu Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let cell = 0; cell < 81; cell++) {
    const digit = digits[cell];
    if (!digit) continue;
    const row = Math.floor(cell / 9);
    const col = cell % 9;
    const x = Math.floor((RECEIPT_X_LINES[col] + RECEIPT_X_LINES[col + 1]) / 2);
    const yy = y + Math.floor((RECEIPT_Y_LINES[row] + RECEIPT_Y_LINES[row + 1]) / 2);
    ctx.fillText(String(digit), x, yy + 4);
  }
}

const FOOTER_FONT = '"DejaVu Sans Mono", monospace';
const SITE_TEXT = 'hodokurevisited.com';

/** QR code on the left, "scan for hints & solution" and the site name on the right. */
function drawFooter(ctx: CanvasRenderingContext2D, card: ReceiptCard, top: number): void {
  const qr = encodePuzzleQr(card.puzzle.givens);
  const scale = Math.max(1, Math.floor((RECEIPT_FOOTER_HEIGHT - 10) / (qr.size + 8)));
  const side = drawQr(ctx, qr, 8, top + 5, scale);

  const x = 8 + side + 6;
  const room = RECEIPT_WIDTH - 8 - x;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '700 16px ' + FOOTER_FONT;
  ['SCAN FOR', 'HINTS &', 'SOLUTION'].forEach((line, i) => ctx.fillText(line, x, top + 36 + i * 22));
  let px = 15;
  ctx.font = '700 ' + px + 'px ' + FOOTER_FONT;
  while (ctx.measureText(SITE_TEXT).width > room && px > 9) {
    px -= 1;
    ctx.font = '700 ' + px + 'px ' + FOOTER_FONT;
  }
  ctx.fillText(SITE_TEXT, x, top + 114);
}

/** Dashed cut line and the website, below the last puzzle of a strip. */
function drawTearOff(ctx: CanvasRenderingContext2D, top: number): void {
  ctx.fillStyle = '#000000';
  for (let x = 0; x < RECEIPT_WIDTH; x += 12) ctx.fillRect(x, top + 6, 6, 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '700 13px ' + FOOTER_FONT;
  ctx.fillText('Check solution & hints: ' + SITE_TEXT, RECEIPT_WIDTH / 2, top + 20);
}

/** A printable 384px-wide PNG containing a vertical strip of puzzles, each with a scan code. */
async function makeStrip(cards: readonly ReceiptCard[], answer: boolean): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = RECEIPT_WIDTH;
  canvas.height = receiptStripHeight(cards.length);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create the receipt image.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  cards.forEach((card, index) => {
    const top = index * RECEIPT_SLOT_HEIGHT;
    drawCard(ctx, card, top, answer);
    drawFooter(ctx, card, top + RECEIPT_CARD_HEIGHT);
  });
  drawTearOff(ctx, cards.length * RECEIPT_SLOT_HEIGHT);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((data) => data ? resolve(data) : reject(new Error('Could not encode the receipt PNG.')), 'image/png'),
  );
  // Release the potentially tall canvas before starting the next strip.
  canvas.width = 0;
  canvas.height = 0;
  return new Uint8Array(await blob.arrayBuffer());
}

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

const write16 = (dv: DataView, offset: number, value: number) => dv.setUint16(offset, value, true);
const write32 = (dv: DataView, offset: number, value: number) => dv.setUint32(offset, value, true);
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const n of data) crc = crcTable[(crc ^ n) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Small dependency-free ZIP (uncompressed/store); PNGs are already compressed. */
export function receiptZip(entries: readonly ZipEntry[]): Blob {
  if (entries.length > 65535) throw new RangeError('Too many receipt files.');
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const directoryParts: Uint8Array[] = [];
  let localOffset = 0;
  let directorySize = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    if (!name.length || name.length > 65535) throw new RangeError('Invalid receipt filename.');
    if (entry.bytes.byteLength > 0xffffffff) throw new RangeError('Receipt PNG too large.');
    const crc = crc32(entry.bytes);
    const local = new Uint8Array(30 + name.length);
    const l = new DataView(local.buffer);
    write32(l, 0, 0x04034b50);
    write16(l, 4, 20);
    write16(l, 6, 0x0800); // UTF-8 names
    write16(l, 10, 0); // time
    write16(l, 12, 0x0021); // 1980-01-01
    write32(l, 14, crc);
    write32(l, 18, entry.bytes.byteLength);
    write32(l, 22, entry.bytes.byteLength);
    write16(l, 26, name.length);
    local.set(name, 30);
    localParts.push(local, entry.bytes);

    const central = new Uint8Array(46 + name.length);
    const c = new DataView(central.buffer);
    write32(c, 0, 0x02014b50);
    write16(c, 4, 20);
    write16(c, 6, 20);
    write16(c, 8, 0x0800);
    write16(c, 14, 0x0021);
    write32(c, 16, crc);
    write32(c, 20, entry.bytes.byteLength);
    write32(c, 24, entry.bytes.byteLength);
    write16(c, 28, name.length);
    write32(c, 42, localOffset);
    central.set(name, 46);
    directoryParts.push(central);
    directorySize += central.length;
    localOffset += local.length + entry.bytes.byteLength;
    if (localOffset + directorySize > 0xffffffff) throw new RangeError('Receipt archive too large.');
  }

  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  write32(e, 0, 0x06054b50);
  write16(e, 8, entries.length);
  write16(e, 10, entries.length);
  write32(e, 12, directorySize);
  write32(e, 16, localOffset);

  const result = new Uint8Array(localOffset + directorySize + end.length);
  let offset = 0;
  for (const part of [...localParts, ...directoryParts, end]) {
    result.set(part, offset);
    offset += part.length;
  }
  return new Blob([result], { type: 'application/zip' });
}

/** Export grouped puzzle sheets followed by their matching answer sheets. */
export async function downloadReceiptPngs(puzzles: readonly PrintSudoku[], shuffle: boolean): Promise<void> {
  if (puzzles.length === 0) throw new Error('No puzzles to export.');
  const cards = prepareReceiptCards(puzzles, shuffle);
  const strips = planReceiptStrips(cards);
  const files: ZipEntry[] = [];

  for (let i = 0; i < strips.length; i++) {
    const strip = strips[i];
    const level = String(LEVEL_NAMES[strip.level] ?? 'sudoku').toLowerCase();
    const part = String(strip.part).padStart(2, '0');
    const number = String(i + 1).padStart(2, '0');
    files.push({ name: number + '. ' + level + '_problems_' + part + '.png', bytes: await makeStrip(strip.cards, false) });
  }
  for (let i = 0; i < strips.length; i++) {
    const strip = strips[i];
    const level = String(LEVEL_NAMES[strip.level] ?? 'sudoku').toLowerCase();
    const part = String(strip.part).padStart(2, '0');
    const number = String(i + strips.length + 1).padStart(2, '0');
    files.push({ name: number + '. ' + level + '_answers_' + part + '.png', bytes: await makeStrip(strip.cards, true) });
  }

  files.push({
    name: 'README.txt',
    bytes: new TextEncoder().encode(
      'Hodoku Revisited - 384px thermal receipt export\n' +
      'Puzzle strips are grouped by difficulty and optionally shuffled *within* that difficulty.\n' +
      'The puzzle PNGs come first, followed by paired answer PNGs in the same difficulty order.\n' +
      'Each puzzle is 384x476px plus a 206px scan footer; strips contain up to 6 puzzles (4148px maximum).\n' +
      'Scan the QR code under a puzzle to open it at hodokurevisited.com with hints and the solution.\n' +
      'Difficulty numbers start at #01 within each export; scores come from the HoDoKu engine.\n' +
      'Learning/practicing sections export original givens, not partly solved training boards.\n' +
      'White background; the original desktop glyphs use DejaVu Sans Bold/DejaVu Sans Mono Bold.\n',
    ),
  });
  const url = URL.createObjectURL(receiptZip(files));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'hodoku-receipt-384px.zip';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

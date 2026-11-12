/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * A 1-bit QR code that opens a printed puzzle in the app (`/play/?P=<81 characters>&q=1`).
 *
 * The host and the puzzle use QR alphanumeric mode (uppercase letters, digits, `.` and `/`); the
 * case-sensitive path, the query punctuation and the scan marker use byte mode. This keeps the
 * symbol at version 6 (41x41 modules) at error correction M. The scheme and host are
 * case-insensitive, and the app reads the `P` key case-insensitively.
 */
import { qrcodegen } from './vendor/qrcodegen';

export type QrCode = qrcodegen.QrCode;

const { QrCode: QrCodeClass, QrSegment } = qrcodegen;

const HOST = 'HTTPS://HODOKUREVISITED.COM/';
const PATH_QUERY = 'play/?P=';
const SCAN_MARKER = '&q=1';

const bytes = (text: string): number[] => Array.from(new TextEncoder().encode(text));

function normalize(givens: string): string {
  const puzzle = givens.replace(/0/g, '.');
  if (!/^[.1-9]{81}$/.test(puzzle)) throw new RangeError('A puzzle QR code needs 81 givens.');
  return puzzle;
}

/** The text a scanner reads from the code. */
export function puzzleQrText(givens: string): string {
  return HOST + PATH_QUERY + normalize(givens) + SCAN_MARKER;
}

export function encodePuzzleQr(givens: string): QrCode {
  const puzzle = normalize(givens);
  const segments = [
    QrSegment.makeAlphanumeric(HOST),
    QrSegment.makeBytes(bytes(PATH_QUERY)),
    QrSegment.makeAlphanumeric(puzzle),
    QrSegment.makeBytes(bytes(SCAN_MARKER)),
  ];
  // boostEcl stays off so every puzzle gets the same, predictable symbol size
  return QrCodeClass.encodeSegments(segments, QrCodeClass.Ecc.MEDIUM, 1, 40, -1, false);
}

export interface QrSink {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
}

/** Size in pixels of a QR code drawn with the given module size and quiet zone. */
export const qrPixelSize = (qr: QrCode, scale: number, quiet = 4): number => (qr.size + quiet * 2) * scale;

/**
 * Draw the code in pure black on pure white. All coordinates are whole pixels, so no
 * antialiasing reaches the printer. Returns the side of the square it covered.
 */
export function drawQr(ctx: QrSink, qr: QrCode, x: number, y: number, scale: number, quiet = 4): number {
  if (!Number.isInteger(scale) || scale < 1) throw new RangeError('QR module size must be a whole number of pixels.');
  const side = qrPixelSize(qr, scale, quiet);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, side, side);
  ctx.fillStyle = '#000000';
  for (let row = 0; row < qr.size; row++) {
    for (let col = 0; col < qr.size; col++) {
      if (qr.getModule(col, row)) ctx.fillRect(x + (col + quiet) * scale, y + (row + quiet) * scale, scale, scale);
    }
  }
  return side;
}

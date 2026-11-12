import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { drawQr, encodePuzzleQr, puzzleQrText, qrPixelSize, type QrSink } from '../src/qrPuzzle';
import { puzzleFromSearch } from '../src/urlParams';

const GIVENS = '97....4..2..4718.3........5....5..8.5.1.4.2.9.4..8....8........3.9762..8..5....67';

/** A canvas stand-in that records pure black or white rectangles into a grayscale bitmap. */
function bitmap(side: number): { sink: QrSink; gray: Uint8Array } {
  const gray = new Uint8Array(side * side).fill(255);
  let value = 255;
  const sink: QrSink = {
    set fillStyle(style) {
      value = style === '#000000' ? 0 : 255;
    },
    get fillStyle() {
      return value ? '#ffffff' : '#000000';
    },
    fillRect(x, y, w, h) {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) gray[yy * side + xx] = value;
    },
  };
  return { sink, gray };
}

const toRgba = (gray: Uint8Array): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(gray.length * 4);
  gray.forEach((v, i) => out.set([v, v, v, 255], i * 4));
  return out;
};

/** Thicken black pixels by one pixel to the right and down, like ink or heat bleeding on thermal paper. */
const bleed = (gray: Uint8Array, side: number): Uint8Array => {
  const out = gray.slice();
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      if (gray[y * side + x] === 0) {
        if (x + 1 < side) out[y * side + x + 1] = 0;
        if (y + 1 < side) out[(y + 1) * side + x] = 0;
      }
    }
  }
  return out;
};

describe('puzzle QR code', () => {
  it('links to the app with the puzzle and the scan marker', () => {
    expect(puzzleQrText(GIVENS)).toBe(`HTTPS://HODOKUREVISITED.COM/play/?P=${GIVENS}&q=1`);
    expect(puzzleQrText(GIVENS.replace(/\./g, '0'))).toBe(puzzleQrText(GIVENS));
    expect(() => puzzleQrText('123')).toThrow(RangeError);
  });

  it('is a 41x41 version 6 symbol that fits the 206px footer at 4px per module', () => {
    const qr = encodePuzzleQr(GIVENS);
    expect(qr.version).toBe(6);
    expect(qr.size).toBe(41);
    expect(qrPixelSize(qr, 4)).toBe(196);
  });

  it('draws only whole-pixel black and white', () => {
    const qr = encodePuzzleQr(GIVENS);
    const side = qrPixelSize(qr, 4);
    const { sink, gray } = bitmap(side);
    expect(drawQr(sink, qr, 0, 0, 4)).toBe(side);
    expect(new Set(gray)).toEqual(new Set([0, 255]));
    expect(() => drawQr(sink, qr, 0, 0, 2.5)).toThrow(RangeError);
  });

  it('decodes to the app address, and the app reads the puzzle back from it', () => {
    const qr = encodePuzzleQr(GIVENS);
    const side = qrPixelSize(qr, 4);
    const { sink, gray } = bitmap(side);
    drawQr(sink, qr, 0, 0, 4);
    const result = jsQR(toRgba(gray), side, side);
    expect(result?.data).toBe(puzzleQrText(GIVENS));
    const url = new URL(result!.data);
    expect(url.origin).toBe('https://hodokurevisited.com');
    expect(url.pathname).toBe('/play/');
    expect(puzzleFromSearch(url.search)).toBe(GIVENS);
  });

  it('still decodes after one pixel of thermal bleed', () => {
    const qr = encodePuzzleQr(GIVENS);
    const side = qrPixelSize(qr, 4);
    const { sink, gray } = bitmap(side);
    drawQr(sink, qr, 0, 0, 4);
    expect(jsQR(toRgba(bleed(gray, side)), side, side)?.data).toBe(puzzleQrText(GIVENS));
  });

  it('keeps every puzzle at version 6, from a nearly empty grid to a full one', () => {
    const empty = '.'.repeat(81);
    const full = '123456789'.repeat(9);
    expect(encodePuzzleQr(empty).version).toBe(6);
    expect(encodePuzzleQr(full).version).toBe(6);
  });
});

import { describe, expect, it } from 'vitest';
import {
  RECEIPT_CARDS_PER_STRIP,
  RECEIPT_CARD_HEIGHT,
  RECEIPT_FOOTER_HEIGHT,
  RECEIPT_SLOT_HEIGHT,
  RECEIPT_QR_OVERLAP,
  RECEIPT_PLAIN_CARDS_PER_STRIP,
  RECEIPT_WEBSITE_LABEL,
  RECEIPT_WIDTH,
  planReceiptStrips,
  prepareReceiptCards,
  receiptCardsPerStrip,
  receiptPageLinkMode,
  receiptStripHeight,
  receiptZip,
  splitReceiptCards,
} from '../src/receiptPrint';
import type { PrintSudoku } from '../src/protocol';

const puzzle = (level: number, score: number): PrintSudoku => ({
  givens: '.'.repeat(81),
  values: Array(81).fill(0),
  cands: Array(81).fill(0),
  solution: Array(81).fill(1),
  level,
  score,
  showCands: false,
});

describe('receipt print layout', () => {
  it('keeps the reference 384x476px geometry', () => {
    expect(RECEIPT_WIDTH).toBe(384);
    expect(RECEIPT_CARD_HEIGHT).toBe(476);
  });

  it('reduces empty space under the grid while preserving its 384x476 geometry', () => {
    expect(RECEIPT_FOOTER_HEIGHT).toBe(206);
    expect(RECEIPT_QR_OVERLAP).toBe(28);
    expect(RECEIPT_SLOT_HEIGHT).toBe(654);
    expect(RECEIPT_CARDS_PER_STRIP).toBe(6);
    expect(receiptStripHeight(6)).toBe(3980);
    expect(receiptStripHeight(10, false)).toBe(4760);
    expect(RECEIPT_PLAIN_CARDS_PER_STRIP).toBe(10);
  });

  it('selects link modes independently on puzzle and answer sheets', () => {
    const both = { linkMode: 'qr', placement: 'both' } as const;
    expect(receiptPageLinkMode(false, both)).toBe('qr');
    expect(receiptPageLinkMode(true, both)).toBe('qr');
    const onPuzzles = { linkMode: 'qr', placement: 'problems' } as const;
    expect(receiptPageLinkMode(false, onPuzzles)).toBe('qr');
    expect(receiptPageLinkMode(true, onPuzzles)).toBe('none');
    const onAnswers = { linkMode: 'website', placement: 'answers' } as const;
    expect(receiptPageLinkMode(false, onAnswers)).toBe('none');
    expect(receiptPageLinkMode(true, onAnswers)).toBe('website');
    expect(receiptPageLinkMode(false, { linkMode: 'none', placement: 'both' })).toBe('none');
    expect(receiptCardsPerStrip(both)).toBe(6);
    expect(receiptCardsPerStrip(onPuzzles)).toBe(6);
    expect(receiptCardsPerStrip(onAnswers)).toBe(10);
    expect(receiptCardsPerStrip({ linkMode: 'none', placement: 'both' })).toBe(10);
  });

  it('prints only the short website name in website mode, not puzzle data', () => {
    expect(RECEIPT_WEBSITE_LABEL).toBe('hodokurevisited.com');
    expect(RECEIPT_WEBSITE_LABEL).not.toContain('/play/');
    expect(RECEIPT_WEBSITE_LABEL).not.toContain('?P=');
    expect(RECEIPT_WEBSITE_LABEL).not.toContain('&q=1');
    expect(receiptPageLinkMode(false, { linkMode: 'website', placement: 'problems' })).toBe('website');
    expect(receiptPageLinkMode(true, { linkMode: 'website', placement: 'problems' })).toBe('none');
  });

  it('numbers puzzles within each level without mutating the input order', () => {
    const input = [puzzle(2, 400), puzzle(1, 300), puzzle(2, 500), puzzle(5, 4000)];
    const cards = prepareReceiptCards(input);
    expect(cards.map((c) => c.number)).toEqual([1, 2, 1, 1]);
    expect(cards.map((c) => c.order)).toEqual([1, 2, 3, 4]);
    expect(cards.map((c) => c.puzzle.level)).toEqual([2, 2, 1, 5]);
    expect(input.map((p) => p.level)).toEqual([2, 1, 2, 5]);
  });

  it('shuffles only within difficulty groups, never across them', () => {
    const input = [puzzle(1, 200), puzzle(2, 500), puzzle(1, 240), puzzle(3, 1000), puzzle(2, 550)];
    const cards = prepareReceiptCards(input, true, () => 0);
    expect(cards.map((c) => c.puzzle.level)).toEqual([1, 1, 2, 2, 3]);
    expect(cards.map((c) => c.puzzle.score)).toEqual([240, 200, 550, 500, 1000]);
    expect(cards.map((c) => c.number)).toEqual([1, 2, 1, 2, 1]);
    expect(input.map((c) => c.score)).toEqual([200, 500, 240, 1000, 550]);
  });

  it('creates difficulty-homogeneous strips of at most six for a 20/30/10/10 batch', () => {
    const input = [
      ...Array.from({ length: 20 }, (_, i) => puzzle(1, 100 + i)),
      ...Array.from({ length: 30 }, (_, i) => puzzle(2, 200 + i)),
      ...Array.from({ length: 10 }, (_, i) => puzzle(3, 300 + i)),
      ...Array.from({ length: 10 }, (_, i) => puzzle(5, 500 + i)),
    ];
    const strips = planReceiptStrips(prepareReceiptCards(input, true, () => 0));
    expect(strips.map((s) => s.level)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 5, 5]);
    expect(strips.map((s) => s.part)).toEqual([1, 2, 3, 4, 1, 2, 3, 4, 5, 1, 2, 1, 2]);
    expect(strips.map((s) => s.cards.length)).toEqual([6, 6, 6, 2, 6, 6, 6, 6, 6, 6, 4, 6, 4]);
    expect(strips.every((s) => s.cards.every((card) => card.puzzle.level === s.level))).toBe(true);
    expect(strips.flatMap((s) => s.cards)).toHaveLength(70);
  });

  it('keeps paired strips aligned when only one side has a QR footer', () => {
    const cards = prepareReceiptCards(Array.from({ length: 21 }, (_, i) => puzzle(i < 12 ? 1 : 2, i)));
    const qrOnlyOnAnswers = planReceiptStrips(cards, receiptCardsPerStrip({ linkMode: 'qr', placement: 'answers' }));
    const websiteOnlyOnAnswers = planReceiptStrips(cards, receiptCardsPerStrip({ linkMode: 'website', placement: 'answers' }));
    expect(qrOnlyOnAnswers.map((strip) => strip.cards.length)).toEqual([6, 6, 6, 3]);
    expect(websiteOnlyOnAnswers.map((strip) => strip.cards.length)).toEqual([10, 2, 9]);
    expect(qrOnlyOnAnswers.flatMap((strip) => strip.cards).map((c) => c.order)).toEqual(
      websiteOnlyOnAnswers.flatMap((strip) => strip.cards).map((c) => c.order),
    );
  });

  it('splits long jobs into six-puzzle sheets with no missing puzzles', () => {
    const cards = prepareReceiptCards(Array.from({ length: 23 }, (_, i) => puzzle((i % 5) + 1, i * 10)));
    const strips = splitReceiptCards(cards);
    expect(strips.map((s) => s.length)).toEqual([6, 6, 6, 5]);
    expect(strips.flat().map((c) => c.order)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
    expect(() => splitReceiptCards(cards, 0)).toThrow(RangeError);
  });
});

describe('receipt ZIP archive', () => {
  it('writes a valid local record, directory and end record with stored bytes', async () => {
    const name = 'puzzles.png';
    const payload = new Uint8Array([137, 80, 78, 71]);
    const archive = receiptZip([{ name, bytes: payload }]);
    const bytes = new Uint8Array(await archive.arrayBuffer());
    const view = new DataView(bytes.buffer);
    expect(archive.type).toBe('application/zip');
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(18, true)).toBe(payload.length);
    expect(new TextDecoder().decode(bytes.slice(30, 30 + name.length))).toBe(name);
    expect([...bytes.slice(30 + name.length, 30 + name.length + payload.length)]).toEqual([...payload]);
    const cd = 30 + name.length + payload.length;
    expect(view.getUint32(cd, true)).toBe(0x02014b50);
    expect(view.getUint32(cd + 16, true)).toBe(view.getUint32(14, true));
    const end = cd + 46 + name.length;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(1);
  });
});

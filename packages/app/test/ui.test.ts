import { describe, expect, it } from 'vitest';
import { colorKuColor, DEFAULT_COLORKU_COLORS, DEFAULT_SETTINGS } from '../src/ui';

describe('settings', () => {
  it('defaults ColorKu to off with a colour for every digit', () => {
    expect(DEFAULT_SETTINGS.colorKu).toBe(false);
    expect(DEFAULT_SETTINGS.cellZoom).toBe(false);
    expect(DEFAULT_SETTINGS.colorKuColors).toHaveLength(9);
    expect(DEFAULT_COLORKU_COLORS.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
  });
});

describe('colorKuColor', () => {
  it('uses the configured colour per digit', () => {
    const colors = ['#000001', '#000002', '#000003', '#000004', '#000005', '#000006', '#000007', '#000008', '#000009'];
    expect(colorKuColor(colors, 1)).toBe('#000001');
    expect(colorKuColor(colors, 9)).toBe('#000009');
  });
  it('falls back to the default palette when the list is missing or short', () => {
    expect(colorKuColor(undefined, 3)).toBe(DEFAULT_COLORKU_COLORS[2]);
    expect(colorKuColor(['#abcdef'], 5)).toBe(DEFAULT_COLORKU_COLORS[4]);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

const { writeFileMock, shareMock } = vi.hoisted(() => ({
  writeFileMock: vi.fn(),
  shareMock: vi.fn(),
}));

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: { writeFile: writeFileMock },
}));

vi.mock('@capacitor/share', () => ({
  Share: { share: shareMock },
}));

import { bytesToBase64, exportOutcomeMessage, safeExportFilename, saveBytes } from '../src/files';

afterEach(() => {
  vi.unstubAllGlobals();
  writeFileMock.mockReset();
  shareMock.mockReset();
});

describe('native file export', () => {
  it('writes the file to the cache and presents exactly one share sheet with its URI', async () => {
    writeFileMock.mockResolvedValue({ uri: 'file:///cache/hodoku.png' });
    shareMock.mockResolvedValue({ activityType: 'com.apple.DocumentsApp' });

    const outcome = await saveBytes('hodoku.png', new Uint8Array([137, 80, 78, 71]), 'image/png', true);

    expect(outcome).toBe('shared');
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(writeFileMock.mock.calls[0]![0]).toEqual({
      path: 'hodoku.png',
      data: 'iVBORw==',
      directory: 'CACHE',
      recursive: true,
    });
    expect(shareMock).toHaveBeenCalledTimes(1);
    expect(shareMock.mock.calls[0]![0]).toEqual({
      title: 'hodoku.png',
      files: ['file:///cache/hodoku.png'],
      dialogTitle: 'Save or share hodoku.png',
    });
    expect(writeFileMock.mock.invocationCallOrder[0]).toBeLessThan(shareMock.mock.invocationCallOrder[0]!);
  });

  it('does not resolve until the share sheet settles, so callers cannot show success early', async () => {
    writeFileMock.mockResolvedValue({ uri: 'file:///cache/hodoku-receipt-384px.zip' });

    let finishShare!: (value: { activityType: string }) => void;
    shareMock.mockReturnValue(
      new Promise<{ activityType: string }>((resolve) => {
        finishShare = resolve;
      }),
    );

    let settled = false;
    const pending = saveBytes('hodoku-receipt-384px.zip', new Uint8Array([80, 75]), 'application/zip', true).then(() => {
      settled = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(shareMock).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    finishShare({ activityType: 'com.apple.DocumentsApp' });
    await pending;
    expect(settled).toBe(true);
  });

  it('propagates a failed share instead of reporting success', async () => {
    writeFileMock.mockResolvedValue({ uri: 'file:///cache/hodoku.png' });
    shareMock.mockRejectedValue(new Error('Share canceled'));

    await expect(saveBytes('hodoku.png', new Uint8Array([1]), 'image/png', true)).rejects.toThrow('Share canceled');
  });

  it('never opens the share sheet when the cache write fails', async () => {
    writeFileMock.mockRejectedValue(new Error('Disk full'));

    await expect(saveBytes('hodoku.png', new Uint8Array([1]), 'image/png', true)).rejects.toThrow('Disk full');
    expect(shareMock).not.toHaveBeenCalled();
  });

  it('flattens a path-like filename before writing it into the cache', async () => {
    writeFileMock.mockResolvedValue({ uri: 'file:///cache/hodoku.png' });
    shareMock.mockResolvedValue({});

    await saveBytes('../hodoku.png', new Uint8Array([1]), 'image/png', true);

    expect(writeFileMock.mock.calls[0]![0].path).toBe('hodoku.png');
    expect(shareMock.mock.calls[0]![0].title).toBe('hodoku.png');
  });

  it('keeps the website on a normal download and never touches the native plugins', async () => {
    const click = vi.fn();
    const remove = vi.fn();
    const append = vi.fn();
    const link = { href: '', download: '', click, remove };
    const createElement = vi.fn(() => link);
    vi.stubGlobal('document', { createElement, body: { append } });
    const createObjectURL = vi.fn(() => 'blob:hodoku');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    const outcome = await saveBytes('hodoku.png', new Uint8Array([1, 2, 3]), 'image/png', false);

    expect(outcome).toBe('downloaded');
    expect(createElement).toHaveBeenCalledWith('a');
    expect(link.href).toBe('blob:hodoku');
    expect(link.download).toBe('hodoku.png');
    expect(append).toHaveBeenCalledWith(link);
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:hodoku');
    expect(writeFileMock).not.toHaveBeenCalled();
    expect(shareMock).not.toHaveBeenCalled();
  });
});

describe('native filename and success copy', () => {
  it('leaves ordinary export filenames alone', () => {
    expect(safeExportFilename('hodoku.png')).toBe('hodoku.png');
    expect(safeExportFilename('hodoku-receipt-384px.zip')).toBe('hodoku-receipt-384px.zip');
    expect(safeExportFilename('hodoku-givens.txt')).toBe('hodoku-givens.txt');
  });

  it('removes directories and characters other apps cannot handle', () => {
    expect(safeExportFilename('../hodoku.png')).toBe('hodoku.png');
    expect(safeExportFilename('C:\\temp\\hodoku:1?.zip')).toBe('hodoku-1-.zip');
    expect(safeExportFilename('...')).toBe('hodoku-export');
    expect(safeExportFilename('   ')).toBe('hodoku-export');
  });

  it('encodes binary bytes for the Filesystem bridge, including a chunk boundary', () => {
    expect(bytesToBase64(new Uint8Array([72, 105]))).toBe('SGk=');
    // 0x8001 bytes exercise the second String.fromCharCode chunk without a stack overflow.
    expect(bytesToBase64(new Uint8Array(0x8001).fill(65))).toHaveLength(43692);
  });

  it('names the two outcomes without overstating a native share', () => {
    expect(exportOutcomeMessage('hodoku.png', 'shared')).toBe('Shared hodoku.png.');
    expect(exportOutcomeMessage('hodoku.png', 'downloaded')).toBe('Saved hodoku.png.');
  });
});

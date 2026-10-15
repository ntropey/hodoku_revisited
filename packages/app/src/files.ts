/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Reading a puzzle from a file and writing one to a file. Uses the DOM only.
 */

/** Save `text` as `filename`; the browser asks where to put it (its own download). */
export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** The text of a file the user picked, as UTF-8. */
export function readTextFile(file: File): Promise<string> {
  return file.text();
}

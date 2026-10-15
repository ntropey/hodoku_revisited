import type { CopyFormat, HintLevel, HintResult, PrintSection, PrintSudoku, PuzzleInfo, WorkerRequest, WorkerResponse } from './protocol';

type Distribute<T> = T extends unknown ? Omit<T, 'id'> : never;

/** Rejection of a call that was killed by `cancel()`; callers normally ignore it. */
export class CancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CancelledError';
  }
}

/** True when `e` is the rejection produced by `SolverClient.cancel()`. */
export function isCancelled(e: unknown): boolean {
  return e instanceof CancelledError;
}

/** Talks to the solver worker. `cancel()` kills a long running job (e.g. generating a hard puzzle). */
export class SolverClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void }>();

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const p = this.pending.get(e.data.id);
      if (p) {
        this.pending.delete(e.data.id);
        p.resolve(e.data);
      }
    };
    // the worker failed to load or threw: reject everything in flight and drop it, so a later call retries
    w.onerror = () => this.fail('The solver failed to start.');
    w.onmessageerror = () => this.fail('The solver returned an unreadable response.');
    this.worker = w;
    return w;
  }

  /** Reject every pending call and discard the worker. */
  private fail(message: string): void {
    this.worker?.terminate();
    this.worker = null;
    for (const p of this.pending.values()) p.reject(new Error(message));
    this.pending.clear();
  }

  private call(req: Distribute<WorkerRequest>): Promise<WorkerResponse> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ensure().postMessage({ ...req, id });
    });
  }

  cancel(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const p of this.pending.values()) p.reject(new CancelledError());
    this.pending.clear();
  }

  private async puzzle(req: Distribute<WorkerRequest>): Promise<PuzzleInfo> {
    const r = await this.call(req);
    if (r.kind === 'error') throw new Error(r.message);
    if (r.kind !== 'puzzle') throw new Error('unexpected response');
    return r.info;
  }

  generate(level: number): Promise<PuzzleInfo> {
    return this.puzzle({ kind: 'generate', level });
  }

  /** A puzzle from the bank (instant); falls back to generating one if the bank has none. */
  fromBank(level: number, seen: number[]): Promise<PuzzleInfo> {
    return this.puzzle({ kind: 'bank', level, seen });
  }

  /** A bank puzzle that needs at least one of `techniques`; null if none of the level has one. */
  async train(level: number, techniques: string[], autoSolve: boolean, seen: number[]): Promise<PuzzleInfo | null> {
    const r = await this.call({ kind: 'train', level, techniques, autoSolve, seen });
    if (r.kind === 'error') throw new Error(r.message);
    if (r.kind !== 'train') throw new Error('unexpected response');
    return r.info;
  }

  analyze(puzzle: string): Promise<PuzzleInfo> {
    return this.puzzle({ kind: 'analyze', puzzle });
  }

  /** Every step available now, grouped by technique (at most a dozen per technique are returned). */
  async allHints(values: number[], cands: number[], level: HintLevel, disabled: string[] = []): Promise<{ results: HintResult[]; total: Record<string, number> }> {
    const r = await this.call({ kind: 'allHints', values, cands, level, disabled });
    if (r.kind === 'error') throw new Error(r.message);
    if (r.kind !== 'allHints') throw new Error('unexpected response');
    return { results: r.results, total: r.total };
  }

  async hint(values: number[], cands: number[], level: HintLevel, disabled: string[] = []): Promise<HintResult | null> {
    const r = await this.call({ kind: 'hint', values, cands, level, disabled });
    if (r.kind === 'error') throw new Error(r.message);
    if (r.kind !== 'hint') throw new Error('unexpected response');
    return r.hint;
  }

  /** The solver's remaining steps from this board, in order (the "solution path"). */
  async path(values: number[], cands: number[]): Promise<HintResult[]> {
    const r = await this.call({ kind: 'path', values, cands });
    if (r.kind === 'error') throw new Error(r.message);
    if (r.kind !== 'path') throw new Error('unexpected response');
    return r.steps;
  }

  /** The board as text in one of the formats the original could copy. */
  async format(values: number[], cands: number[], mode: CopyFormat): Promise<string> {
    const r = await this.call({ kind: 'format', values, cands, mode });
    if (r.kind === 'error') throw new Error(r.message);
    if (r.kind !== 'format') throw new Error('unexpected response');
    return r.text;
  }

  /** The puzzles of an extended print job, in section order. */
  async book(sections: PrintSection[], techniques: string[]): Promise<PrintSudoku[]> {
    const r = await this.call({ kind: 'book', sections, techniques });
    if (r.kind === 'error') throw new Error(r.message);
    if (r.kind !== 'book') throw new Error('unexpected response');
    return r.puzzles;
  }
}

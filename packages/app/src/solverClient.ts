import type { HintResult, PuzzleInfo, WorkerRequest, WorkerResponse } from './protocol';

type Distribute<T> = T extends unknown ? Omit<T, 'id'> : never;

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
    this.worker = w;
    return w;
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
    for (const p of this.pending.values()) p.reject(new Error('cancelled'));
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

  analyze(puzzle: string): Promise<PuzzleInfo> {
    return this.puzzle({ kind: 'analyze', puzzle });
  }

  async hint(values: number[], cands: number[]): Promise<HintResult | null> {
    const r = await this.call({ kind: 'hint', values, cands });
    if (r.kind === 'error') throw new Error(r.message);
    if (r.kind !== 'hint') throw new Error('unexpected response');
    return r.hint;
  }
}

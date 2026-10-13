/// <reference lib="webworker" />
import type { WorkerRequest, WorkerResponse } from './protocol';
import { allHints, analyze, fromBank, generate, hint } from './solverApi';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  let res: WorkerResponse;
  try {
    if (req.kind === 'generate') res = { id: req.id, kind: 'puzzle', info: generate(req.level) };
    else if (req.kind === 'bank') {
      const info = fromBank(req.level, req.seen) ?? generate(req.level);
      res = { id: req.id, kind: 'puzzle', info };
    } else if (req.kind === 'analyze') res = { id: req.id, kind: 'puzzle', info: analyze(req.puzzle) };
    else if (req.kind === 'allHints') res = { id: req.id, kind: 'allHints', ...allHints(req.values, req.cands, req.level) };
    else res = { id: req.id, kind: 'hint', hint: hint(req.values, req.cands, req.level) };
  } catch (e) {
    res = { id: req.id, kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
  ctx.postMessage(res);
};

/// <reference lib="webworker" />
import type { WorkerRequest, WorkerResponse } from './protocol';
import { allHints, analyze, book, format, fromBank, generate, hint, path, train } from './solverApi';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  let res: WorkerResponse;
  try {
    if (req.kind === 'generate') res = { id: req.id, kind: 'puzzle', info: generate(req.level) };
    else if (req.kind === 'bank') {
      const info = fromBank(req.level, req.seen) ?? generate(req.level);
      res = { id: req.id, kind: 'puzzle', info };
    } else if (req.kind === 'train') res = { id: req.id, kind: 'train', info: train(req.level, req.techniques, req.autoSolve, req.seen) };
    else if (req.kind === 'analyze') res = { id: req.id, kind: 'puzzle', info: analyze(req.puzzle) };
    else if (req.kind === 'allHints') res = { id: req.id, kind: 'allHints', ...allHints(req.values, req.cands, req.level, 12, req.disabled) };
    else if (req.kind === 'path') res = { id: req.id, kind: 'path', steps: path(req.values, req.cands) };
    else if (req.kind === 'format') res = { id: req.id, kind: 'format', text: format(req.values, req.cands, req.mode) };
    else if (req.kind === 'book') res = { id: req.id, kind: 'book', puzzles: book(req.sections, req.techniques) };
    else res = { id: req.id, kind: 'hint', hint: hint(req.values, req.cands, req.level, req.disabled) };
  } catch (e) {
    res = { id: req.id, kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
  ctx.postMessage(res);
};

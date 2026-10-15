/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * The techniques the app offers, grouped by difficulty. Shared by the settings sheet and the
 * training dialog, so both list exactly the same techniques in the same order.
 */
import { SOLUTION_TYPE_INFO, defaultSolverSteps } from '@hodoku/core';

/** The techniques a hint or a training mode may use, grouped by difficulty; INCOMPLETE and GIVE_UP are not real techniques. */
export const TECHNIQUE_GROUPS: [number, { type: string; name: string }[]][] = (() => {
  const byLevel = new Map<number, { type: string; name: string }[]>();
  for (const c of defaultSolverSteps()) {
    if (c.type === 'INCOMPLETE' || c.type === 'GIVE_UP') continue;
    const list = byLevel.get(c.level) ?? [];
    list.push({ type: c.type, name: SOLUTION_TYPE_INFO[c.type].stepName });
    byLevel.set(c.level, list);
  }
  return [...byLevel.entries()].sort((a, b) => a[0] - b[0]);
})();

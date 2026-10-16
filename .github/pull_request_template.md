## Summary

What changes and why, in a few sentences.

## Changes
-

## Verification
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] the affected package's `build` (`pnpm --filter @hodoku/app build` / `pnpm --filter @hodoku/website build`)
- [ ] manual and `docs/PORT-PLAN.md` updated if behaviour changed
- [ ] solver output unchanged (the golden tests in `packages/core` still pass)

Merging to `main` deploys to https://hodokurevisited.com/.

# Contributing

Thank you for helping. Hodoku Revisited is a TypeScript port of HoDoKu, licensed GPL-3.0-or-later; by sending a
pull request you agree that your contribution is licensed the same way.

## How to contribute
1. Fork the repository and create a branch with a short, descriptive name.
2. Make the change and add tests with it. Match the surrounding code (2-space indent, single quotes, semicolons).
3. Run `pnpm typecheck` and `pnpm test`, and the `build` of the package you touched.
4. Open a pull request against `main` and fill in the template. Commit subjects read `Area: summary`
   (for example `App: ...`, `Website: ...`, `Docs: ...`).

Nobody pushes to `main` directly: every change goes through a pull request, and merging one deploys the live site.

## Things to know
- **The solver must keep matching HoDoKu.** `packages/core` is checked step by step against the original; if a golden
  test changes, treat it as a bug in your change, not in the test.
- **Do not copy** the original's data sets, logo or icons, or its GFDL manual text; write new ones.
- **Keep the manual honest.** If you change what the app does, update `packages/website/src/manual.mjs` too.
- Generated files (see `AGENTS.md`) are not edited by hand.

More detail for contributors and tools is in [AGENTS.md](AGENTS.md) and [docs/PORT-PLAN.md](docs/PORT-PLAN.md).

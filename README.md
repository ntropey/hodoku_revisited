# Hodoku Revisited

A modern TypeScript port of [HoDoKu](https://hodoku.sourceforge.net/), the Sudoku
generator, solver, trainer and analyzer. HoDoKu has had no release since 2012;
this project brings it to the web as an installable app (PWA) that runs on phones and desktops, with a new UI.

**Status:** M3 done (mostly), M4 and M5 first versions are in. The core engine solves puzzles with every technique of HoDoKu's
default configuration (singles up to forcing nets, plus brute force), rates their difficulty, generates
puzzles by level, and reads/writes the common text formats. It is verified step by step against the
original Java solver on 587 puzzles. M4 (first version of the PWA in `packages/app`) is in too, and a static website with technique guides (`packages/website`).
The app starts new puzzles instantly from a bank of generated puzzles, and every technique guide has a worked, solver-verified diagram.
The engine now has everything in HoDoKu's default and optional techniques except Siamese/dual variants and ALS nodes in chains: Kraken fish, templates and "find all steps" are in too.
Site ads are gated by a dependency-free EU/UK consent banner (accept or reject, remembered per browser, withdrawable from the footer); it is not a Google-certified CMP. See the plan.

- [Port plan](docs/PORT-PLAN.md)
- [License audit](docs/LICENSE-AUDIT.md)
- [Notice and attribution](NOTICE.md)

## License

GPL-3.0-or-later, as the original. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
Not affiliated with or endorsed by the original author.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @hodoku/app dev     # run the app
pnpm --filter @hodoku/app build   # production build in packages/app/dist
pnpm --filter @hodoku/website build # site (including the app) in packages/website/dist
```

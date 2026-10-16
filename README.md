# Hodoku Revisited

A modern TypeScript port of [HoDoKu](https://hodoku.sourceforge.net/), the Sudoku
generator, solver, trainer and analyzer. HoDoKu has had no release since 2012;
this project brings it to the web as an installable app (PWA) that runs on phones and desktops, with a new UI.

**Status:** live at https://hodokurevisited.com/. The core engine has every technique of HoDoKu 2.2.0's default and
optional configuration (singles up to forcing nets, Kraken fish, templates, "find all steps", brute force), rates
difficulty, generates puzzles by level and reads/writes the common text formats; it is verified step by step against the
original Java solver on 587 puzzles. The app (`packages/app`) is an installable, offline-capable PWA with hints at six
levels, an All steps list, the solution path and summary, pencil marks and a digit filter, manual colouring, ColorKu,
training modes, a puzzle library with history and save points, file open/save, several copy formats, and extended
print. The site (`packages/website`) has 32 technique guides with solver-verified diagrams and a manual. Ads load only
after consent through a dependency-free EU/UK consent banner (it is not a Google-certified CMP). Not done yet: Siamese
and dual fish variants and ALS nodes in chains (core), generator patterns in the app, backdoor search, translations.
See the plan and the feature comparison.

- [Port plan](docs/PORT-PLAN.md)
- [Feature comparison with the original](docs/FEATURE-COMPARISON.md)
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

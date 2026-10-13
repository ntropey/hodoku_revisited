# Hodoku Revisited

A modern TypeScript port of [HoDoKu](https://hodoku.sourceforge.net/), the Sudoku
generator, solver, trainer and analyzer. HoDoKu has had no release since 2012;
this project brings it to a native Windows app (Electron) with a new UI.

**Status:** M1 done. The core engine has the board model, the singles/subsets/locked-candidates
solver and difficulty rating, verified step by step against the original Java solver.
Everything else (fish, chains, ALS, ... , generator, UI) is still to port; see the plan.

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
```

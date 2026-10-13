# Hodoku Revisited

A modern TypeScript port of [HoDoKu](https://hodoku.sourceforge.net/), the Sudoku
generator, solver, trainer and analyzer. HoDoKu has had no release since 2012;
this project brings it to a native Windows app (Electron) with a new UI.

**Status:** M2 done. The core engine solves puzzles with every technique of HoDoKu's default
configuration (singles up to forcing nets) and rates their difficulty, verified step by step against
the original Java solver on 404 puzzles. Still to do: generator, import/export formats, "find all
steps", Kraken fish, the Electron app and the website; see the plan.

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

# Notice and attribution

**Hodoku Revisited** is a TypeScript port and modernization of **HoDoKu**, the
Sudoku generator / solver / trainer / analyzer.

- Original work: HoDoKu, Copyright (C) 2008-2012 Bernhard Hobiger
- Original project: <https://hodoku.sourceforge.net/> and <https://sourceforge.net/projects/hodoku/>
- Ported from: SVN `HoDoKu/tags/release2.2.0` (r117, the last stable release),
  with reference to `HoDoKu/trunk` (r147, unfinished work in progress)

Hodoku Revisited is **not affiliated with or endorsed by** the original author
or the HoDoKu project.

## License

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. See [LICENSE](LICENSE).

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.

Every original HoDoKu source file carries the "GPLv3 or any later version"
header, so this port may be distributed under GPLv3-or-later.

## Credits carried over from the original

- Bernhard Hobiger (hobiwan): author of HoDoKu.
- Glenn Fowler: the puzzle generator (`SudokuGenerator`) is a Java port of code
  he posted on the Sudoku Players' Forum. HoDoKu's author credits him with
  permission to use it. See `docs/LICENSE-AUDIT.md` for the open question about
  that code's own terms.
- ddyer and CCV: contributions credited in the original About dialog.
- MaNik-e Team: co-copyright holder of `RegressionTester.java`.

## Changes

This port is a rewrite in TypeScript. All files in this repository that derive
from HoDoKu are modified versions and are marked as such. The history of
changes is the git history of this repository.

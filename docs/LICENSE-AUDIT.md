# License audit

Scope: SVN `HoDoKu/tags/release2.2.0` and `HoDoKu/trunk` (r147), downloaded
2026-10-13 from the SourceForge web file browser. This is an engineering review,
not legal advice.

## Summary

The port can be released under **GPLv3-or-later**. No blocker found. Four items
need follow-up (below).

## Findings

| # | Finding | Evidence | Action |
|---|---|---|---|
| 1 | The program is GPLv3 **or any later version** | 77 of 78 Java files in 2.2.0 carry the standard header: "either version 3 of the License, or (at your option) any later version" | License the port GPLv3-or-later. |
| 2 | `COPYING` (GPLv3 text) exists in the 2.2.0 tag, not in trunk | `tags/release2.2.0/COPYING`, 674 lines | Copied to `LICENSE`. |
| 3 | `ColorKuImage.java` has no license header | Only the NetBeans template comment; author tag `hobiwan` | Same author and project, so treat as covered by the project license. Flag in the file mapping. |
| 4 | `RegressionTester.java` has a second copyright holder | "Copyright (C) 2008-12 Bernhard Hobiger, MaNik-e Team" | Same GPL header. Keep the credit in `NOTICE.md`. |
| 5 | Third-party origin: puzzle generator | `generator/SudokuGenerator.java`: "a Java port of code posted by Glenn Fowler in the Sudoku Player's Forum ... Many thanks for letting me use it!" | **Open.** Permission was given to Hobiger, and the code was released as part of GPL HoDoKu. We are a derivative of that GPL release, so this is very likely fine. We can't confirm Fowler's own terms. Mitigation: keep the credit, and consider rewriting the generator from the algorithm description. |
| 6 | Data sets of unknown provenance | `sudoku17_20100413.txt`, `q2-taxonomy.txt`, `reglib-*.txt`, `exemplars-*.txt`, `templates.dat` | **Do not copy into the repo.** These are puzzle collections and pattern libraries compiled by community members. Regenerate what we need, or verify provenance first. `templates.dat` is generated and can be rebuilt by code. |
| 7 | Icons and images | 63 PNG, 1 GIF, 1 ICO in `src/img` (including `hodoku02-*` logo and `gplv3-127x51.png`) | No per-file license stated. Treat as GPL as part of the program, but create **new** icons and a new logo for Hodoku Revisited. Do not use the original logo. |
| 8 | Website/manual is GFDL 1.3 | "All material on this page is licensed under the GNU FDLv1.3" | GFDL and GPL are not compatible for mixing. Write new docs. If we reuse manual text, keep it in a separate GFDL-labeled area. |
| 9 | Name | No trademark statement found, not verified against trademark registries | Use "Hodoku Revisited" plus the "not affiliated" notice. |
| 10 | `trunk` is unfinished (r147 "Tabling new, work in progress...") | `trunk/ToDo.txt`, commit message | Port from the 2.2.0 tag. Use trunk only as reference. |

## Obligations when distributing

- Ship the GPLv3 text and make corresponding source available with every installer.
- Keep Hobiger's copyright notices and mark our changes.
- Don't add terms that restrict GPL freedoms. This matters for app stores whose terms can conflict with GPL, so ship via our own site and GitHub Releases first.
- Don't use the original logo or imply endorsement.

## Next steps

1. Decide on the Fowler generator question (rewrite vs. keep with credit).
2. Verify provenance of any data sets before shipping them.
3. Make new icons and logo.
4. Have a lawyer review if we ever distribute commercially.

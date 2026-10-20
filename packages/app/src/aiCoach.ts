/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Symbolic AI Coach & Contradiction Prover built on @hodoku/core.
 * Turns any SolutionStep into a progressive Socratic walkthrough, and proves why a wrong candidate fails.
 */
import {
  Sudoku2,
  SudokuGenerator,
  SudokuSolver,
  SudokuStepFinder,
  cellName,
  chainNotation,
  defaultSolverSteps,
  tables,
  type SolutionStep,
  type StepMark,
  type StepMarks,
} from '@hodoku/core';
import type { CoachStage, ProofResult } from './protocol';

function emptyMarks(digits: number[] = []): StepMarks {
  return { key: [], fins: [], elim: [], place: [], colors: [], tint: [], chains: [], digits };
}

function unitName(type: number, number: number): string {
  if (type === tables.LINE) return `Row ${number}`;
  if (type === tables.COL) return `Column ${number}`;
  return `Box ${number}`;
}

function unitIdxName(u: number): string {
  if (u < 9) return `Row ${u + 1}`;
  if (u < 18) return `Column ${u - 8}`;
  return `Box ${u - 17}`;
}

function uniqueCells(list: readonly { cell: number }[]): number[] {
  return [...new Set(list.map((x) => x.cell))];
}

function cellNames(cells: readonly number[]): string {
  return cells.map(cellName).join(', ');
}

/** Find a house (row, column or box) shared by all `cells`, if any. */
function sharedHouse(cells: readonly number[]): { idx: number; name: string; unitCells: readonly number[] } | null {
  if (cells.length === 0) return null;
  for (let u = 0; u < tables.ALL_UNITS.length; u++) {
    const unit = tables.ALL_UNITS[u];
    if (cells.every((c) => unit.includes(c))) {
      return { idx: u, name: unitIdxName(u), unitCells: unit };
    }
  }
  return null;
}

/** List the candidate digits (1-9) currently available in `cell` on `board`. */
function cellCandidates(board: Sudoku2, cell: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (board.isCandidate(cell, d)) out.push(d);
  return out;
}

/** Build a progressive 4-stage Socratic walkthrough for `step` on `before`. */
export function buildCoachStages(
  step: SolutionStep,
  before: Sudoku2,
  marks: StepMarks,
  name: string,
  summary: string,
): CoachStage[] {
  const t = step.type;
  const digits = marks.digits;
  const d0 = digits[0] ?? step.values[0] ?? 0;
  const keyCells = uniqueCells(marks.key);
  const elimCells = uniqueCells(marks.elim);
  const finCells = uniqueCells(marks.fins);

  // Stage 1 marks: only tint the relevant houses so the player knows where to scan without spoiling the exact cells.
  const nudgeTint: StepMarks['tint'] =
    marks.tint.length > 0
      ? marks.tint
      : (() => {
          const focus = marks.place.length > 0 ? uniqueCells(marks.place) : keyCells.length > 0 ? keyCells : step.indices;
          const house = sharedHouse(focus);
          if (house) return [{ cells: [...house.unitCells], tone: 'a' as const }];
          if (focus.length > 0) {
            const r = tables.getLine(focus[0]);
            return [{ cells: [...tables.LINES[r]], tone: 'a' as const }];
          }
          return [];
        })();

  const stage1Marks: StepMarks = { ...emptyMarks(digits), tint: nudgeTint };

  // Stage 2 marks: highlight the pattern (key, fins, colors, tint) without revealing the placement or eliminations yet.
  const stage2Marks: StepMarks = {
    ...emptyMarks(digits),
    tint: marks.tint.length > 0 ? marks.tint : nudgeTint,
    key: marks.key,
    fins: marks.fins,
    colors: marks.colors,
  };

  // Stage 3 marks: include chains as well.
  const stage3Marks: StepMarks = {
    ...stage2Marks,
    chains: marks.chains,
  };

  // --- Singles: FULL_HOUSE, NAKED_SINGLE, HIDDEN_SINGLE ---
  if (t === 'FULL_HOUSE' || t === 'NAKED_SINGLE' || t === 'HIDDEN_SINGLE') {
    const cell = step.indices[0];
    const cname = cellName(cell);
    const house = marks.tint[0]
      ? tables.ALL_UNITS.findIndex((u) => u.length === marks.tint[0].cells.length && u.every((c, i) => c === marks.tint[0].cells[i]))
      : -1;
    const hName = house >= 0 ? unitIdxName(house) : `Row ${tables.getLine(cell) + 1}, Column ${tables.getCol(cell) + 1}, and Box ${tables.getBlock(cell) + 1}`;

    if (t === 'FULL_HOUSE') {
      const filledPeers = (house >= 0 ? tables.ALL_UNITS[house] : tables.LINES[tables.getLine(cell)])
        .filter((c) => c !== cell && before.values[c] !== 0)
        .map((c) => ({ cell: c, digit: before.values[c] }));
      return [
        {
          label: 'Where to look',
          text: `Look at ${hName} (tinted on the board). Count how many cells are already filled in that house.`,
          marks: stage1Marks,
        },
        {
          label: 'The pattern',
          text: `Eight of the nine cells in ${hName} are already placed, leaving ${cname} as the only empty cell (${name}).`,
          marks: { ...stage1Marks, key: filledPeers },
        },
        {
          label: 'The logic',
          text: `Every house must contain digits 1 through 9. Digit ${d0} is the only number missing from ${hName}.`,
          marks: { ...stage1Marks, key: filledPeers },
        },
        {
          label: 'Conclusion',
          text: `Place ${d0} in ${cname}.`,
          marks,
        },
      ];
    }

    if (t === 'HIDDEN_SINGLE') {
      const unitCells = house >= 0 ? tables.ALL_UNITS[house] : tables.BLOCKS[tables.getBlock(cell)];
      // Find peer cells that block `d0` from the other empty cells in `unitCells`
      const blockers: StepMark[] = [];
      for (const other of unitCells) {
        if (other === cell || before.values[other] !== 0) continue;
        for (const peer of tables.BUDDIES[other]) {
          if (before.values[peer] === d0 && !blockers.some((b) => b.cell === peer)) {
            blockers.push({ cell: peer, digit: d0 });
            break;
          }
        }
      }
      return [
        {
          label: 'Where to look',
          text: `Scan ${hName} (tinted on the board) and ask where digit ${d0} can go.`,
          marks: stage1Marks,
        },
        {
          label: 'The pattern',
          text: `Intersecting digits ${blockers.length > 0 ? `(${blockers.map((b) => `${d0} in ${cellName(b.cell)}`).join(', ')}) ` : ''}rule out ${d0} from every other empty cell in ${hName}.`,
          marks: { ...stage1Marks, key: blockers },
        },
        {
          label: 'The logic',
          text: `Even if ${cname} has other pencil marks (${cellCandidates(before, cell).join(', ')}), it is the only cell in ${hName} that can still accept ${d0} (${name}).`,
          marks: { ...stage1Marks, key: [{ cell, digit: d0 }] },
        },
        {
          label: 'Conclusion',
          text: `Place ${d0} in ${cname}.`,
          marks,
        },
      ];
    }

    // NAKED_SINGLE
    const seenPeers: StepMark[] = [];
    const seenDigits = new Set<number>();
    for (const peer of tables.BUDDIES[cell]) {
      const v = before.values[peer];
      if (v !== 0 && v !== d0 && !seenDigits.has(v)) {
        seenDigits.add(v);
        seenPeers.push({ cell: peer, digit: v });
      }
    }
    const rowColBox = `Row ${tables.getLine(cell) + 1}, Column ${tables.getCol(cell) + 1}, and Box ${tables.getBlock(cell) + 1}`;
    return [
      {
        label: 'Where to look',
        text: `Look at the intersection of ${rowColBox} for a cell that sees almost every digit from 1 to 9.`,
        marks: stage1Marks,
      },
      {
        label: 'The pattern',
        text: `Cell ${cname} directly sees ${seenPeers
          .slice(0, 8)
          .map((p) => `${p.digit} (${cellName(p.cell)})`)
          .join(', ')} in its peers.`,
        marks: { ...stage1Marks, key: seenPeers },
      },
      {
        label: 'The logic',
        text: `All eight other digits are already present in ${cname}'s row, column, or box, leaving ${d0} as its sole remaining candidate (${name}).`,
        marks: { ...stage1Marks, key: [{ cell, digit: d0 }] },
      },
      {
        label: 'Conclusion',
        text: `Place ${d0} in ${cname}.`,
        marks,
      },
    ];
  }

  // --- Locked Candidates (Pointing / Claiming) ---
  if (t === 'LOCKED_CANDIDATES_1' || t === 'LOCKED_CANDIDATES_2') {
    const cells = step.indices.length > 0 ? step.indices : keyCells;
    const boxNum = tables.getBlock(cells[0]) + 1;
    const isRow = cells.every((c) => tables.getLine(c) === tables.getLine(cells[0]));
    const lineName = isRow ? `Row ${tables.getLine(cells[0]) + 1}` : `Column ${tables.getCol(cells[0]) + 1}`;
    const [primaryHouse, secondaryHouse] = t === 'LOCKED_CANDIDATES_1' ? [`Box ${boxNum}`, lineName] : [lineName, `Box ${boxNum}`];
    return [
      {
        label: 'Where to look',
        text: `Examine candidate ${d0} where ${primaryHouse} and ${secondaryHouse} intersect.`,
        marks: stage1Marks,
      },
      {
        label: 'The pattern',
        text: `Inside ${primaryHouse}, every remaining candidate for ${d0} is confined to ${cellNames(cells)}, which all lie in ${secondaryHouse} (${name}).`,
        marks: stage2Marks,
      },
      {
        label: 'The logic',
        text: `Because ${primaryHouse} must contain a ${d0}, one of ${cellNames(cells)} must be ${d0}. No other cell in ${secondaryHouse} outside ${primaryHouse} can hold ${d0}.`,
        marks: stage3Marks,
      },
      {
        label: 'Conclusion',
        text: `Eliminate ${d0} from ${cellNames(elimCells)} in ${secondaryHouse}.`,
        marks,
      },
    ];
  }

  // --- Naked / Hidden / Locked Subsets ---
  if (
    t === 'NAKED_PAIR' ||
    t === 'NAKED_TRIPLE' ||
    t === 'NAKED_QUADRUPLE' ||
    t === 'HIDDEN_PAIR' ||
    t === 'HIDDEN_TRIPLE' ||
    t === 'HIDDEN_QUADRUPLE' ||
    t === 'LOCKED_PAIR' ||
    t === 'LOCKED_TRIPLE'
  ) {
    const cells = step.indices.length > 0 ? step.indices : keyCells;
    const house = sharedHouse(cells);
    const hName = house ? house.name : `Row ${tables.getLine(cells[0]) + 1} / Box ${tables.getBlock(cells[0]) + 1}`;
    const dList = digits.join(', ');
    const isHidden = t.startsWith('HIDDEN_');
    return [
      {
        label: 'Where to look',
        text: `Look closely at ${hName} and trace the candidates for digits {${dList}}.`,
        marks: stage1Marks,
      },
      {
        label: 'The pattern',
        text: isHidden
          ? `Within ${hName}, the ${digits.length} digits {${dList}} appear as candidates only in the ${cells.length} cells ${cellNames(cells)} (${name}).`
          : `In ${hName}, the ${cells.length} cells ${cellNames(cells)} contain no candidates other than {${dList}} (${name}).`,
        marks: stage2Marks,
      },
      {
        label: 'The logic',
        text: isHidden
          ? `Because those ${digits.length} digits must go into those ${cells.length} cells in some order, no other digit can fit inside ${cellNames(cells)}.`
          : `Because ${cellNames(cells)} must use up all ${digits.length} digits {${dList}} among themselves, no other cell seeing all of them can contain {${dList}}.`,
        marks: stage3Marks,
      },
      {
        label: 'Conclusion',
        text: `Remove ${[...new Set(marks.elim.map((e) => e.digit))].sort().join(', ')} from ${cellNames(elimCells)}.`,
        marks,
      },
    ];
  }

  // --- Single-digit patterns: Skyscraper, 2-String Kite, Empty Rectangle ---
  if (t === 'SKYSCRAPER' || t === 'TWO_STRING_KITE' || t === 'EMPTY_RECTANGLE') {
    return [
      {
        label: 'Where to look',
        text: `Scan the board for strong links on digit ${d0}.`,
        marks: stage1Marks,
      },
      {
        label: 'The pattern',
        text: `Candidate ${d0} forms a ${name} across ${cellNames(keyCells)}${finCells.length ? ` connected via ${cellNames(finCells)}` : ''}.`,
        marks: stage2Marks,
      },
      {
        label: 'The logic',
        text: `${summary} At least one endpoint of the pattern must hold ${d0}, so any cell that sees both endpoints cannot be ${d0}.`,
        marks: stage3Marks,
      },
      {
        label: 'Conclusion',
        text: `Eliminate ${d0} from ${cellNames(elimCells)}.`,
        marks,
      },
    ];
  }

  // --- Wings: XY-Wing, XYZ-Wing, W-Wing ---
  if (t === 'XY_WING' || t === 'XYZ_WING' || t === 'W_WING') {
    const wingCells = step.indices.length > 0 ? step.indices : keyCells;
    const elimDigit = marks.elim[0]?.digit ?? d0;
    if (t === 'XY_WING' || t === 'XYZ_WING') {
      // Find the pivot: the wing cell that sees the other two wing cells
      const pivot =
        wingCells.find((c) => wingCells.every((o) => o === c || tables.BUDDIES[c].contains(o))) ?? wingCells[0];
      const pincers = wingCells.filter((c) => c !== pivot);
      const pivotCands = cellCandidates(before, pivot).join(', ');
      return [
        {
          label: 'Where to look',
          text: `Look around ${cellName(pivot)} for a ${name} involving candidates {${digits.join(', ')}}.`,
          marks: stage1Marks,
        },
        {
          label: 'The pattern',
          text: `Pivot cell ${cellName(pivot)} ({${pivotCands}}) sees two pincer cells: ${pincers.map((p) => `${cellName(p)} ({${cellCandidates(before, p).join(', ')}})`).join(' and ')}.`,
          marks: stage2Marks,
        },
        {
          label: 'The logic',
          text: `Whichever candidate is placed in pivot ${cellName(pivot)}, digit ${elimDigit} is forced into one of the wing cells (${cellNames(t === 'XYZ_WING' ? wingCells : pincers)}).`,
          marks: stage3Marks,
        },
        {
          label: 'Conclusion',
          text: `Any cell seeing ${t === 'XYZ_WING' ? 'the pivot and both pincers' : 'both pincers'} cannot be ${elimDigit}: eliminate ${elimDigit} from ${cellNames(elimCells)}.`,
          marks,
        },
      ];
    }
    // W_WING
    return [
      {
        label: 'Where to look',
        text: `Look for two identical bivalue cells with candidates {${digits.join(', ')}} linked by a conjugate pair.`,
        marks: stage1Marks,
      },
      {
        label: 'The pattern',
        text: `Bivalue cells ${cellNames(keyCells)} and connecting cells ${cellNames(finCells)} form a ${name} on digits {${digits.join(', ')}}.`,
        marks: stage2Marks,
      },
      {
        label: 'The logic',
        text: `The strong link on ${finCells.length && marks.fins[0] ? marks.fins[0].digit : digits[0]} guarantees that at least one of the two bivalue endpoints must hold ${elimDigit}.`,
        marks: stage3Marks,
      },
      {
        label: 'Conclusion',
        text: `Eliminate ${elimDigit} from ${cellNames(elimCells)}, which sees both ends of the W-Wing.`,
        marks,
      },
    ];
  }

  // --- Fish (Basic, Finned, Sashimi, Franken, Mutant, Kraken) ---
  if (step.baseEntities.length > 0) {
    const bases = step.baseEntities.map((e) => unitName(e.type, e.number)).join(', ');
    const covers = step.coverEntities.map((e) => unitName(e.type, e.number)).join(', ');
    const hasFins = finCells.length > 0;
    const hasChains = marks.chains.length > 0;
    return [
      {
        label: 'Where to look',
        text: `Scan ${bases} (tinted on the board) for all candidate positions of digit ${d0}.`,
        marks: { ...emptyMarks(digits), tint: marks.tint.filter((x) => x.tone === 'a') },
      },
      {
        label: 'The pattern',
        text: `Across base ${bases}, candidate ${d0} is restricted to ${cellNames(keyCells)}, which align with cover ${covers}${hasFins ? ` plus fin(s) at ${cellNames(finCells)}` : ''} (${name}).`,
        marks: stage2Marks,
      },
      {
        label: 'The logic',
        text: hasChains
          ? `Whether the fish holds or a fin is true, the chains (${marks.chains.map((c) => chainNotation(c)).join('; ')}) prove the same elimination.`
          : hasFins
            ? `Either the fish places ${d0} in each of ${covers}, or one of the fins (${cellNames(finCells)}) is ${d0}. Any cell seeing both the cover units and all fins cannot be ${d0}.`
            : `Because ${ step.baseEntities.length } base units must each get a ${d0}, they lock ${d0} into the ${step.coverEntities.length} cover units (${covers}).`,
        marks: stage3Marks,
      },
      {
        label: 'Conclusion',
        text: `Eliminate ${d0} from ${cellNames(elimCells)}.`,
        marks,
      },
    ];
  }

  // --- Almost Locked Sets (ALS-XZ, ALS-XY-Wing, ALS-Chain, Death Blossom) ---
  if (step.alses.length > 0) {
    const alsDesc = step.alses
      .map((a, i) => {
        const cands: number[] = [];
        for (let d = 1; d <= 9; d++) if ((a.candidates & (1 << (d - 1))) !== 0) cands.push(d);
        return `ALS ${String.fromCharCode(65 + i)} (${cellNames(a.indices)} with {${cands.join(', ')}})`;
      })
      .join('; ');
    const rcs = step.restrictedCommons
      .map((rc) => [rc.cand1, rc.cand2].filter((c) => c !== 0).join(', '))
      .filter(Boolean)
      .join('; ');
    return [
      {
        label: 'Where to look',
        text: `Look at the tinted groups of cells for Almost Locked Sets (N cells containing N+1 candidates).`,
        marks: stage1Marks,
      },
      {
        label: 'The pattern',
        text: `${name}: ${alsDesc}.`,
        marks: stage2Marks,
      },
      {
        label: 'The logic',
        text: `Linked by restricted common candidate(s) ${rcs || digits.join(', ')}, the sets cannot all contain their restricted common at once, locking the elimination digit into at least one ALS.`,
        marks: stage3Marks,
      },
      {
        label: 'Conclusion',
        text: `Eliminate ${[...new Set(marks.elim.map((e) => e.digit))].sort().join(', ')} from ${cellNames(elimCells)}.`,
        marks,
      },
    ];
  }

  // --- Coloring (Simple Colors, Multi Colors) ---
  if (marks.colors.length > 0) {
    const c0 = uniqueCells(marks.colors.filter((c) => c.color % 2 === 0));
    const c1 = uniqueCells(marks.colors.filter((c) => c.color % 2 === 1));
    return [
      {
        label: 'Where to look',
        text: `Follow the conjugate pairs (units where digit ${d0} has only two positions) across the board.`,
        marks: stage1Marks,
      },
      {
        label: 'The pattern',
        text: `Coloring the conjugate links of digit ${d0} splits them into two parities: Group A (${cellNames(c0)}) and Group B (${cellNames(c1)}) (${name}).`,
        marks: stage2Marks,
      },
      {
        label: 'The logic',
        text: `${summary} All cells of one parity are either simultaneously true or simultaneously false.`,
        marks: stage3Marks,
      },
      {
        label: 'Conclusion',
        text: `Eliminate ${d0} from ${cellNames(elimCells)}.`,
        marks,
      },
    ];
  }

  // --- Chains, Loops, and Forcing Chains/Nets ---
  if (marks.chains.length > 0) {
    const firstChain = marks.chains[0];
    const start = firstChain[0];
    const end = firstChain[firstChain.length - 1];
    const chainStr = marks.chains.map((c) => chainNotation(c)).join(' ; ');
    return [
      {
        label: 'Where to look',
        text: `Look for an alternating chain starting at ${start ? `${start.digit} in ${cellName(start.cell)}` : 'the key cells'} and reaching ${end ? `${end.digit} in ${cellName(end.cell)}` : 'the target'}.`,
        marks: {
          ...emptyMarks(digits),
          key: [start, end].filter((x): x is StepMark => Boolean(x)),
        },
      },
      {
        label: 'The pattern',
        text: `${name} connects ${cellNames(keyCells)} through alternating strong (=) and weak (-) links.`,
        marks: stage2Marks,
      },
      {
        label: 'The logic',
        text: `Follow the chain on the board: ${chainStr}. ${summary}`,
        marks: stage3Marks,
      },
      {
        label: 'Conclusion',
        text:
          marks.place.length > 0
            ? `Place ${marks.place.map((p) => `${p.digit} in ${cellName(p.cell)}`).join('; ')}.`
            : `Eliminate ${[...new Set(marks.elim.map((e) => e.digit))].sort().join(', ')} from ${cellNames(elimCells)}.`,
        marks,
      },
    ];
  }

  // --- Uniqueness, Sue de Coq, Templates, Brute Force, and any other step ---
  const actionText =
    marks.place.length > 0 && marks.elim.length === 0
      ? `Place ${marks.place.map((p) => `${p.digit} in ${cellName(p.cell)}`).join('; ')}.`
      : `Eliminate ${[...new Set(marks.elim.map((e) => e.digit))].sort().join(', ')} from ${cellNames(elimCells)}.`;

  return [
    {
      label: 'Where to look',
      text: `Examine ${cellNames(keyCells.length ? keyCells : step.indices)} for a ${name} involving digit(s) ${digits.join(', ')}.`,
      marks: stage1Marks,
    },
    {
      label: 'The pattern',
      text: `The candidates in ${cellNames(keyCells.length ? keyCells : step.indices)} form a ${name}.`,
      marks: stage2Marks,
    },
    {
      label: 'The logic',
      text: summary || `Applying ${name} on ${cellNames(keyCells.length ? keyCells : step.indices)} forces the next move.`,
      marks: stage3Marks,
    },
    {
      label: 'Conclusion',
      text: actionText,
      marks,
    },
  ];
}

/** Build a Sudoku2 board matching the player's current values and candidate masks (bit d = digit d). */
function toBoard(values: readonly number[], cands: readonly number[]): Sudoku2 {
  const s = new Sudoku2();
  s.setSudoku(values.map((v) => (v === 0 ? '.' : String(v))).join(''));
  for (let i = 0; i < 81; i++) {
    if (values[i] !== 0) continue;
    for (let d = 1; d <= 9; d++) {
      if (s.isCandidate(i, d) && (cands[i] & (1 << d)) === 0) s.setCandidate(i, d, false);
    }
  }
  return s;
}

interface ForcedMove {
  cell: number;
  digit: number;
  reason: string;
}

interface Contradiction {
  kind: 'empty-cell' | 'starved-unit';
  cell?: number;
  unitIdx?: number;
  digit?: number;
  text: string;
  marks: StepMarks;
}

/** Check if `board` has hit an immediate contradiction (an empty cell with 0 candidates or a house with nowhere for a digit). */
function findContradiction(board: Sudoku2, original: Sudoku2): Contradiction | null {
  // 1. Any unsolved cell with 0 candidates left?
  for (let c = 0; c < 81; c++) {
    if (board.values[c] === 0 && board.cells[c] === 0) {
      const origCands = cellCandidates(original, c);
      const blockers: StepMark[] = [];
      for (const d of origCands) {
        for (const peer of tables.BUDDIES[c]) {
          if (board.values[peer] === d) {
            blockers.push({ cell: peer, digit: d });
            break;
          }
        }
      }
      return {
        kind: 'empty-cell',
        cell: c,
        text: `Cell ${cellName(c)} has no valid candidates left (its candidates {${origCands.join(', ')}} are all taken by peers ${blockers.map((b) => `${b.digit} in ${cellName(b.cell)}`).join(', ')})`,
        marks: {
          ...emptyMarks(origCands),
          key: blockers,
          elim: origCands.map((d) => ({ cell: c, digit: d })),
          tint: [{ cells: [c], tone: 'b' }],
        },
      };
    }
  }
  // 2. Any unit where an unplaced digit has 0 candidate positions left?
  for (let u = 0; u < tables.ALL_UNITS.length; u++) {
    const unit = tables.ALL_UNITS[u];
    for (let d = 1; d <= 9; d++) {
      const placed = unit.some((c) => board.values[c] === d);
      if (!placed && board.free[u][d] === 0) {
        const origSpots = unit.filter((c) => original.values[c] === 0 && original.isCandidate(c, d));
        return {
          kind: 'starved-unit',
          unitIdx: u,
          digit: d,
          text: `${unitIdxName(u)} has no valid cell left where digit ${d} can go`,
          marks: {
            ...emptyMarks([d]),
            elim: origSpots.map((c) => ({ cell: c, digit: d })),
            tint: [{ cells: [...unit], tone: 'b' }],
          },
        };
      }
    }
  }
  return null;
}

/**
 * Filter a sequence of forced moves down to the causal chain that actually contributed to the contradiction,
 * walking backwards from `affectedCells` through peer relationships.
 */
function pruneCausalMoves(moves: readonly ForcedMove[], rootCell: number, affectedCells: readonly number[]): ForcedMove[] {
  const needed = new Set<number>(affectedCells);
  const kept: ForcedMove[] = [];
  for (let i = moves.length - 1; i >= 0; i--) {
    const m = moves[i];
    const seesNeeded = [...needed].some((c) => c === m.cell || tables.BUDDIES[m.cell].contains(c));
    if (seesNeeded) {
      kept.unshift(m);
      needed.add(m.cell);
    }
  }
  // Keep at most 5 intermediate steps so the walkthrough stays crisp and readable
  return kept.length <= 5 ? kept : [...kept.slice(0, 2), ...kept.slice(-3)];
}

/**
 * Prove why placing `digit` in `cell` works or leads to a contradiction ("Why not D in rXcY?").
 * Traces forced singles and logical consequences and builds an interactive CoachStage[] walkthrough.
 */
export function proveCandidate(values: readonly number[], cands: readonly number[], cell: number, digit: number): ProofResult {
  const cname = cellName(cell);
  const currentVal = values[cell];
  // If `cell` already has `digit` placed (e.g. testing a placed wrong value), clear `cell` first so we test placing `digit` on the rest of the board.
  const cleanValues = currentVal !== 0 ? values.map((v, i) => (i === cell ? 0 : v)) : values;
  const baseBoard = toBoard(cleanValues, cands);

  // 1. Check direct peer conflict in the same row, column, or box
  for (const peer of tables.BUDDIES[cell]) {
    if (cleanValues[peer] === digit) {
      const shared = sharedHouse([cell, peer]);
      const hName = shared ? shared.name : 'the same unit';
      const marks: StepMarks = {
        ...emptyMarks([digit]),
        key: [{ cell: peer, digit }],
        elim: [{ cell, digit }],
        tint: shared ? [{ cells: [...shared.unitCells], tone: 'a' }] : [],
      };
      return {
        cell,
        digit,
        verdict: 'conflict',
        headline: `${digit} is already placed in ${cellName(peer)} (${hName}).`,
        stages: [
          {
            label: 'Direct conflict',
            text: `Cell ${cellName(peer)} in ${hName} already contains ${digit}, so ${cname} cannot also be ${digit}.`,
            marks,
          },
        ],
      };
    }
  }

  // 2. Clone the board, place `digit` in `cell`, and propagate forced singles step by step
  const work = baseBoard.clone();
  work.setCell(cell, digit);
  const finder = new SudokuStepFinder();
  const solver = new SudokuSolver();
  const moves: ForcedMove[] = [];
  let contradiction = findContradiction(work, baseBoard);

  for (let iter = 0; iter < 81 && !contradiction; iter++) {
    const nextSingle =
      finder.findAllFullHouses(work)[0] ?? finder.findAllNakedSingles(work)[0] ?? finder.findAllHiddenSingles(work)[0];
    if (!nextSingle) break;
    const sc = nextSingle.indices[0];
    const sd = nextSingle.values[0];
    let reason = 'only candidate left in the cell';
    if (nextSingle.type === 'FULL_HOUSE' || nextSingle.type === 'HIDDEN_SINGLE') {
      const unit = tables.ALL_UNITS.findIndex((u) => u.includes(sc) && u.filter((c) => work.values[c] === 0 && work.isCandidate(c, sd)).length === 1);
      reason = unit >= 0 ? `only place left for ${sd} in ${unitIdxName(unit)}` : `only place left for ${sd}`;
    }
    solver.doStep(work, nextSingle);
    moves.push({ cell: sc, digit: sd, reason });
    contradiction = findContradiction(work, baseBoard);
  }

  if (contradiction) {
    const affected =
      contradiction.kind === 'empty-cell' && contradiction.cell !== undefined
        ? [contradiction.cell]
        : contradiction.unitIdx !== undefined
          ? [...tables.ALL_UNITS[contradiction.unitIdx]]
          : [cell];
    const causal = pruneCausalMoves(moves, cell, affected);
    const chainNodes: StepMark[] = [{ cell, digit, strong: false }, ...causal.map((m) => ({ cell: m.cell, digit: m.digit, strong: true }))];

    const stages: CoachStage[] = [
      {
        label: 'Assume',
        text: `Suppose we place ${digit} in ${cname}. That immediately rules out ${digit} from every peer in Row ${tables.getLine(cell) + 1}, Column ${tables.getCol(cell) + 1}, and Box ${tables.getBlock(cell) + 1}.`,
        marks: {
          ...emptyMarks([digit]),
          key: [{ cell, digit }],
          tint: [{ cells: [cell], tone: 'a' }],
        },
      },
    ];

    causal.forEach((m, idx) => {
      const prefix = chainNodes.slice(0, idx + 2);
      stages.push({
        label: `Forced move ${idx + 1}`,
        text: `That forces ${m.digit} into ${cellName(m.cell)} (${m.reason}).`,
        marks: {
          ...emptyMarks([digit, m.digit]),
          key: prefix,
          chains: [prefix],
          tint: [{ cells: [m.cell], tone: 'a' }],
        },
      });
    });

    stages.push({
      label: 'Contradiction',
      text: `Contradiction! ${contradiction.text}. Therefore, ${cname} cannot be ${digit}.`,
      marks: {
        ...contradiction.marks,
        key: [...chainNodes, ...contradiction.marks.key],
        chains: chainNodes.length > 1 ? [chainNodes] : [],
      },
    });

    return {
      cell,
      digit,
      verdict: 'conflict',
      headline:
        causal.length === 0
          ? `Placing ${digit} in ${cname} immediately causes a contradiction.`
          : `Placing ${digit} in ${cname} leads to a contradiction in ${causal.length} forced ${causal.length === 1 ? 'move' : 'moves'}.`,
      stages,
    };
  }

  // 3. No immediate singles contradiction: check whether `digit` in `cell` is solvable or invalid
  const gen = new SudokuGenerator();
  const givensBoard = new Sudoku2();
  givensBoard.setSudoku(cleanValues.map((v, i) => (i === cell ? String(digit) : v === 0 ? '.' : String(v))).join(''));
  const solCount = gen.getNumberOfSolutions(givensBoard);

  if (solCount > 0) {
    return {
      cell,
      digit,
      verdict: 'valid',
      headline: `${digit} is actually the correct digit for ${cname}!`,
      stages: [
        {
          label: 'Valid placement',
          text: `Placing ${digit} in ${cname} leads to no contradictions—it matches the unique solution! Ask for a Hint to see how to prove it from the current board.`,
          marks: {
            ...emptyMarks([digit]),
            place: [{ cell, digit }],
            tint: [{ cells: [cell], tone: 'a' }],
          },
        },
      ],
    };
  }

  // 4. `digit` in `cell` has 0 solutions, even though singles alone didn't finish the refutation:
  // Run the full solver on `baseBoard` to see if the next logical step or a deeper contradiction refutes it.
  const fullWork = work.clone();
  solver.setSudoku(fullWork);
  const configs = defaultSolverSteps();
  for (let stepIdx = 0; stepIdx < 60 && !contradiction; stepIdx++) {
    const step = solver.getHint(false, configs);
    if (!step || step.type === 'GIVE_UP' || step.type === 'INCOMPLETE' || step.type === 'BRUTE_FORCE') break;
    solver.doStep(fullWork, step);
    for (const idx of step.indices) {
      if (fullWork.values[idx] !== 0) {
        moves.push({ cell: idx, digit: fullWork.values[idx], reason: `by ${step.type}` });
      }
    }
    contradiction = findContradiction(fullWork, baseBoard);
  }

  return {
    cell,
    digit,
    verdict: 'conflict',
    headline: `Placing ${digit} in ${cname} leaves the puzzle with no valid solution.`,
    stages: [
      {
        label: 'Assume',
        text: `Suppose we place ${digit} in ${cname}.`,
        marks: {
          ...emptyMarks([digit]),
          key: [{ cell, digit }],
          tint: [{ cells: [cell], tone: 'a' }],
        },
      },
      {
        label: 'Contradiction',
        text: contradiction
          ? `After propagating deductions (${moves.length} forced steps), ${contradiction.text}. Therefore, ${cname} cannot be ${digit}.`
          : `After propagating ${moves.length} forced placements, the remaining candidates admit zero valid completions of the grid. Therefore, ${cname} cannot be ${digit}.`,
        marks: {
          ...emptyMarks([digit]),
          elim: [{ cell, digit }],
          key: moves.slice(0, 6).map((m) => ({ cell: m.cell, digit: m.digit })),
          tint: [{ cells: [cell], tone: 'b' }],
        },
      },
    ],
  };
}

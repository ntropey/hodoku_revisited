/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's GroupNode (Java).
 */
import { SudokuSet } from '../sudokuSet.js';
import { BLOCK_TEMPLATES, BUDDIES, COL_TEMPLATES, LINE_TEMPLATES, getBlock, getCol, getLine } from '../tables.js';

/** Two or three cells of one block in one line or column that hold a candidate (a "grouped" link end). */
export class GroupNode {
  /** the cells of the node */
  readonly indices = new SudokuSet();
  /** all cells that see all cells in the group node */
  readonly buddies = new SudokuSet();
  /** the candidate of the grouped link */
  readonly cand: number;
  /** the line of the cells, or -1 */
  line = -1;
  /** the column of the cells, or -1 */
  col = -1;
  /** the block of the cells */
  readonly block: number;
  readonly index1: number;
  readonly index2: number;
  /** index of the third cell, or -1 if the node has only two cells */
  index3 = -1;

  constructor(cand: number, indices: SudokuSet) {
    this.cand = cand;
    this.indices.set(indices);
    this.index1 = indices.get(0);
    this.index2 = indices.get(1);
    if (indices.size() > 2) this.index3 = indices.get(2);
    this.block = getBlock(this.index1);
    if (getLine(this.index1) === getLine(this.index2)) this.line = getLine(this.index1);
    if (getCol(this.index1) === getCol(this.index2)) this.col = getCol(this.index1);
    this.buddies.set(BUDDIES[this.index1]);
    this.buddies.and(BUDDIES[this.index2]);
    if (this.index3 >= 0) this.buddies.and(BUDDIES[this.index3]);
  }

  /** All group nodes of the grid: first those in lines, then those in columns. */
  static getGroupNodes(candidates: readonly SudokuSet[]): GroupNode[] {
    const groupNodes: GroupNode[] = [];
    GroupNode.getForHouseType(groupNodes, candidates, LINE_TEMPLATES);
    GroupNode.getForHouseType(groupNodes, candidates, COL_TEMPLATES);
    return groupNodes;
  }

  private static getForHouseType(
    groupNodes: GroupNode[],
    candidates: readonly SudokuSet[],
    houses: readonly SudokuSet[],
  ): void {
    const candInHouse = new SudokuSet();
    const tmpSet = new SudokuSet();
    for (const house of houses) {
      for (let cand = 1; cand <= 9; cand++) {
        candInHouse.set(house);
        candInHouse.and(candidates[cand]);
        if (candInHouse.isEmpty()) continue;
        for (const block of BLOCK_TEMPLATES) {
          tmpSet.set(candInHouse);
          tmpSet.and(block);
          if (tmpSet.size() >= 2) groupNodes.push(new GroupNode(cand, tmpSet));
        }
      }
    }
  }
}

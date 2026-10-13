/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's SolutionStep and Candidate (Java).
 */
import type { SolutionType } from './generated/solutionType.js';

/** A candidate: digit `value` (1-9) in cell `index` (0-80). */
export class Candidate {
  constructor(
    public index: number,
    public value: number,
  ) {}

  equals(o: Candidate): boolean {
    return this.index === o.index && this.value === o.value;
  }

  toString(): string {
    return `${this.index}/${this.value}`;
  }
}

/**
 * One step of a solution: a technique that was applied, the cells/values it
 * involves and the candidates it eliminates.
 *
 * Only the fields needed by the techniques ported so far are present; more
 * (fins, chains, ALS, colors, ...) are added together with their solvers.
 */
export class SolutionStep {
  type: SolutionType;
  /** Digits that are set (singles) or that form the subset/pattern. */
  values: number[] = [];
  /** Cells that are set (singles) or that form the subset/pattern. */
  indices: number[] = [];
  candidatesToDelete: Candidate[] = [];
  /** Fins (finned fish) or, for patterns like Empty Rectangle and 2-String Kite, the cells of the connecting block. */
  fins: Candidate[] = [];
  /** Endo fins (finned fish) or, for Avoidable Rectangles Type 2, the cells with the additional candidate. */
  endoFins: Candidate[] = [];
  /** Unit type (see BLOCK/LINE/COL in tables) for steps that have one, e.g. Locked Candidates. */
  entity = 0;
  /** 1-based number of that unit. */
  entityNumber = 0;

  constructor(type: SolutionType) {
    this.type = type;
  }

  addValue(value: number): void {
    this.values.push(value);
  }

  addIndex(index: number): void {
    this.indices.push(index);
  }

  addCandidateToDelete(index: number, candidate: number): void {
    this.candidatesToDelete.push(new Candidate(index, candidate));
  }

  addEndoFin(index: number, candidate: number): void {
    this.endoFins.push(new Candidate(index, candidate));
  }

  addFin(index: number, candidate: number): void {
    this.fins.push(new Candidate(index, candidate));
  }

  getAnzCandidatesToDelete(): number {
    return this.candidatesToDelete.length;
  }

  clone(): SolutionStep {
    const s = new SolutionStep(this.type);
    s.values = this.values.slice();
    s.indices = this.indices.slice();
    s.candidatesToDelete = this.candidatesToDelete.map((c) => new Candidate(c.index, c.value));
    s.fins = this.fins.map((c) => new Candidate(c.index, c.value));
    s.endoFins = this.endoFins.map((c) => new Candidate(c.index, c.value));
    s.entity = this.entity;
    s.entityNumber = this.entityNumber;
    return s;
  }

  isSingle(): boolean {
    return this.type === 'FULL_HOUSE' || this.type === 'NAKED_SINGLE' || this.type === 'HIDDEN_SINGLE';
  }
}

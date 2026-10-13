/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's RestrictedCommon (Java).
 */

/**
 * A restricted common (RC) of two ALS: a candidate that both contain and for which all
 * occurrences in both ALS see each other. Two ALS can have at most two RCs.
 *
 * `actualRC` says which of the possible RCs (`cand1`, `cand2`) is the one actually used when
 * the RC is part of an ALS chain: 0 = none, 1 = cand1, 2 = cand2, 3 = both.
 */
export class RestrictedCommon {
  constructor(
    public als1: number,
    public als2: number,
    public cand1: number,
    public cand2 = 0,
    public actualRC = 0,
  ) {}

  /**
   * Check this RC against the RC `rc` of the previous step of a chain (adjacency rules) and set
   * `actualRC` accordingly. At the start of a chain (`rc == null`) both candidates are tried
   * one after the other (`firstTry`). Returns false if the RC cannot follow `rc`.
   */
  checkRC(rc: RestrictedCommon | null, firstTry: boolean): boolean {
    this.actualRC = this.cand2 === 0 ? 1 : 3;
    if (rc === null) {
      // start of chain: pick your RC
      if (this.cand2 !== 0) this.actualRC = firstTry ? 1 : 2;
      return this.actualRC !== 0;
    }
    switch (rc.actualRC) {
      case 0:
        // already done
        break;
      case 1:
        this.actualRC = checkRCInt(rc.cand1, 0, this.cand1, this.cand2);
        break;
      case 2:
        this.actualRC = checkRCInt(rc.cand2, 0, this.cand1, this.cand2);
        break;
      case 3:
        // the original passes cand1 twice here (kept for identical results)
        this.actualRC = checkRCInt(rc.cand1, rc.cand1, this.cand1, this.cand2);
        break;
      default:
        break;
    }
    return this.actualRC !== 0;
  }

  /** Order by ALS indices, then candidates. */
  compareTo(r: RestrictedCommon): number {
    return this.als1 - r.als1 || this.als2 - r.als2 || this.cand1 - r.cand1 || this.cand2 - r.cand2;
  }

  clone(): RestrictedCommon {
    return new RestrictedCommon(this.als1, this.als2, this.cand1, this.cand2, this.actualRC);
  }

  toString(): string {
    return `RC(${this.als1}/${this.als2}/${this.cand1}/${this.cand2}/${this.actualRC})`;
  }
}

/**
 * c11/c12: the ARC(s) of the previous step (c12 == 0: only one). c21/c22: the PRC(s) between the
 * next ALS pair. Returns the new actual RC: 0 none, 1 first PRC, 2 second PRC, 3 both.
 */
function checkRCInt(c11: number, c12: number, c21: number, c22: number): number {
  if (c12 === 0) {
    // one ARC
    if (c22 === 0) {
      // one ARC, one PRC
      return c11 === c21 ? 0 : 1;
    }
    // one ARC, two PRCs
    if (c11 === c22) return 1;
    if (c11 === c21) return 2;
    return 3;
  }
  // two ARCs
  if (c22 === 0) {
    // two ARCs, one PRC
    return c11 === c21 || c12 === c21 ? 0 : 1;
  }
  // two ARCs, two PRCs
  if ((c11 === c21 && c12 === c22) || (c11 === c22 && c12 === c21)) return 0;
  if (c11 === c22 || c12 === c22) return 1;
  if (c11 === c21 || c12 === c21) return 2;
  return 3;
}

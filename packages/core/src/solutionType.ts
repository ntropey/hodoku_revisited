/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of the helpers in HoDoKu's SolutionType (Java).
 */
import type { SolutionType } from './generated/solutionType.js';

export type { SolutionType } from './generated/solutionType.js';
export { SOLUTION_TYPE_INFO, SOLUTION_TYPE_NAMES } from './generated/solutionType.js';

export function isSingle(type: SolutionType): boolean {
  return type === 'HIDDEN_SINGLE' || type === 'NAKED_SINGLE' || type === 'FULL_HOUSE';
}

/** Hidden subsets (the singles count as hidden subsets of size 1). */
export function isHiddenSubset(type: SolutionType): boolean {
  return isSingle(type) || type === 'HIDDEN_PAIR' || type === 'HIDDEN_TRIPLE' || type === 'HIDDEN_QUADRUPLE';
}

// ---- helpers that depend on the solver step configuration (category, search order)
import { DEFAULT_SOLVER_STEPS, SOLUTION_CATEGORIES, type StepConfig } from './generated/defaultSteps.js';

const CONFIG_BY_TYPE = new Map<SolutionType, StepConfig>(DEFAULT_SOLVER_STEPS.map((c) => [c.type, c]));

/**
 * The step configuration for a type. Variants of a technique (e.g. continuous and
 * discontinuous nice loop) share the configuration of their main type.
 */
export function getStepConfig(type: SolutionType): StepConfig | undefined {
  let t = type;
  if (t === 'CONTINUOUS_NICE_LOOP' || t === 'DISCONTINUOUS_NICE_LOOP' || t === 'AIC') t = 'NICE_LOOP';
  if (t === 'GROUPED_CONTINUOUS_NICE_LOOP' || t === 'GROUPED_DISCONTINUOUS_NICE_LOOP' || t === 'GROUPED_AIC') {
    t = 'GROUPED_NICE_LOOP';
  }
  if (t === 'FORCING_CHAIN_CONTRADICTION' || t === 'FORCING_CHAIN_VERITY') t = 'FORCING_CHAIN';
  if (t === 'FORCING_NET_CONTRADICTION' || t === 'FORCING_NET_VERITY') t = 'FORCING_NET';
  if (t === 'KRAKEN_FISH_TYPE_1' || t === 'KRAKEN_FISH_TYPE_2') t = 'KRAKEN_FISH';
  if (t === 'DUAL_TWO_STRING_KITE') t = 'TWO_STRING_KITE';
  if (t === 'DUAL_EMPTY_RECTANGLE') t = 'EMPTY_RECTANGLE';
  if (t === 'SIMPLE_COLORS_TRAP' || t === 'SIMPLE_COLORS_WRAP') t = 'SIMPLE_COLORS';
  if (t === 'MULTI_COLORS_1' || t === 'MULTI_COLORS_2') t = 'MULTI_COLORS';
  return CONFIG_BY_TYPE.get(t);
}

export function isFish(type: SolutionType): boolean {
  const c = getStepConfig(type)?.category;
  return (
    c === 'BASIC_FISH' ||
    c === 'FINNED_BASIC_FISH' ||
    c === 'FRANKEN_FISH' ||
    c === 'FINNED_FRANKEN_FISH' ||
    c === 'MUTANT_FISH' ||
    c === 'FINNED_MUTANT_FISH'
  );
}

function categoryIs(type: SolutionType, ...categories: string[]): boolean {
  const c = getStepConfig(type)?.category;
  return c !== undefined && categories.includes(c);
}

export function isBasicFish(type: SolutionType): boolean {
  return categoryIs(type, 'BASIC_FISH', 'FINNED_BASIC_FISH');
}

export function isFrankenFish(type: SolutionType): boolean {
  return categoryIs(type, 'FRANKEN_FISH', 'FINNED_FRANKEN_FISH');
}

export function isMutantFish(type: SolutionType): boolean {
  return categoryIs(type, 'MUTANT_FISH', 'FINNED_MUTANT_FISH');
}

export function isKrakenFish(type: SolutionType): boolean {
  return type === 'KRAKEN_FISH' || type === 'KRAKEN_FISH_TYPE_1' || type === 'KRAKEN_FISH_TYPE_2';
}

export function isSashimiFish(type: SolutionType): boolean {
  return (
    type === 'SASHIMI_X_WING' ||
    type === 'SASHIMI_SWORDFISH' ||
    type === 'SASHIMI_JELLYFISH' ||
    type === 'SASHIMI_SQUIRMBAG' ||
    type === 'SASHIMI_LEVIATHAN' ||
    type === 'SASHIMI_WHALE'
  );
}

/** Number of units in the base/cover sets of a fish (2 for X-Wing ... 7 for Leviathan). */
export function getFishSize(type: SolutionType): number {
  const name = type;
  if (name.endsWith('X_WING')) return 2;
  if (name.endsWith('SWORDFISH')) return 3;
  if (name.endsWith('JELLYFISH')) return 4;
  if (name.endsWith('SQUIRMBAG')) return 5;
  if (name.endsWith('WHALE')) return 6;
  return 7;
}

/**
 * Sort order of solution types: the order configured in the solver, except
 * that fish are sorted by (category, size, sashimi status).
 */
export function compareTypes(a: SolutionType, b: SolutionType): number {
  const s1 = getStepConfig(a);
  const s2 = getStepConfig(b);
  if (isFish(a) && isFish(b)) {
    const categories = SOLUTION_CATEGORIES;
    const c1 = categories.indexOf(s1!.category);
    const c2 = categories.indexOf(s2!.category);
    if (c1 !== c2) return c1 - c2; // different categories -> category defines order
    const size = getFishSize(a) - getFishSize(b);
    if (size !== 0) return size;
    // same category and size: finned and sashimi are treated separately
    const sa = isSashimiFish(a);
    const sb = isSashimiFish(b);
    if ((sa && sb) || (!sa && !sb)) return 0;
    return sa ? 1 : -1;
  }
  return s1!.index - s2!.index;
}

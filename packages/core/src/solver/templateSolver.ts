/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's TemplateSolver (Java).
 */
import { SolutionStep } from '../solutionStep.js';
import type { SolutionType } from '../solutionType.js';
import { SudokuSet } from '../sudokuSet.js';
import { AbstractSolver } from './abstractSolver.js';
import type { SudokuStepFinder } from './stepFinder.js';

/**
 * Template Set and Template Delete: for each digit, all placements (templates) that fit the
 * current grid are collected. A cell that is in every template of a digit can be set; a cell
 * that is in none of them loses the digit.
 */
export class TemplateSolver extends AbstractSolver {
  private steps: SolutionStep[] = [];

  constructor(finder: SudokuStepFinder) {
    super(finder);
  }

  getStep(type: SolutionType): SolutionStep | null {
    this.sudoku = this.finder.getSudoku();
    if (type === 'TEMPLATE_SET') {
      this.getTemplateSet(true);
      return this.steps.length > 0 ? this.steps[0] : null;
    }
    if (type === 'TEMPLATE_DEL') {
      this.getTemplateDel(true);
      return this.steps.length > 0 ? this.steps[0] : null;
    }
    return null;
  }

  doStep(step: SolutionStep): boolean {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case 'TEMPLATE_SET': {
        const value = step.values[0];
        for (const index of step.indices) this.sudoku.setCell(index, value);
        return true;
      }
      case 'TEMPLATE_DEL':
        for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        return true;
      default:
        return false;
    }
  }

  /** All Template Set and Template Delete steps (one per digit and kind). */
  getAllTemplates(): SolutionStep[] {
    this.sudoku = this.finder.getSudoku();
    const old = this.steps;
    this.steps = [];
    this.getTemplateSet(false);
    this.getTemplateDel(false);
    const result = this.steps;
    this.steps = old;
    return result;
  }

  private getTemplateSet(initSteps: boolean): void {
    if (initSteps) this.steps = [];
    const setSet = new SudokuSet();
    for (let i = 1; i <= 9; i++) {
      setSet.set(this.finder.getSetValueTemplates(true)[i]);
      setSet.andNot(this.finder.getPositions()[i]);
      if (!setSet.isEmpty()) {
        const step = new SolutionStep('TEMPLATE_SET');
        step.addValue(i);
        for (const index of setSet.values()) step.addIndex(index);
        this.steps.push(step);
      }
    }
  }

  private getTemplateDel(initSteps: boolean): void {
    if (initSteps) this.steps = [];
    const setSet = new SudokuSet();
    for (let i = 1; i <= 9; i++) {
      setSet.set(this.finder.getDelCandTemplates(true)[i]);
      setSet.and(this.finder.getCandidates()[i]);
      if (!setSet.isEmpty()) {
        const step = new SolutionStep('TEMPLATE_DEL');
        step.addValue(i);
        for (const index of setSet.values()) step.addCandidateToDelete(index, i);
        this.steps.push(step);
      }
    }
  }
}

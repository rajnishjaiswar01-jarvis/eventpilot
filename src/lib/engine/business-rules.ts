/**
 * Business Rules Validation Engine.
 *
 * This is the SECOND validation layer, applied AFTER Zod schema validation.
 * Zod ensures structural correctness (types, formats).
 * Business rules ensure semantic correctness (logic, constraints, consistency).
 *
 * All validation functions are pure and deterministic.
 */

import type { EventData, ValidationResult, Task } from '../types/domain';

/**
 * Run all business rule validations on an event.
 * Returns an array of validation results (errors, warnings, info).
 */
export function validateEventBusinessRules(event: EventData): ValidationResult[] {
  const results: ValidationResult[] = [];

  results.push(...validateDates(event));
  results.push(...validateBudget(event));
  results.push(...validateTasks(event));
  results.push(...validateTeamReferences(event));

  return results;
}

// ─── Date Validation ────────────────────────────────────

function validateDates(event: EventData): ValidationResult[] {
  const results: ValidationResult[] = [];
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);

  if (isNaN(start.getTime())) {
    results.push({
      field: 'startDate',
      message: 'Start date is invalid',
      severity: 'error',
      code: 'INVALID_START_DATE',
    });
    return results; // Can't do further date checks
  }

  if (isNaN(end.getTime())) {
    results.push({
      field: 'endDate',
      message: 'End date is invalid',
      severity: 'error',
      code: 'INVALID_END_DATE',
    });
    return results;
  }

  if (end < start) {
    results.push({
      field: 'endDate',
      message: 'End date must be on or after the start date',
      severity: 'error',
      code: 'END_BEFORE_START',
    });
  }

  // Check task due dates are within event range
  for (const task of event.tasks) {
    if (task.dueDate === '') continue;
    const due = new Date(task.dueDate);
    if (isNaN(due.getTime())) {
      results.push({
        field: `tasks.${task.id}.dueDate`,
        message: `Task "${task.title}" has an invalid due date`,
        severity: 'error',
        code: 'INVALID_TASK_DUE_DATE',
      });
      continue;
    }
    if (due > end) {
      results.push({
        field: `tasks.${task.id}.dueDate`,
        message: `Task "${task.title}" due date is after the event end date`,
        severity: 'warning',
        code: 'TASK_DUE_AFTER_EVENT',
      });
    }
  }

  return results;
}

// ─── Budget Validation ──────────────────────────────────

function validateBudget(event: EventData): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Check for negative costs
  for (const item of event.budgetItems) {
    if (item.estimatedAmountMinor < 0) {
      results.push({
        field: `budgetItems.${item.id}.estimatedAmountMinor`,
        message: `Budget item "${item.name}" has a negative estimated cost`,
        severity: 'error',
        code: 'NEGATIVE_ESTIMATED_COST',
      });
    }
    if (item.actualAmountMinor < 0) {
      results.push({
        field: `budgetItems.${item.id}.actualAmountMinor`,
        message: `Budget item "${item.name}" has a negative actual cost`,
        severity: 'error',
        code: 'NEGATIVE_ACTUAL_COST',
      });
    }
  }

  // Check total estimated vs budget (overflow)
  const totalEstimated = event.budgetItems.reduce(
    (sum, item) => sum + item.estimatedAmountMinor, 0
  );

  if (totalEstimated > event.totalBudgetMinor && event.totalBudgetMinor > 0) {
    const overflowMinor = totalEstimated - event.totalBudgetMinor;
    results.push({
      field: 'budgetItems',
      message: `Total estimated costs exceed budget by ${overflowMinor} minor units`,
      severity: 'error',
      code: 'BUDGET_OVERFLOW',
    });
  }

  // Warn if actual spend exceeds estimated
  const totalActual = event.budgetItems.reduce(
    (sum, item) => sum + item.actualAmountMinor, 0
  );

  if (totalActual > totalEstimated && totalEstimated > 0) {
    results.push({
      field: 'budgetItems',
      message: 'Actual spending exceeds total estimated budget',
      severity: 'warning',
      code: 'ACTUAL_EXCEEDS_ESTIMATED',
    });
  }

  return results;
}

// ─── Task Validation ────────────────────────────────────

function validateTasks(event: EventData): ValidationResult[] {
  const results: ValidationResult[] = [];
  const taskIds = new Set(event.tasks.map((t) => t.id));

  for (const task of event.tasks) {
    // Check for invalid dependency references
    for (const depId of task.dependsOn) {
      if (!taskIds.has(depId)) {
        results.push({
          field: `tasks.${task.id}.dependsOn`,
          message: `Task "${task.title}" depends on non-existent task "${depId}"`,
          severity: 'error',
          code: 'INVALID_DEPENDENCY_REF',
        });
      }
    }

    // Self-dependency
    if (task.dependsOn.includes(task.id)) {
      results.push({
        field: `tasks.${task.id}.dependsOn`,
        message: `Task "${task.title}" cannot depend on itself`,
        severity: 'error',
        code: 'SELF_DEPENDENCY',
      });
    }

    // Completed task with incomplete status
    if (task.status === 'completed' && task.completedAt === '') {
      results.push({
        field: `tasks.${task.id}.completedAt`,
        message: `Task "${task.title}" is marked completed but has no completion date`,
        severity: 'warning',
        code: 'COMPLETED_NO_DATE',
      });
    }

    // Inconsistent state: completed but depends on pending tasks
    if (task.status === 'completed') {
      const incompleteDeps = task.dependsOn
        .map((depId) => event.tasks.find((t) => t.id === depId))
        .filter((dep): dep is Task => dep !== undefined && dep.status !== 'completed' && dep.status !== 'cancelled');

      if (incompleteDeps.length > 0) {
        results.push({
          field: `tasks.${task.id}.status`,
          message: `Task "${task.title}" is completed but depends on incomplete tasks: ${incompleteDeps.map((d) => d.title).join(', ')}`,
          severity: 'warning',
          code: 'COMPLETED_WITH_INCOMPLETE_DEPS',
        });
      }
    }
  }

  return results;
}

// ─── Team Reference Validation ──────────────────────────

function validateTeamReferences(event: EventData): ValidationResult[] {
  const results: ValidationResult[] = [];
  const memberIds = new Set(event.teamMembers.map((m) => m.id));

  for (const task of event.tasks) {
    if (task.assigneeId !== '' && !memberIds.has(task.assigneeId)) {
      results.push({
        field: `tasks.${task.id}.assigneeId`,
        message: `Task "${task.title}" is assigned to non-existent team member "${task.assigneeId}"`,
        severity: 'warning',
        code: 'INVALID_ASSIGNEE_REF',
      });
    }
  }

  return results;
}

/**
 * Filter results by severity level.
 */
export function getErrors(results: ValidationResult[]): ValidationResult[] {
  return results.filter((r) => r.severity === 'error');
}

export function getWarnings(results: ValidationResult[]): ValidationResult[] {
  return results.filter((r) => r.severity === 'warning');
}

export function hasErrors(results: ValidationResult[]): boolean {
  return results.some((r) => r.severity === 'error');
}

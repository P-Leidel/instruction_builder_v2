import type { InstructionDocument, InstructionStep } from "./instruction";

export interface StepValidationResult {
  stepId: string;
  isComplete: boolean;
  issues: string[];
}

/**
 * Empty groups receive an advisory. Every nonempty group is complete,
 * including object-only choices and picture routines.
 */
export function validateStep(step: InstructionStep): StepValidationResult {
  const issues: string[] = [];

  if (step.tokens.length === 0) {
    issues.push("Step is empty");
  }

  return { stepId: step.id, isComplete: issues.length === 0, issues };
}

export function validateDocument(doc: InstructionDocument): StepValidationResult[] {
  return doc.steps.map(validateStep);
}

/**
 * Whether a step's persistent incomplete-state indicator (the on-canvas "!"
 * badge) should actually render. A brand-new step with zero
 * tokens is always technically incomplete (`validateStep`'s "Step is empty"
 * issue), but flagging that before the user has added anything reads as
 * "you've already done something wrong" rather than useful guidance - so
 * the persistent badge is deferred until at least one token exists.
 * Export's own "N incomplete steps" warning toast (tasks 14/18-19) keeps
 * checking `isComplete` directly and is unaffected by this - only the
 * always-visible badge is deferred.
 */
export function shouldFlagIncompleteStep(step: InstructionStep, result: StepValidationResult): boolean {
  return !result.isComplete && step.tokens.length > 0;
}

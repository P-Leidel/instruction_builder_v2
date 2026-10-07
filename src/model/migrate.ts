import {
  CURRENT_SCHEMA_VERSION,
  type InstructionDocument,
  type InstructionStep,
  type InstructionToken,
  type TokenCategory,
} from "./instruction";
import { MIN_DURATION_SECONDS, MAX_DURATION_SECONDS } from "../lib/duration";
import { MIN_QUANTITY, MAX_QUANTITY } from "../lib/quantity";

const TOKEN_CATEGORIES: readonly TokenCategory[] = [
  "action",
  "object",
  "tool",
  "quantity",
  "warning",
  "time",
];

function fail(reason: string): never {
  throw new Error(`Not a valid instruction file: ${reason}.`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isValidToken(value: unknown): value is InstructionToken {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    typeof value.iconId === "string" &&
    TOKEN_CATEGORIES.includes(value.category as TokenCategory)
  );
}

function isValidStep(value: unknown): value is InstructionStep {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    Array.isArray(value.tokens) &&
    value.tokens.every(isValidToken)
  );
}

function validateOptionalString(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== "string") fail(`invalid ${path} (expected a string)`);
}

function isBoundedInteger(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function validateTime(value: unknown, path: string): void {
  if (value === undefined) return;
  if (
    !isPlainObject(value) ||
    typeof value.iconId !== "string" ||
    typeof value.label !== "string" ||
    !isBoundedInteger(value.seconds, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS)
  ) {
    fail(`invalid ${path} (expected iconId/label strings and whole seconds ${MIN_DURATION_SECONDS}..${MAX_DURATION_SECONDS})`);
  }
}

function validateQuantity(value: unknown, path: string): void {
  if (value === undefined) return;
  if (
    !isPlainObject(value) ||
    typeof value.iconId !== "string" ||
    typeof value.label !== "string" ||
    typeof value.unit !== "string" ||
    !isBoundedInteger(value.amount, MIN_QUANTITY, MAX_QUANTITY)
  ) {
    fail(`invalid ${path} (expected iconId/label/unit strings and a whole amount ${MIN_QUANTITY}..${MAX_QUANTITY})`);
  }
}

function validateWarning(value: unknown, path: string): void {
  if (value === undefined) return;
  if (!isPlainObject(value) || typeof value.iconId !== "string") {
    fail(`invalid ${path} (expected an attachment with a string iconId)`);
  }
  validateOptionalString(value.label, `${path}.label`);
}

function validateMetadata(value: unknown, path: string): void {
  if (value === undefined) return;
  if (
    !isPlainObject(value) ||
    !Object.values(value).every((entry) =>
      typeof entry === "string" || typeof entry === "boolean" ||
      (typeof entry === "number" && Number.isFinite(entry)),
    )
  ) {
    fail(`invalid ${path} (expected an object containing only strings, booleans, or finite numbers)`);
  }
}

/**
 * Repairs a same-version data drift, not a schema migration: between
 * `580d5e6` (2026-09-14, the production deploy) and `9ab8e64` (2026-09-17,
 * "make Quantity structured") the live app saved a token's `quantity` as a
 * label-only `{ iconId, label: "3 kg" }` shape - identical to
 * `TokenAttachment`, missing the `amount`/`unit` fields `QuantityAttachment`
 * now requires - while `CURRENT_SCHEMA_VERSION` stayed `1` throughout, so
 * there's no version bump to hang a migration step off (see
 * docs/known-issues.md's "Quantity amount/unit representation" entry).
 * Without this repair, `QuantityForm`'s `value?.amount ?? 1` fallback
 * silently shows "1 g" for whatever amount/unit the user actually entered.
 * Repair the historical shape before validating the structured attachment.
 *
 * Every such label was always built as exactly `${amount} ${unit}` from a
 * validated integer `amount` and one of `EU_FOOD_UNITS`' space-free values
 * (confirmed against `TokenDetails.tsx` as it existed in that window, commit
 * `9121c37`) - so splitting on the first space losslessly recovers the
 * original amount/unit; this isn't a best-effort re-parse of arbitrary text,
 * it's inverting a value this app itself always produced in that one exact
 * shape. Only a shape that window could never have actually produced (no
 * space, or a non-integer leading token) falls back to dropping the
 * quantity entirely, rather than guessing at a default.
 */
function repairLegacyQuantity(token: InstructionToken): InstructionToken {
  const q = token.quantity as unknown;
  if (!isPlainObject(q) || typeof q.iconId !== "string" || typeof q.label !== "string") {
    return token;
  }
  if ("amount" in q || "unit" in q) {
    // Structured data, including incomplete or invalid records, must pass
    // validation rather than having its fields overwritten from the label.
    return token;
  }

  const spaceIndex = q.label.indexOf(" ");
  const amount = spaceIndex === -1 ? NaN : Number(q.label.slice(0, spaceIndex));
  const unit = spaceIndex === -1 ? "" : q.label.slice(spaceIndex + 1);
  if (!Number.isInteger(amount) || unit === "") {
    // `undefined`, not key deletion - matches how `setTokenAttachment`
    // (state/document.ts) already represents "no attachment of this kind".
    return { ...token, quantity: undefined };
  }
  return { ...token, quantity: { ...q, iconId: q.iconId, label: q.label, amount, unit } };
}

/**
 * Upgrades a parsed JSON document to `CURRENT_SCHEMA_VERSION`, validating its
 * consumed fields. Both saved documents loaded from IndexedDB and imported
 * files can be hand-edited, corrupted, or unrelated data entirely - this can't just
 * cast `unknown` to `InstructionDocument` and hope, so it checks the fields
 * the app actually relies on and throws a descriptive, user-safe-to-display
 * error instead of letting a malformed document silently corrupt app state.
 * Optional text, attachments, and metadata must match the model whenever
 * present; unknown fields and string lengths remain unrestricted. Historical
 * label-only quantities receive the narrow same-version repair below before
 * the structured shape is checked. Neither validation nor repair mutates input.
 */
export function migrate(doc: unknown): InstructionDocument {
  if (!isPlainObject(doc)) fail("not a JSON object");
  if (typeof doc.schemaVersion !== "number") fail("missing a schemaVersion");
  if (!Number.isInteger(doc.schemaVersion) || doc.schemaVersion < 1) {
    fail("invalid schemaVersion (expected a positive integer)");
  }
  if (doc.schemaVersion > CURRENT_SCHEMA_VERSION) {
    fail(
      `schemaVersion ${doc.schemaVersion} is newer than this app supports (${CURRENT_SCHEMA_VERSION}) - it was probably made with a newer version of this app`,
    );
  }
  if (
    !isPlainObject(doc.meta) ||
    typeof doc.meta.title !== "string" ||
    typeof doc.meta.domain !== "string" ||
    typeof doc.meta.createdAt !== "string"
  ) {
    fail("missing or invalid meta (title/domain/createdAt)");
  }

  const presentation = doc.schemaVersion === 1 && !("presentation" in doc.meta)
    ? "sequence"
    : doc.meta.presentation;
  if (presentation !== "sequence" && presentation !== "board") {
    fail("invalid meta.presentation (expected sequence or board)");
  }

  if (!Array.isArray(doc.steps) || !doc.steps.every(isValidStep)) {
    fail("missing or invalid steps");
  }

  // Mutations address steps and tokens by id. A duplicate can make one
  // edit/remove affect several items, including tokens moved between steps.
  const stepIds = new Set<string>();
  const tokenIds = new Set<string>();
  for (const step of doc.steps as InstructionStep[]) {
    if (stepIds.has(step.id)) fail("duplicate step id");
    stepIds.add(step.id);
    for (const token of step.tokens) {
      if (tokenIds.has(token.id)) fail("duplicate token id");
      tokenIds.add(token.id);
    }
  }

  const steps = (doc.steps as InstructionStep[]).map((step, stepIndex) => {
    const stepPath = `steps[${stepIndex}]`;
    validateOptionalString(step.title, `${stepPath}.title`);
    validateOptionalString(step.description, `${stepPath}.description`);
    validateTime(step.time, `${stepPath}.time`);
    return {
      ...step,
      tokens: step.tokens.map((token, tokenIndex) => {
        const repaired = repairLegacyQuantity(token);
        const tokenPath = `${stepPath}.tokens[${tokenIndex}]`;
        validateOptionalString(repaired.label, `${tokenPath}.label`);
        validateOptionalString(repaired.note, `${tokenPath}.note`);
        validateTime(repaired.time, `${tokenPath}.time`);
        validateQuantity(repaired.quantity, `${tokenPath}.quantity`);
        validateWarning(repaired.warning, `${tokenPath}.warning`);
        validateMetadata(repaired.metadata, `${tokenPath}.metadata`);
        return repaired;
      }),
    };
  });

  return { ...doc, schemaVersion: CURRENT_SCHEMA_VERSION, meta: { ...doc.meta, presentation }, steps } as unknown as InstructionDocument;
}

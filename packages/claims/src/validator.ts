import type { Claim, DocumentSpan, ValidationResult } from "./types.js";

/**
 * STUB -- Phase 2 implements the seven passes described in PLAN.md
 * (citation completeness, citation resolution, quantity containment, entity
 * closure, seniority/superlative lexicon, employment implication, timeline
 * coherence). Until then this rejects everything with UNCITED_SPAN so that
 * nothing downstream can mistake "not yet built" for "verified safe".
 *
 * Do not weaken this stub to `{ ok: true }` as a shortcut to unblock a
 * generator -- Rule #1 in the root CLAUDE.md exists specifically to prevent
 * that shortcut.
 */
export function validate(spans: DocumentSpan[], _claims: Claim[]): ValidationResult {
  if (spans.length === 0) {
    return { ok: true };
  }
  return {
    ok: false,
    violations: spans.map((s) => ({
      code: "UNCITED_SPAN" as const,
      span: s.text,
      detail: "validator not yet implemented (Phase 2) -- nothing can pass yet",
    })),
  };
}

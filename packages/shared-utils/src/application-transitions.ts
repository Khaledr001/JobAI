import type { ApplicationStatus } from "@jobhunter/shared-types";

/**
 * PLAN.md's state machine:
 * discovered -> matched -> drafted -> approved -> applied -> replied ->
 * interviewing -> offer|rejected|ghosted. The tail branches at more than
 * one point in real use (a company can reject right after an application,
 * or ghost after an interview), so this is the full, real transition set,
 * not a single linear chain -- `offer`/`rejected`/`ghosted` are terminal
 * (no outgoing transitions at all).
 *
 * Enforced in two independent places, same discipline as the claim ledger:
 * this map (the application-code gate, `apps/api`'s ApplicationsService)
 * and a mirrored SQL CASE in the `applications_validate_transition` DB
 * trigger (sql/04-functions.sql). Keep both in sync by hand if this ever
 * changes -- there is no single source both read from, the same tradeoff
 * pgEnum values already accept for the DB/TS boundary.
 */
export const APPLICATION_TRANSITIONS: Record<
  ApplicationStatus,
  readonly ApplicationStatus[]
> = {
  discovered: ["matched"],
  matched: ["drafted"],
  drafted: ["approved"],
  approved: ["applied"],
  applied: ["replied", "ghosted", "rejected"],
  replied: ["interviewing", "rejected"],
  interviewing: ["offer", "rejected", "ghosted"],
  offer: [],
  rejected: [],
  ghosted: [],
};

export function isLegalApplicationTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return APPLICATION_TRANSITIONS[from].includes(to);
}

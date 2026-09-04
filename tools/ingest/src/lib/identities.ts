/**
 * Git identities the operator has actually committed under, across the
 * repos this tool scans. See docs/DECISIONS.md D21: `DevsFleet POS`'s real
 * history contains commits authored by an AI pairing session's own
 * identity alongside the operator's own. Only emails in this set count as
 * his personal work -- everything else is excluded and counted, never
 * silently attributed to him.
 *
 * Read from the environment, not hardcoded here: this file is real,
 * tracked source code, and the operator's personal email addresses are
 * exactly the kind of thing docs/PRIVACY.md says must never sit in a
 * tracked file. `OPERATOR_GIT_EMAILS` (comma-separated) lives in `.env`
 * (gitignored) alongside `OPERATOR_EMAIL`, which is always included too --
 * a login email and a commit email are often the same address, but the
 * schema treats them as independent facts on purpose.
 */
function loadOperatorGitEmails(): Set<string> {
  const fromLogin = process.env.OPERATOR_EMAIL?.trim().toLowerCase();
  const fromGitList = (process.env.OPERATOR_GIT_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const emails = new Set(fromGitList);
  if (fromLogin) emails.add(fromLogin);

  if (emails.size === 0) {
    throw new Error(
      "identities: neither OPERATOR_EMAIL nor OPERATOR_GIT_EMAILS is set -- " +
        "every commit would be excluded as non-operator. Set at least one in .env.",
    );
  }
  return emails;
}

let cached: Set<string> | undefined;

export function isOperatorIdentity(email: string): boolean {
  cached ??= loadOperatorGitEmails();
  return cached.has(email.trim().toLowerCase());
}

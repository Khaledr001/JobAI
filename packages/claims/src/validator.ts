import {
  extractEntityMentions,
  extractQuantities,
  findLexiconHits,
  longestSharedRun,
  PROFICIENCY_LEVELS,
  quantityKeyFor,
  SENIORITY_TERMS,
  SUPERLATIVE_TERMS,
  type QuantityMention,
} from "./extract.js";
import { normalizeForMatching } from "./normalize.js";
import type {
  Claim,
  DocumentSpan,
  PassName,
  ValidateOptions,
  ValidationResult,
  Violation,
} from "./types.js";

/**
 * Seven deterministic passes -- no LLM judge, per docs/DECISIONS.md D2. An
 * LLM judging an LLM's honesty is a coin flip you pay for; every rule here
 * is a plain function over text and the verified claim list. See
 * docs/VERIFICATION.md for the adversarial fixture corpus this is proven
 * against, and PLAN.md's "Resume generation + anti-fabrication" section for
 * the design this implements.
 *
 * Nothing here reads the clock or a random source (enforced by
 * eslint.config.mjs for this whole package) -- a validator whose verdict
 * depends on when it runs is not an invariant.
 */

function normalizedWords(text: string): string[] {
  return normalizeForMatching(text).toLowerCase().split(/\s+/).filter(Boolean);
}

/** Every substring of a claim's own subject/statement that an entity mention can match against -- built once per validate() call. */
function buildClaimHaystack(claims: readonly Claim[]): string {
  return normalizeForMatching(
    claims.map((c) => `${c.subject} ${c.statement}`).join(" \n "),
  ).toLowerCase();
}

function haystackContains(haystack: string, mention: string): boolean {
  return haystack.includes(normalizeForMatching(mention).toLowerCase());
}

// --- Pass 1: citation completeness -----------------------------------------

/**
 * Every "bullet" span (an experience/project line) always asserts
 * experience and always needs a citation, unconditionally -- this is
 * simpler than gating on whether the text happens to contain a detectable
 * quantity/entity/lexicon term, and it's the only version of this rule that
 * a fixture can isolate: any span whose *content* trips this pass also
 * necessarily trips whichever of passes 3/4/5 detects that same content
 * against an empty (uncited) claim list, so a signal-gated version of this
 * rule can never fire alone. "summary" spans (an objective/profile line)
 * are exempt -- they may be free text with no citation at all.
 */
function checkCitationCompleteness(span: DocumentSpan): Violation[] {
  if (span.kind !== "bullet" || span.claimIds.length > 0) return [];
  return [
    {
      code: "UNCITED_SPAN",
      span: span.text,
      detail: "a bullet must cite at least one claim",
    },
  ];
}

// --- Pass 2: citation resolution --------------------------------------------

interface ResolutionResult {
  violations: Violation[];
  resolvedClaims: Claim[];
}

function checkCitationResolution(
  span: DocumentSpan,
  claimsById: Map<string, Claim>,
): ResolutionResult {
  const violations: Violation[] = [];
  const resolvedClaims: Claim[] = [];

  for (const id of span.claimIds) {
    const claim = claimsById.get(id);
    if (!claim) {
      violations.push({
        code: "DANGLING_CLAIM",
        span: span.text,
        detail: `cited claim ${id} does not exist`,
      });
      continue;
    }
    if (!claim.emittable) {
      violations.push({
        code: "UNVERIFIED_CLAIM",
        span: span.text,
        detail: `cited claim ${id} (${claim.subject}) is not emittable`,
      });
      continue;
    }
    if (span.scopeRef && claim.scopeRef && span.scopeRef !== claim.scopeRef) {
      violations.push({
        code: "CLAIM_SUBJECT_MISMATCH",
        span: span.text,
        detail: `cited claim ${id} is scoped to "${claim.scopeRef}", not this span's "${span.scopeRef}"`,
      });
      continue;
    }
    resolvedClaims.push(claim);
  }

  return { violations, resolvedClaims };
}

// --- Pass 3: quantity containment -------------------------------------------

function proficiencyRank(level: string): number {
  return PROFICIENCY_LEVELS.indexOf(level);
}

function checkQuantityContainment(
  span: DocumentSpan,
  resolvedClaims: readonly Claim[],
): Violation[] {
  const violations: Violation[] = [];

  for (const mention of extractQuantities(span.text)) {
    const key = quantityKeyFor(mention);
    const supportingClaim = resolvedClaims.find((c) => key in c.quantities);

    if (!supportingClaim) {
      violations.push({
        code: mention.type === "version" ? "VERSION_UNSUPPORTED" : "QUANTITY_UNSUPPORTED",
        span: span.text,
        detail: `"${mention.raw}" -- no cited claim declares "${key}"`,
      });
      continue;
    }

    const declared = supportingClaim.quantities[key];
    violations.push(...compareQuantity(mention, declared, span.text));
  }

  return violations;
}

function compareQuantity(
  mention: QuantityMention,
  declared: unknown,
  spanText: string,
): Violation[] {
  switch (mention.type) {
    case "tenure":
      return mention.years > Number(declared)
        ? [
            inflated(
              spanText,
              mention.raw,
              `claims ${mention.years}y, evidence supports ${String(declared)}y`,
            ),
          ]
        : [];
    case "percentage":
      return mention.percent > Number(declared)
        ? [
            inflated(
              spanText,
              mention.raw,
              `claims ${mention.percent}%, evidence supports ${String(declared)}%`,
            ),
          ]
        : [];
    case "teamSize":
      return mention.size > Number(declared)
        ? [
            inflated(
              spanText,
              mention.raw,
              `claims a team of ${mention.size}, evidence supports ${String(declared)}`,
            ),
          ]
        : [];
    case "proficiency":
      return proficiencyRank(mention.level) > proficiencyRank(String(declared))
        ? [
            inflated(
              spanText,
              mention.raw,
              `claims "${mention.level}", evidence supports "${String(declared)}"`,
            ),
          ]
        : [];
    case "version":
      return String(declared) !== mention.version
        ? [
            {
              code: "VERSION_UNSUPPORTED",
              span: spanText,
              detail: `"${mention.raw}" -- evidence supports ${mention.technology} ${String(declared)}, not ${mention.version}`,
            },
          ]
        : [];
  }
}

function inflated(span: string, raw: string, detail: string): Violation {
  return { code: "QUANTITY_INFLATED", span, detail: `"${raw}" -- ${detail}` };
}

// --- Pass 4: entity closure --------------------------------------------------

function checkEntityClosure(
  span: DocumentSpan,
  resolvedClaims: readonly Claim[],
  jdAllowlist: ReadonlySet<string>,
): Violation[] {
  const violations: Violation[] = [];
  const haystack = buildClaimHaystack(resolvedClaims);

  for (const mention of extractEntityMentions(span.text)) {
    if (haystackContains(haystack, mention)) continue;

    // The JD is untrusted input (see docs/PATTERNS.md) and is consulted ONLY
    // for "summary" spans, which assert no past experience. A "bullet" span
    // always asserts experience, so it is never relaxed by JD content --
    // this is what stops a job description's own text (including an
    // injected instruction inside it) from ever legitimising an
    // experience claim.
    if (
      span.kind === "summary" &&
      jdAllowlist.has(normalizeForMatching(mention).toLowerCase())
    ) {
      continue;
    }

    violations.push({
      code: "UNSUPPORTED_ENTITY",
      span: span.text,
      detail: `"${mention}" is not supported by any cited claim`,
    });
  }

  return violations;
}

// --- JD echo (bullets only; a distinct check from entity closure) ----------

const JD_ECHO_MIN_SHARED_WORDS = 5;

function checkJdEcho(
  span: DocumentSpan,
  jobDescription: string | undefined,
): Violation[] {
  if (!jobDescription || span.kind !== "bullet") return [];

  const spanWords = normalizedWords(span.text);
  const sentences = jobDescription.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    const sentenceWords = normalizedWords(sentence);
    if (longestSharedRun(spanWords, sentenceWords) >= JD_ECHO_MIN_SHARED_WORDS) {
      return [
        {
          code: "JD_ECHO",
          span: span.text,
          detail:
            "shares a long verbatim run with a job description sentence -- looks mirrored, not lived",
        },
      ];
    }
  }

  return [];
}

// --- Pass 5: seniority and superlative lexicon ------------------------------

function checkSeniorityLexicon(
  span: DocumentSpan,
  resolvedClaims: readonly Claim[],
): Violation[] {
  const violations: Violation[] = [];

  for (const term of findLexiconHits(span.text, SENIORITY_TERMS)) {
    const backed = resolvedClaims.some(
      (c) => String(c.quantities.seniority ?? "").toLowerCase() === term,
    );
    if (!backed) {
      violations.push({
        code: "SENIORITY_UPGRADE",
        span: span.text,
        detail: `"${term}" is not supported by a cited claim's declared seniority`,
      });
    }
  }

  for (const term of findLexiconHits(span.text, SUPERLATIVE_TERMS)) {
    violations.push({
      code: "SUPERLATIVE_UNSUPPORTED",
      span: span.text,
      detail: `"${term}" is a superlative with no verifiable basis`,
    });
  }

  return violations;
}

// --- Pass 6: employment implication -----------------------------------------

const EMPLOYMENT_IMPLICATION_RE =
  /\b(?:collaborated with|contracted (?:by|for|with)|employed by|embedded (?:with|at)|on assignment (?:with|for))\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*)*)/gi;

function checkEmploymentImplication(
  span: DocumentSpan,
  resolvedClaims: readonly Claim[],
): Violation[] {
  const violations: Violation[] = [];
  const text = normalizeForMatching(span.text);

  for (const m of text.matchAll(EMPLOYMENT_IMPLICATION_RE)) {
    const org = m[1] ?? "";
    const backed = resolvedClaims.some(
      (c) =>
        c.kind === "held_role" &&
        haystackContains(normalizeForMatching(c.subject).toLowerCase(), org),
    );
    if (!backed) {
      violations.push({
        code: "EMPLOYMENT_IMPLICATION",
        span: span.text,
        detail: `implies an employment relationship with "${org}" not backed by a held_role claim`,
      });
    }
  }

  return violations;
}

// --- Pass 7: timeline coherence (document-level) ----------------------------

/**
 * Compares `from`/`to` as plain ISO-8601 date strings ("2024-01-01"),
 * lexicographically -- correct for zero-padded ISO dates, and avoids
 * `Date` entirely, which is restricted in this package (see
 * eslint.config.mjs): a validator that reads the clock is not an
 * invariant, and every date this pass compares is a claim's own declared
 * value, never "now".
 */
function rangesOverlap(a: Claim, b: Claim): boolean {
  const aFrom = String(a.quantities.from ?? "");
  const aTo = String(a.quantities.to ?? "");
  const bFrom = String(b.quantities.from ?? "");
  const bTo = String(b.quantities.to ?? "");
  if (!aFrom || !aTo || !bFrom || !bTo) return false;
  return aFrom <= bTo && bFrom <= aTo;
}

function checkTimelineCoherence(allResolvedClaims: readonly Claim[]): Violation[] {
  const roleClaims = allResolvedClaims.filter(
    (c) => c.kind === "held_role" && "from" in c.quantities && "to" in c.quantities,
  );
  const violations: Violation[] = [];

  for (let i = 0; i < roleClaims.length; i++) {
    for (let j = i + 1; j < roleClaims.length; j++) {
      const a = roleClaims[i];
      const b = roleClaims[j];
      if (!a || !b || a.id === b.id || a.subject === b.subject) continue;
      if (rangesOverlap(a, b)) {
        violations.push({
          code: "TIMELINE_CONFLICT",
          span: `${a.subject} vs ${b.subject}`,
          detail: "two distinct held_role claims have overlapping full-time date ranges",
        });
      }
    }
  }

  return violations;
}

// --- Orchestrator ------------------------------------------------------------

function buildJdAllowlist(jobDescription: string | undefined): Set<string> {
  if (!jobDescription) return new Set();
  return new Set(
    extractEntityMentions(jobDescription).map((e) =>
      normalizeForMatching(e).toLowerCase(),
    ),
  );
}

/**
 * Validates a generated document against the verified claim list. Returns
 * `{ ok: true }` only if every span survives all seven passes.
 *
 * `options.disabledPasses` exists solely for
 * `scripts/verify-validator-mutations.mjs` to prove each pass is load-
 * bearing (disabling it must flip at least one adversarial fixture from
 * rejected to accepted) -- never set it outside that harness.
 */
export function validate(
  spans: readonly DocumentSpan[],
  claims: readonly Claim[],
  options: ValidateOptions = {},
): ValidationResult {
  const disabled = new Set<PassName>(options.disabledPasses ?? []);
  const claimsById = new Map(claims.map((c) => [c.id, c]));
  const jdAllowlist = buildJdAllowlist(options.jobDescription);

  const violations: Violation[] = [];
  const allResolvedClaims: Claim[] = [];

  for (const span of spans) {
    if (!disabled.has("citationCompleteness")) {
      violations.push(...checkCitationCompleteness(span));
    }

    let resolvedClaims: Claim[] = span.claimIds
      .map((id) => claimsById.get(id))
      .filter((c): c is Claim => c !== undefined);

    if (!disabled.has("citationResolution")) {
      const result = checkCitationResolution(span, claimsById);
      violations.push(...result.violations);
      resolvedClaims = result.resolvedClaims;
    }
    allResolvedClaims.push(...resolvedClaims);

    if (!disabled.has("quantityContainment")) {
      violations.push(...checkQuantityContainment(span, resolvedClaims));
    }
    if (!disabled.has("entityClosure")) {
      violations.push(...checkEntityClosure(span, resolvedClaims, jdAllowlist));
      violations.push(...checkJdEcho(span, options.jobDescription));
    }
    if (!disabled.has("seniorityLexicon")) {
      violations.push(...checkSeniorityLexicon(span, resolvedClaims));
    }
    if (!disabled.has("employmentImplication")) {
      violations.push(...checkEmploymentImplication(span, resolvedClaims));
    }
  }

  if (!disabled.has("timelineCoherence")) {
    violations.push(...checkTimelineCoherence(allResolvedClaims));
  }

  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}

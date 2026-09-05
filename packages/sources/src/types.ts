import type { JobSourceProvider } from "@jobhunter/shared-types";

/**
 * One adapter per job source (Greenhouse, Lever, Adzuna, ...). See
 * PLAN.md §Job ingestion for the verified endpoints and the tiering
 * rationale (tier 1: public ATS JSON, no ToS conflict; tier 2: keyed
 * aggregator APIs; tier 3: assisted browser sessions via apps/assist only,
 * D6).
 */
export interface SourceCapabilities {
  fullDescription: boolean;
  incrementalSync: boolean;
  applicationQuestions: boolean;
  salary: boolean;
  requiresCredentials: boolean;
  requiresBrowser: boolean;
}

export interface RateLimitPolicy {
  rps: number;
  burst: number;
  dailyQuota?: number;
}

/** The untouched payload as the source returned it -- `rawPayload` is retained so a reparse never needs to re-fetch. */
export interface RawListing {
  sourceId: JobSourceProvider;
  sourceJobId: string;
  rawPayload: unknown;
  payloadHash: string;
  fetchedAt: Date;
}

export interface DiscoveryTask {
  query?: string;
  location?: string;
}

/**
 * The structured fields every adapter must be able to produce from a
 * `RawListing`, regardless of source. Only these fields -- never raw
 * source text -- are allowed to reach a matching/generation prompt later
 * (PLAN.md's prompt-injection mitigation for job descriptions).
 */
export interface ParsedJob {
  company: string;
  title: string;
  location: string | null;
  /** Sanitized to plain text (see sanitize.ts) -- never raw source HTML. */
  description: string;
  url: string;
  postedAt: Date | null;
}

export interface JobSourceAdapter {
  readonly id: JobSourceProvider;
  readonly tier: 1 | 2 | 3;
  readonly capabilities: SourceCapabilities;
  readonly rateLimit: RateLimitPolicy;
  discover(
    task: DiscoveryTask,
    cursor?: string,
  ): Promise<{ listings: RawListing[]; nextCursor?: string; fetchedAt: Date }>;
  /**
   * Pure -- no IO. Throws `AppError(SOURCE_SCHEMA_DRIFT)` (never inserts a
   * partial row) if the raw payload is missing a field this adapter
   * requires to produce a `ParsedJob`.
   */
  parse(raw: RawListing): ParsedJob;
}

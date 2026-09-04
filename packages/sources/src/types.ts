/**
 * One adapter per job source (Greenhouse, Lever, Adzuna, ...), implemented
 * in Phase 5. See PLAN.md §Job ingestion for the verified endpoints and the
 * tiering rationale (tier 1: public ATS JSON, no ToS conflict; tier 2: keyed
 * aggregator APIs; tier 3: assisted browser sessions via apps/assist only).
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

export interface RawListing {
  sourceId: string;
  sourceJobId: string;
  rawPayload: unknown;
  payloadHash: string;
  fetchedAt: Date;
}

export interface DiscoveryTask {
  query?: string;
  location?: string;
}

export interface JobSourceAdapter {
  readonly id: string;
  readonly tier: 1 | 2 | 3;
  readonly capabilities: SourceCapabilities;
  readonly rateLimit: RateLimitPolicy;
  discover(
    task: DiscoveryTask,
    cursor?: string,
  ): Promise<{ listings: RawListing[]; nextCursor?: string; fetchedAt: Date }>;
}

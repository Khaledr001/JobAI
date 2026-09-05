import { createHash } from "node:crypto";
import { AppError, ERROR_CODES } from "@jobhunter/shared-utils";
import { sanitizeHtml } from "./sanitize.js";
import type { DiscoveryTask, JobSourceAdapter, ParsedJob, RawListing } from "./types.js";

const BASE_URL = "https://boards-api.greenhouse.io";

/** Only the fields this adapter reads -- verified against a real live board (Sept 2026), not guessed from docs. */
interface GreenhouseJob {
  id: number;
  title?: string;
  absolute_url?: string;
  updated_at?: string;
  location?: { name?: string };
  content?: string;
  company_name?: string;
}

interface GreenhouseBoardResponse {
  jobs?: GreenhouseJob[];
}

export interface GreenhouseAdapterOptions {
  /** Injectable for tests -- avoids a real network dependency in the recorded-fixture conformance suite. */
  fetchImpl?: typeof fetch;
}

/**
 * `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` -- public,
 * unauthenticated, tier 1 (PLAN.md). `content=true` returns the full job
 * description inline, so no `fetchDetail` round trip is needed for Phase 5.
 */
export function createGreenhouseAdapter(
  boardToken: string,
  options: GreenhouseAdapterOptions = {},
): JobSourceAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    id: "greenhouse",
    tier: 1,
    capabilities: {
      fullDescription: true,
      incrementalSync: false,
      applicationQuestions: false,
      salary: false,
      requiresCredentials: false,
      requiresBrowser: false,
    },
    rateLimit: { rps: 2, burst: 5 },

    async discover(
      _task: DiscoveryTask,
    ): Promise<{ listings: RawListing[]; fetchedAt: Date }> {
      const res = await fetchImpl(
        `${BASE_URL}/v1/boards/${boardToken}/jobs?content=true`,
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `Greenhouse board fetch failed (${boardToken}): ${res.status} ${body.slice(0, 300)}`,
        );
      }
      const fetchedAt = new Date();
      const data = (await res.json()) as GreenhouseBoardResponse;
      const jobs = data.jobs ?? [];
      const listings: RawListing[] = jobs.map((job) => ({
        sourceId: "greenhouse",
        sourceJobId: String(job.id),
        rawPayload: job,
        payloadHash: createHash("sha256").update(JSON.stringify(job)).digest("hex"),
        fetchedAt,
      }));
      return { listings, fetchedAt };
    },

    parse(raw: RawListing): ParsedJob {
      const job = raw.rawPayload as GreenhouseJob;
      if (!job.title || !job.absolute_url || !job.id) {
        throw new AppError(
          ERROR_CODES.SOURCE_SCHEMA_DRIFT,
          `Greenhouse job ${raw.sourceJobId} is missing a required field (title/absolute_url/id)`,
        );
      }
      return {
        company: job.company_name ?? boardToken,
        title: job.title,
        location: job.location?.name?.trim() || null,
        description: job.content ? sanitizeHtml(job.content) : "",
        url: job.absolute_url,
        postedAt: job.updated_at ? new Date(job.updated_at) : null,
      };
    },
  };
}

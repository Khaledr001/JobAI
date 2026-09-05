import { createHash } from "node:crypto";
import { AppError, ERROR_CODES } from "@jobhunter/shared-utils";
import { sanitizeHtml } from "./sanitize.js";
import type { DiscoveryTask, JobSourceAdapter, ParsedJob, RawListing } from "./types.js";

const BASE_URL = "https://api.lever.co";

/** Only the fields this adapter reads -- verified against a real live board (Sept 2026). */
interface LeverPosting {
  id: string;
  text?: string;
  hostedUrl?: string;
  createdAt?: number;
  categories?: { location?: string; commitment?: string; team?: string };
  descriptionPlain?: string;
}

export interface LeverAdapterOptions {
  /** Injectable for tests -- avoids a real network dependency in the recorded-fixture conformance suite. */
  fetchImpl?: typeof fetch;
}

/**
 * `api.lever.co/v0/postings/{company}?mode=json` -- public, unauthenticated,
 * tier 1 (PLAN.md). Returns a flat array (unlike Greenhouse's `{jobs: []}`
 * envelope) with `descriptionPlain` already plain text, not HTML.
 */
export function createLeverAdapter(
  company: string,
  options: LeverAdapterOptions = {},
): JobSourceAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    id: "lever",
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
      const res = await fetchImpl(`${BASE_URL}/v0/postings/${company}?mode=json`);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `Lever board fetch failed (${company}): ${res.status} ${body.slice(0, 300)}`,
        );
      }
      const fetchedAt = new Date();
      const postings = (await res.json()) as LeverPosting[];
      const listings: RawListing[] = postings.map((posting) => ({
        sourceId: "lever",
        sourceJobId: posting.id,
        rawPayload: posting,
        payloadHash: createHash("sha256").update(JSON.stringify(posting)).digest("hex"),
        fetchedAt,
      }));
      return { listings, fetchedAt };
    },

    parse(raw: RawListing): ParsedJob {
      const posting = raw.rawPayload as LeverPosting;
      if (!posting.text || !posting.hostedUrl || !posting.id) {
        throw new AppError(
          ERROR_CODES.SOURCE_SCHEMA_DRIFT,
          `Lever posting ${raw.sourceJobId} is missing a required field (text/hostedUrl/id)`,
        );
      }
      return {
        company,
        title: posting.text,
        location: posting.categories?.location?.trim() || null,
        description: posting.descriptionPlain
          ? sanitizeHtml(posting.descriptionPlain)
          : "",
        url: posting.hostedUrl,
        postedAt: posting.createdAt ? new Date(posting.createdAt) : null,
      };
    },
  };
}

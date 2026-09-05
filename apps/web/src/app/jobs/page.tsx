"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getJobs } from "@/lib/api-client";
import { useAuthGuard } from "@/lib/use-auth-guard";

/**
 * PLAN.md's "Jobs (recommended/new/saved/rejected)" tabs need a per-operator
 * status this system doesn't have yet -- that's Phase 9's applications
 * state machine (discovered -> ... -> applied -> ...). Until then this is
 * one list, every ingested job, newest-seen first -- real, not a stub, just
 * not yet segmented. See docs/DECISIONS.md.
 */
export default function JobsPage() {
  const ready = useAuthGuard();
  const {
    data: jobs,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["jobs"],
    queryFn: getJobs,
    enabled: ready,
  });

  if (!ready) return null;

  return (
    <main>
      <h1 className="text-xl font-semibold">Jobs</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every ingested job, most recently seen first. Open one to see a real match
        explanation.
      </p>

      {isLoading && <p className="mt-6 text-sm text-neutral-500">Loading...</p>}
      {error && (
        <p className="mt-6 text-sm text-red-600">
          Failed to load jobs: {(error as Error).message}
        </p>
      )}

      <ul className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {jobs?.map((job) => (
          <li key={job.id}>
            <Link
              href={`/jobs/${job.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50"
            >
              <div>
                <p className="text-sm font-medium">{job.title}</p>
                <p className="text-xs text-neutral-500">
                  {job.company}
                  {job.location ? ` · ${job.location}` : ""}
                </p>
              </div>
              <span className="text-xs text-neutral-400">
                {new Date(job.lastSeenAt).toLocaleDateString()}
              </span>
            </Link>
          </li>
        ))}
        {jobs?.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-neutral-500">
            No jobs ingested yet -- POST /jobs/ingest with a real Greenhouse or Lever
            board token.
          </li>
        )}
      </ul>
    </main>
  );
}

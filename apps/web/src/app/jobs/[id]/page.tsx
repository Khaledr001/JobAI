"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { getJob, getJobMatch } from "@/lib/api-client";
import { useAuthGuard } from "@/lib/use-auth-guard";

const BAND_LABEL: Record<string, string> = {
  gated: "Gated",
  stretch: "Stretch",
  worth_applying: "Worth applying",
  strong: "Strong match",
};

const BAND_CLASS: Record<string, string> = {
  gated: "bg-neutral-200 text-neutral-700",
  stretch: "bg-amber-100 text-amber-800",
  worth_applying: "bg-blue-100 text-blue-800",
  strong: "bg-green-100 text-green-800",
};

export default function JobDetailPage() {
  const ready = useAuthGuard();
  const { id } = useParams<{ id: string }>();

  const jobQuery = useQuery({
    queryKey: ["job", id],
    queryFn: () => getJob(id),
    enabled: ready,
  });
  const matchQuery = useQuery({
    queryKey: ["job-match", id],
    queryFn: () => getJobMatch(id),
    enabled: ready,
  });

  if (!ready) return null;

  const job = jobQuery.data;
  const match = matchQuery.data;

  return (
    <main className="space-y-6">
      {jobQuery.isLoading && <p className="text-sm text-neutral-500">Loading job...</p>}
      {jobQuery.error && (
        <p className="text-sm text-red-600">
          Failed to load job: {(jobQuery.error as Error).message}
        </p>
      )}

      {job && (
        <div>
          <h1 className="text-xl font-semibold">{job.title}</h1>
          <p className="text-sm text-neutral-500">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
          </p>
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-sm text-blue-600 hover:underline"
          >
            View original posting →
          </a>
        </div>
      )}

      {matchQuery.isLoading && (
        <p className="text-sm text-neutral-500">Scoring match...</p>
      )}
      {matchQuery.error && (
        <p className="text-sm text-red-600">
          Failed to score match: {(matchQuery.error as Error).message}
        </p>
      )}

      {match && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">{match.headline}</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${BAND_CLASS[match.band] ?? ""}`}
            >
              {BAND_LABEL[match.band] ?? match.band}
            </span>
          </div>

          {!match.gates.passed && (
            <p className="mt-2 text-sm text-neutral-600">
              Gated: {match.gates.failures.join(", ")}
            </p>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-neutral-500">Stack fit</dt>
              <dd className="font-medium">
                {Math.round(match.subScores.stackFit * 100)}%
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Recency fit</dt>
              <dd className="font-medium">
                {Math.round(match.subScores.recencyFit * 100)}%
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Seniority fit</dt>
              <dd className="font-medium">
                {Math.round(match.subScores.seniorityFit * 100)}%
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Domain overlap</dt>
              <dd className="font-medium">
                {Math.round(match.subScores.domainOverlap * 100)}%
              </dd>
            </div>
          </dl>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold text-neutral-700">Matched</h2>
              <ul className="mt-2 space-y-2">
                {match.matched.map((m) => (
                  <li key={m.technology} className="text-sm">
                    <span className="text-green-600">✓</span>{" "}
                    <span className="font-medium">{m.technology}</span>
                    <span className="text-neutral-500"> — "{m.quote}"</span>
                    {m.via !== m.technology && (
                      <span className="text-neutral-400"> (via {m.via})</span>
                    )}
                  </li>
                ))}
                {match.matched.length === 0 && (
                  <li className="text-sm text-neutral-400">Nothing matched.</li>
                )}
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-700">Missing</h2>
              <ul className="mt-2 space-y-2">
                {match.missing.map((m) => (
                  <li key={m.technology} className="text-sm">
                    <span className="text-amber-600">⚠</span>{" "}
                    <span className="font-medium">{m.technology}</span>
                    <span className="text-neutral-500"> — "{m.quote}"</span>
                    <span className="ml-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
                      {m.necessity}
                    </span>
                  </li>
                ))}
                {match.missing.length === 0 && (
                  <li className="text-sm text-neutral-400">Nothing missing.</li>
                )}
              </ul>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-semibold text-neutral-700">Ranked projects</h2>
            <ul className="mt-2 space-y-2">
              {match.relevantProjects.map((p) => (
                <li
                  key={p.projectId}
                  className="rounded border border-neutral-200 p-3 text-sm"
                >
                  <p className="font-medium">{p.projectName}</p>
                  <p className="text-neutral-500">{p.matchedTechnologies.join(", ")}</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    cites: {p.citedWorkEntry.title} (
                    {new Date(p.citedWorkEntry.occurredOn).toLocaleDateString()})
                  </p>
                </li>
              ))}
              {match.relevantProjects.length === 0 && (
                <li className="text-sm text-neutral-400">No relevant projects found.</li>
              )}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { getTechnologyScores, getWorkEntries } from "@/lib/api-client";
import { useAuthGuard } from "@/lib/use-auth-guard";

export default function WorkPage() {
  const ready = useAuthGuard();
  const scoresQuery = useQuery({
    queryKey: ["technology-scores"],
    queryFn: getTechnologyScores,
    enabled: ready,
  });
  const entriesQuery = useQuery({
    queryKey: ["work-entries"],
    queryFn: getWorkEntries,
    enabled: ready,
  });

  if (!ready) return null;

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">My Work</h1>
        <p className="mt-1 text-sm text-neutral-500">
          The claim ledger's projection -- recomputed from the real work-entry ledger,
          never hand-typed.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-neutral-700">Technology scores</h2>
        {scoresQuery.error && (
          <p className="mt-2 text-sm text-red-600">
            Failed to load: {(scoresQuery.error as Error).message}
          </p>
        )}
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {scoresQuery.data?.map((s) => (
            <li
              key={s.technologyId}
              className="rounded border border-neutral-200 bg-white p-3"
            >
              <p className="text-sm font-medium">
                {s.technology?.canonicalName ?? s.technologyId}
              </p>
              <p className="text-xs text-neutral-500">
                {Math.round(Number(s.compositeScore) * 100)}% · {s.verification}
              </p>
            </li>
          ))}
        </ul>
        {scoresQuery.data?.length === 0 && (
          <p className="mt-2 text-sm text-neutral-400">No scores yet.</p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-700">Recent work entries</h2>
        {entriesQuery.error && (
          <p className="mt-2 text-sm text-red-600">
            Failed to load: {(entriesQuery.error as Error).message}
          </p>
        )}
        <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {entriesQuery.data?.slice(0, 30).map((entry) => (
            <li key={entry.id} className="px-4 py-3">
              <p className="text-sm font-medium">{entry.title}</p>
              <p className="text-xs text-neutral-500">
                {entry.type} · {new Date(entry.occurredOn).toLocaleDateString()}
              </p>
            </li>
          ))}
          {entriesQuery.data?.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-neutral-400">
              No work entries yet.
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}

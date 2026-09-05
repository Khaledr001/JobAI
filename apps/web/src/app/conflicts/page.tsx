"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getConflicts,
  resolveConflict,
  type ResolveConflictInput,
} from "@/lib/api-client";
import { useAuthGuard } from "@/lib/use-auth-guard";

export default function ConflictsPage() {
  const ready = useAuthGuard();
  const queryClient = useQueryClient();
  const {
    data: conflicts,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["conflicts"],
    queryFn: getConflicts,
    enabled: ready,
  });

  const resolve = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResolveConflictInput }) =>
      resolveConflict(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conflicts"] }),
  });

  if (!ready) return null;

  return (
    <main>
      <h1 className="text-xl font-semibold">Conflicts</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Sources that disagree about a fact. Resolving one that blocks emission makes its
        claim(s) emittable again.
      </p>

      {isLoading && <p className="mt-6 text-sm text-neutral-500">Loading...</p>}
      {error && (
        <p className="mt-6 text-sm text-red-600">
          Failed to load: {(error as Error).message}
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {conflicts?.map((conflict) => (
          <li
            key={conflict.id}
            className="rounded-lg border border-neutral-200 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{conflict.subject}</p>
                <p className="text-xs text-neutral-500">
                  {conflict.kind}
                  {conflict.blocksEmission && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-red-700">
                      blocks emission
                    </span>
                  )}
                  <span className="ml-2">status: {conflict.status}</span>
                </p>
              </div>
            </div>

            <ul className="mt-3 space-y-1">
              {conflict.positions.map((pos) => (
                <li key={pos.id} className="text-sm text-neutral-700">
                  · {pos.display}{" "}
                  <span className="text-xs text-neutral-400">
                    (strength {pos.strength})
                  </span>
                </li>
              ))}
            </ul>

            {conflict.status === "open" && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={resolve.isPending}
                  onClick={() =>
                    resolve.mutate({ id: conflict.id, input: { status: "resolved" } })
                  }
                  className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Mark resolved
                </button>
                <button
                  type="button"
                  disabled={resolve.isPending}
                  onClick={() =>
                    resolve.mutate({
                      id: conflict.id,
                      input: { status: "accepted_both" },
                    })
                  }
                  className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  Accept both
                </button>
                <button
                  type="button"
                  disabled={resolve.isPending}
                  onClick={() =>
                    resolve.mutate({ id: conflict.id, input: { status: "wont_fix" } })
                  }
                  className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  Won't fix
                </button>
              </div>
            )}
          </li>
        ))}
        {conflicts?.length === 0 && (
          <li className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-400">
            No open conflicts.
          </li>
        )}
      </ul>
    </main>
  );
}

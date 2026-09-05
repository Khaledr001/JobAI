"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LayoutGrid, ScrollText, Undo2 } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { AddWorkForm } from "@/components/work/add-work-form";
import { getTechnologyScores, getWorkEntries, retractWorkEntry } from "@/lib/api-client";
import { useAuthGuard } from "@/lib/use-auth-guard";

const VERIFICATION_TONE: Record<string, Tone> = {
  attested: "neutral",
  documented: "info",
  corroborated: "brand",
  measured: "success",
};

export default function WorkPage() {
  const ready = useAuthGuard();
  const queryClient = useQueryClient();
  // Two-step confirm rather than window.confirm: retraction is reversible in
  // principle (the row survives with `retracted_at` set) but there is no UI
  // to undo it, so it should not be one stray click away.
  const [confirmingRetract, setConfirmingRetract] = useState<string | null>(null);

  const retract = useMutation({
    mutationFn: retractWorkEntry,
    onSuccess: async () => {
      setConfirmingRetract(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["work-entries"] }),
        queryClient.invalidateQueries({ queryKey: ["technology-scores"] }),
      ]);
    },
  });

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

  const scores = useMemo(
    () =>
      [...(scoresQuery.data ?? [])].sort(
        (a, b) => Number(b.compositeScore) - Number(a.compositeScore),
      ),
    [scoresQuery.data],
  );

  if (!ready) return null;

  return (
    <div className="animate-in space-y-7">
      <PageHeader
        title="My Work"
        description="Recomputed from the work-entry ledger — never hand-typed, never allowed to go stale."
      />

      <AddWorkForm />

      <Card>
        <CardHeader
          title="Technology scores"
          description="Composite of recency, depth, and breadth"
          action={scores.length > 0 && <Badge tone="neutral">{scores.length}</Badge>}
        />
        <div className="p-6">
          {scoresQuery.error && <ErrorState error={scoresQuery.error} />}

          {scoresQuery.isLoading && (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-1.5 w-full" />
                </div>
              ))}
            </div>
          )}

          {!scoresQuery.isLoading && !scoresQuery.error && scores.length === 0 && (
            <EmptyState
              icon={<LayoutGrid className="size-5" />}
              title="No technology scores yet"
              description="Scores are projected from tagged work entries. Run the ingest tool or add work entries to populate them."
            />
          )}

          {scores.length > 0 && (
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {scores.map((score) => {
                const pct = Math.round(Number(score.compositeScore) * 100);
                return (
                  <div key={score.technologyId}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {score.technology?.canonicalName ?? "Unknown"}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={VERIFICATION_TONE[score.verification] ?? "neutral"}>
                          {score.verification}
                        </Badge>
                        <span className="text-sm font-semibold tabular-nums">{pct}%</span>
                      </div>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className="bg-brand-gradient h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-subtle-foreground">
                      {score.projectCount} project{score.projectCount === 1 ? "" : "s"} ·{" "}
                      {score.monthsActive} month{score.monthsActive === 1 ? "" : "s"}{" "}
                      active
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Recent work"
          description="The append-only ledger everything above is derived from"
          action={
            entriesQuery.data && (
              <Badge tone="neutral">{entriesQuery.data.length} entries</Badge>
            )
          }
        />

        {entriesQuery.error && (
          <div className="p-6">
            <ErrorState error={entriesQuery.error} />
          </div>
        )}

        {entriesQuery.isLoading && (
          <div className="space-y-4 p-6">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        )}

        {!entriesQuery.isLoading && entriesQuery.data?.length === 0 && (
          <EmptyState
            icon={<ScrollText className="size-5" />}
            title="No work entries yet"
            description="Every claim this system can emit traces back to an entry here."
          />
        )}

        <ul className="divide-y divide-border">
          {entriesQuery.data?.slice(0, 40).map((entry) => (
            <li key={entry.id} className="group flex items-start gap-3.5 px-6 py-4">
              <span className="bg-brand-gradient mt-1.5 size-2 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{entry.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-subtle-foreground">
                  <Badge tone="neutral">{entry.type}</Badge>
                  <span className="tabular-nums">
                    {new Date(entry.occurredOn).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {confirmingRetract === entry.id ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Retract?</span>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={retract.isPending}
                    onClick={() => retract.mutate(entry.id)}
                  >
                    Confirm
                  </Button>
                  <Button size="sm" onClick={() => setConfirmingRetract(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Undo2 className="size-3.5" />}
                  aria-label={`Retract ${entry.title}`}
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => setConfirmingRetract(entry.id)}
                >
                  Retract
                </Button>
              )}
            </li>
          ))}
        </ul>

        {retract.error && (
          <div className="border-t border-border p-6">
            <ErrorState error={retract.error} />
          </div>
        )}

        {(entriesQuery.data?.length ?? 0) > 40 && (
          <p className="border-t border-border px-6 py-4 text-xs text-subtle-foreground">
            Showing the 40 most recent of {entriesQuery.data?.length}.
          </p>
        )}
      </Card>
    </div>
  );
}

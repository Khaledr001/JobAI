"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCheck, GitCompareArrows, Scale, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import {
  getConflicts,
  resolveConflict,
  type Conflict,
  type ResolveConflictInput,
} from "@/lib/api-client";
import { useAuthGuard } from "@/lib/use-auth-guard";

export default function ConflictsPage() {
  const ready = useAuthGuard();
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const {
    data: conflicts,
    error,
    isLoading,
  } = useQuery({ queryKey: ["conflicts"], queryFn: getConflicts, enabled: ready });

  const resolve = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResolveConflictInput }) =>
      resolveConflict(id, input),
    onMutate: ({ id }) => setPendingId(id),
    onSettled: () => {
      setPendingId(null);
      void queryClient.invalidateQueries({ queryKey: ["conflicts"] });
    },
  });

  if (!ready) return null;

  const open = conflicts?.filter((c) => c.status === "open") ?? [];
  const settled = conflicts?.filter((c) => c.status !== "open") ?? [];

  return (
    <div className="animate-in">
      <PageHeader
        title="Conflicts"
        description="Sources that disagree. Anything blocking emission keeps its claims off every generated document until you decide."
        action={open.length > 0 && <Badge tone="warning">{open.length} open</Badge>}
      />

      {error && <ErrorState error={error} />}

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 2 }, (_, i) => (
            <Card key={i}>
              <CardBody className="space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/5" />
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && !error && conflicts?.length === 0 && (
        <Card>
          <EmptyState
            icon={<GitCompareArrows className="size-5" />}
            title="No conflicts"
            description="Every source in your ledger currently agrees. New ones appear here as sources are ingested."
          />
        </Card>
      )}

      <div className="space-y-5">
        {open.map((conflict) => (
          <ConflictCard
            key={conflict.id}
            conflict={conflict}
            busy={pendingId === conflict.id}
            onResolve={(input) => resolve.mutate({ id: conflict.id, input })}
          />
        ))}
      </div>

      {settled.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-xs font-semibold tracking-wide text-subtle-foreground uppercase">
            Resolved
          </h2>
          <div className="space-y-3">
            {settled.map((conflict) => (
              <ConflictCard key={conflict.id} conflict={conflict} busy={false} />
            ))}
          </div>
        </>
      )}

      {resolve.error && (
        <div className="mt-4">
          <ErrorState error={resolve.error} />
        </div>
      )}
    </div>
  );
}

function ConflictCard({
  conflict,
  busy,
  onResolve,
}: {
  conflict: Conflict;
  busy: boolean;
  onResolve?: (input: ResolveConflictInput) => void;
}) {
  const isOpen = conflict.status === "open";

  return (
    <Card
      className={cn(
        !isOpen && "opacity-65 shadow-none",
        isOpen && conflict.blocksEmission && "border-danger/35",
      )}
    >
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-tight">{conflict.subject}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{conflict.kind}</Badge>
              {conflict.blocksEmission && <Badge tone="danger">blocks emission</Badge>}
              {!isOpen && <Badge tone="success">{conflict.status}</Badge>}
            </div>
          </div>
        </div>

        <ul className="space-y-1.5">
          {conflict.positions.map((position) => (
            <li
              key={position.id}
              className="flex items-start gap-3 rounded-xl bg-surface-sunken px-3.5 py-2.5"
            >
              <Scale className="mt-0.5 size-3.5 shrink-0 text-subtle-foreground" />
              <span className="min-w-0 flex-1 text-sm">{position.display}</span>
              <span className="shrink-0 text-xs tabular-nums text-subtle-foreground">
                strength {position.strength}
              </span>
            </li>
          ))}
        </ul>

        {isOpen && onResolve && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              variant="primary"
              loading={busy}
              icon={<CheckCheck className="size-4" />}
              onClick={() => onResolve({ status: "resolved" })}
            >
              Resolved
            </Button>
            <Button loading={busy} onClick={() => onResolve({ status: "accepted_both" })}>
              Accept both
            </Button>
            <Button
              variant="ghost"
              loading={busy}
              icon={<XCircle className="size-4" />}
              onClick={() => onResolve({ status: "wont_fix" })}
            >
              Won&apos;t fix
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

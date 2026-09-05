"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, FileStack, Fingerprint, ShieldCheck } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { CompanyAvatar } from "@/components/ui/avatar";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import {
  getApplications,
  getJobs,
  transitionApplication,
  type Application,
  type ApplicationStatus,
} from "@/lib/api-client";
import { useAuthGuard } from "@/lib/use-auth-guard";

/**
 * Mirrors @jobhunter/shared-utils' APPLICATION_TRANSITIONS so the UI only
 * ever offers a move the service (and the DB trigger behind it) will
 * accept. Both still enforce it independently -- this list is for
 * affordance, not enforcement.
 */
const NEXT_STATUSES: Record<ApplicationStatus, ApplicationStatus[]> = {
  discovered: ["matched"],
  matched: ["drafted"],
  drafted: ["approved"],
  approved: ["applied"],
  applied: ["replied", "ghosted", "rejected"],
  replied: ["interviewing", "rejected"],
  interviewing: ["offer", "rejected", "ghosted"],
  offer: [],
  rejected: [],
  ghosted: [],
};

const STATUS_TONE: Record<ApplicationStatus, Tone> = {
  discovered: "neutral",
  matched: "info",
  drafted: "info",
  approved: "brand",
  applied: "brand",
  replied: "info",
  interviewing: "warning",
  offer: "success",
  rejected: "danger",
  ghosted: "neutral",
};

const PIPELINE: ApplicationStatus[] = [
  "discovered",
  "matched",
  "drafted",
  "approved",
  "applied",
  "replied",
  "interviewing",
];

export default function ApplicationsPage() {
  const ready = useAuthGuard();
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const appsQuery = useQuery({
    queryKey: ["applications"],
    queryFn: getApplications,
    enabled: ready,
  });
  const jobsQuery = useQuery({ queryKey: ["jobs"], queryFn: getJobs, enabled: ready });

  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApplicationStatus }) =>
      transitionApplication(id, { status }),
    onMutate: ({ id }) => setPendingId(id),
    onSettled: () => {
      setPendingId(null);
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  if (!ready) return null;

  const apps = appsQuery.data ?? [];
  const jobById = new Map((jobsQuery.data ?? []).map((j) => [j.id, j]));
  const counts = PIPELINE.map((status) => ({
    status,
    count: apps.filter((a) => a.status === status).length,
  }));

  return (
    <div className="animate-in">
      <PageHeader
        title="Applications"
        description="The state machine. Approval freezes an immutable snapshot of exactly what was sent."
        action={apps.length > 0 && <Badge tone="brand">{apps.length} tracked</Badge>}
      />

      {appsQuery.error && <ErrorState error={appsQuery.error} />}

      {!appsQuery.error && (
        <>
          {apps.length > 0 && (
            <Card className="mb-6 overflow-hidden">
              {/* One strip rather than seven separate chips -- the pipeline is
                  a sequence, and separate tiles lose that reading. */}
              <ol className="grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x lg:grid-cols-7">
                {counts.map(({ status, count }) => (
                  <li key={status} className="px-4 py-4 text-center">
                    <p
                      className={`text-2xl font-semibold tabular-nums ${
                        count > 0 ? "text-foreground" : "text-subtle-foreground/50"
                      }`}
                    >
                      {count}
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground capitalize">
                      {status}
                    </p>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card className="overflow-hidden">
            {appsQuery.isLoading && <SkeletonRows rows={3} />}

            {!appsQuery.isLoading && apps.length === 0 && (
              <EmptyState
                icon={<FileStack className="size-5" />}
                title="No applications tracked yet"
                description="Open a job and hit “Track application” to start it at discovered."
                action={
                  <Link href="/jobs">
                    <Button size="sm" variant="secondary">
                      Browse jobs
                    </Button>
                  </Link>
                }
              />
            )}

            <ul className="divide-y divide-border">
              {apps.map((app) => (
                <ApplicationRow
                  key={app.id}
                  application={app}
                  jobTitle={jobById.get(app.jobId)?.title}
                  jobCompany={jobById.get(app.jobId)?.company}
                  busy={pendingId === app.id}
                  onMove={(status) => move.mutate({ id: app.id, status })}
                />
              ))}
            </ul>
          </Card>

          {move.error && (
            <div className="mt-4">
              <ErrorState error={move.error} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ApplicationRow({
  application,
  jobTitle,
  jobCompany,
  busy,
  onMove,
}: {
  application: Application;
  jobTitle?: string | undefined;
  jobCompany?: string | undefined;
  busy: boolean;
  onMove: (status: ApplicationStatus) => void;
}) {
  const next = NEXT_STATUSES[application.status];
  const frozen = application.snapshotChecksumPdf !== null;

  return (
    <li className="px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <CompanyAvatar name={jobCompany ?? jobTitle ?? "?"} size="md" />
          <div className="min-w-0">
            <Link
              href={`/jobs/${application.jobId}`}
              className="text-base font-semibold tracking-tight hover:text-brand hover:underline"
            >
              {jobTitle ?? "Untitled job"}
            </Link>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              {jobCompany && <span className="font-medium">{jobCompany}</span>}
              <Badge tone={STATUS_TONE[application.status]}>{application.status}</Badge>
              {application.appliedAt && (
                <span>
                  applied {new Date(application.appliedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {next.length === 0 ? (
            <span className="text-xs text-subtle-foreground">Terminal state</span>
          ) : (
            next.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={status === next[0] ? "primary" : "secondary"}
                loading={busy}
                onClick={() => onMove(status)}
                icon={
                  status === next[0] ? <ArrowRight className="size-3.5" /> : undefined
                }
              >
                {status}
              </Button>
            ))
          )}
        </div>
      </div>

      {frozen && (
        <Card className="mt-4 bg-surface-muted/50 shadow-none">
          <CardBody className="space-y-2 p-3.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-success" />
              <span className="text-xs font-medium">
                Snapshot frozen at approval
                {application.approvedAt &&
                  ` · ${new Date(application.approvedAt).toLocaleString()}`}
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-1.5 text-[11px] sm:grid-cols-2">
              <SnapshotField
                label="PDF sha256"
                value={application.snapshotChecksumPdf ?? "—"}
                mono
              />
              <SnapshotField
                label="Claims cited"
                value={`${application.snapshotClaimIds?.length ?? 0}`}
              />
              <SnapshotField label="Model" value={application.snapshotModel ?? "—"} />
              <SnapshotField
                label="Prompt"
                value={application.snapshotPromptVersion ?? "—"}
              />
            </dl>
          </CardBody>
        </Card>
      )}
    </li>
  );
}

function SnapshotField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="flex shrink-0 items-center gap-1 text-subtle-foreground">
        {mono && <Fingerprint className="size-3" />}
        {label}
      </dt>
      <dd className={`min-w-0 truncate ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

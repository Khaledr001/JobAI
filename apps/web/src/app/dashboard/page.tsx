"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  FileStack,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { APPLICATION_STATUSES } from "@jobhunter/shared-types/values";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { CompanyAvatar } from "@/components/ui/avatar";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { StatCard } from "@/components/ui/stat-card";
import {
  getApplications,
  getConflicts,
  getJobs,
  getTechnologyScores,
  getWorkEntries,
} from "@/lib/api-client";
import { useAuthGuard } from "@/lib/use-auth-guard";

/** Terminal states -- an application here is no longer live work. */
const CLOSED = new Set(["offer", "rejected", "ghosted"]);

/**
 * Deliberately built only from cheap list endpoints. A "best match" tile
 * would be the obvious thing to put here and is exactly what this page must
 * not do: scoring is a real query per job (claims + taxonomy graph +
 * projects), so a headline match number costs one round trip per posting.
 * Scores are computed when you open a job, and nothing here invents one.
 */
export default function DashboardPage() {
  const ready = useAuthGuard();

  const jobs = useQuery({ queryKey: ["jobs"], queryFn: getJobs, enabled: ready });
  const applications = useQuery({
    queryKey: ["applications"],
    queryFn: getApplications,
    enabled: ready,
  });
  const workEntries = useQuery({
    queryKey: ["work-entries"],
    queryFn: getWorkEntries,
    enabled: ready,
  });
  const scores = useQuery({
    queryKey: ["technology-scores"],
    queryFn: getTechnologyScores,
    enabled: ready,
  });
  const conflicts = useQuery({
    queryKey: ["conflicts"],
    queryFn: getConflicts,
    enabled: ready,
  });

  const pipeline = useMemo(() => {
    const counts = new Map<string, number>();
    for (const app of applications.data ?? []) {
      counts.set(app.status, (counts.get(app.status) ?? 0) + 1);
    }
    return APPLICATION_STATUSES.map((status) => ({
      status,
      count: counts.get(status) ?? 0,
    })).filter((row) => row.count > 0);
  }, [applications.data]);

  const liveCount = useMemo(
    () => (applications.data ?? []).filter((a) => !CLOSED.has(a.status)).length,
    [applications.data],
  );

  // "Verified" here means what the ledger means by it: only `documented` and
  // above are emittable, so an `attested` skill is not a skill this system
  // will put on a resume, and must not be counted as one.
  // `attested` is the only non-emittable level, so everything above it counts.
  const emittableSkills = useMemo(
    () => (scores.data ?? []).filter((s) => s.verification !== "attested").length,
    [scores.data],
  );

  const topSkills = useMemo(
    () =>
      [...(scores.data ?? [])]
        .sort((a, b) => Number(b.compositeScore) - Number(a.compositeScore))
        .slice(0, 6),
    [scores.data],
  );

  const openConflicts = useMemo(
    () => (conflicts.data ?? []).filter((c) => c.status === "open"),
    [conflicts.data],
  );
  const blockingConflicts = openConflicts.filter((c) => c.blocksEmission).length;

  const recentJobs = useMemo(
    () =>
      [...(jobs.data ?? [])]
        .sort((a, b) => +new Date(b.lastSeenAt) - +new Date(a.lastSeenAt))
        .slice(0, 5),
    [jobs.data],
  );

  const recentWork = useMemo(
    () =>
      [...(workEntries.data ?? [])]
        .sort((a, b) => +new Date(b.occurredOn) - +new Date(a.occurredOn))
        .slice(0, 5),
    [workEntries.data],
  );

  if (!ready) return null;

  // Safe to read the clock: `ready` only flips in an effect, so this render
  // never happens on the server and cannot mismatch during hydration.
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const firstError =
    jobs.error ?? applications.error ?? workEntries.error ?? scores.error;

  return (
    <div className="animate-in space-y-8">
      {/* Hero */}
      <div className="bg-brand-wash -mx-4 -mt-7 px-4 pt-8 pb-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:-mt-10 lg:px-10 lg:pt-12">
        <p className="text-sm font-medium text-brand">{greeting}</p>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight sm:text-4xl">
          Here&rsquo;s where things stand
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every number below is derived from your verified claim ledger — nothing here is
          estimated, and nothing this system emits can go beyond it.
        </p>
      </div>

      {firstError && <ErrorState error={firstError} />}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Jobs tracked"
          value={jobs.data?.length ?? 0}
          hint="Ingested postings"
          icon={<Briefcase className="size-5" />}
          tone="brand"
          href="/jobs"
          loading={jobs.isLoading}
        />
        <StatCard
          label="In pipeline"
          value={liveCount}
          hint={`${applications.data?.length ?? 0} total applications`}
          icon={<FileStack className="size-5" />}
          tone="info"
          href="/applications"
          loading={applications.isLoading}
        />
        <StatCard
          label="Emittable skills"
          value={emittableSkills}
          hint={`of ${scores.data?.length ?? 0} scored — attested doesn't count`}
          icon={<ShieldCheck className="size-5" />}
          tone="success"
          href="/work"
          loading={scores.isLoading}
        />
        <StatCard
          label="Open conflicts"
          value={openConflicts.length}
          hint={
            blockingConflicts > 0
              ? `${blockingConflicts} blocking emission`
              : "None blocking emission"
          }
          icon={<AlertTriangle className="size-5" />}
          tone={blockingConflicts > 0 ? "warning" : "neutral"}
          href="/conflicts"
          loading={conflicts.isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline */}
        <Card>
          <CardHeader
            title="Application pipeline"
            description="Where each tracked application currently sits"
            icon={<FileStack className="size-4.5" />}
          />
          <div className="p-6">
            {pipeline.length === 0 ? (
              <EmptyState
                icon={<FileStack className="size-5" />}
                title="No applications tracked yet"
                description="Open a job and choose “Track application” to start one."
              />
            ) : (
              <ul className="space-y-3">
                {pipeline.map(({ status, count }) => {
                  const max = Math.max(...pipeline.map((p) => p.count));
                  return (
                    <li key={status}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium capitalize">
                          {status.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">
                          {count}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                        <div
                          className="bg-brand-gradient h-full rounded-full transition-[width] duration-700"
                          style={{ width: `${(count / max) * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* Top skills */}
        <Card>
          <CardHeader
            title="Strongest technologies"
            description="Composite of recency, depth, and breadth"
            icon={<ShieldCheck className="size-4.5" />}
            action={
              <Link
                href="/work"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                All skills <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className="p-6">
            {topSkills.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck className="size-5" />}
                title="No technology scores yet"
                description="Add a work entry tagged with technologies to populate these."
              />
            ) : (
              <ul className="space-y-3.5">
                {topSkills.map((skill) => {
                  const pct = Math.round(Number(skill.compositeScore) * 100);
                  return (
                    <li key={skill.technologyId}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium">
                          {skill.technology?.canonicalName ?? "Unknown"}
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge
                            tone={
                              skill.verification === "attested" ? "neutral" : "success"
                            }
                          >
                            {skill.verification}
                          </Badge>
                          <span className="w-9 text-right text-sm font-semibold tabular-nums">
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                        <div
                          className="bg-brand-gradient h-full rounded-full transition-[width] duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent jobs */}
        <Card className="overflow-hidden">
          <CardHeader
            title="Latest postings"
            description="Most recently seen in an ingest run"
            icon={<Briefcase className="size-4.5" />}
            action={
              <Link
                href="/jobs"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                All jobs <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {recentJobs.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="size-5" />}
              title="No jobs ingested yet"
              description="POST /jobs/ingest with a Greenhouse or Lever board token."
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentJobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="group flex items-center gap-3 px-6 py-4 transition-colors hover:bg-surface-muted"
                  >
                    <CompanyAvatar name={job.company} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{job.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {job.company}
                        {job.location ? ` · ${job.location}` : ""}
                      </p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent work */}
        <Card className="overflow-hidden">
          <CardHeader
            title="Recent work"
            description="The ledger everything above is derived from"
            icon={<ScrollText className="size-4.5" />}
            action={
              <Link
                href="/work"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                Add work <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {recentWork.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="size-5" />}
              title="No work entries yet"
              description="Every claim this system can emit traces back to an entry here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentWork.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 px-6 py-4">
                  <span className="bg-brand-gradient mt-1.5 size-2 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{entry.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone="neutral">{entry.type}</Badge>
                      <span className="text-xs tabular-nums text-subtle-foreground">
                        {new Date(entry.occurredOn).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

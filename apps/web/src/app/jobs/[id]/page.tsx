"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  ExternalLink,
  FileText,
  FolderGit2,
  MapPin,
  Plus,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CompanyAvatar } from "@/components/ui/avatar";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { BAND_LABEL, BAND_TONE, ScoreBar, ScoreRing } from "@/components/ui/score";
import {
  ApiError,
  createApplication,
  generateDocument,
  getApplications,
  getJob,
  getJobMatch,
} from "@/lib/api-client";
import { useAuthGuard } from "@/lib/use-auth-guard";

export default function JobDetailPage() {
  const ready = useAuthGuard();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showFullDescription, setShowFullDescription] = useState(false);

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
  const appsQuery = useQuery({
    queryKey: ["applications"],
    queryFn: getApplications,
    enabled: ready,
  });

  const generate = useMutation({ mutationFn: () => generateDocument(id) });
  const track = useMutation({
    mutationFn: () => createApplication(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
  });

  if (!ready) return null;

  const job = jobQuery.data;
  const match = matchQuery.data;
  const existingApplication = appsQuery.data?.find((a) => a.jobId === id);

  return (
    <div className="animate-in space-y-6">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All jobs
      </Link>

      {jobQuery.error && <ErrorState error={jobQuery.error} />}

      {jobQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ) : (
        job && (
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
              <CompanyAvatar name={job.company} size="lg" />
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{job.company}</span>
                  {job.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-4" />
                      {job.location}
                    </span>
                  )}
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline"
                  >
                    Original posting
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {existingApplication ? (
                <Link href="/applications">
                  <Button variant="secondary" icon={<FileText className="size-4" />}>
                    Tracking · {existingApplication.status}
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="secondary"
                  icon={<Plus className="size-4" />}
                  loading={track.isPending}
                  onClick={() => track.mutate()}
                >
                  Track application
                </Button>
              )}
              <Button
                variant="primary"
                icon={<Sparkles className="size-4" />}
                loading={generate.isPending}
                onClick={() => generate.mutate()}
              >
                Generate resume
              </Button>
            </div>
          </div>
        )
      )}

      {track.error && <ErrorState error={track.error} />}

      {matchQuery.isLoading && (
        <Card>
          <CardBody className="flex items-center gap-5">
            <Skeleton className="size-26 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </CardBody>
        </Card>
      )}
      {matchQuery.error && <ErrorState error={matchQuery.error} />}

      {match && (
        <Card className="overflow-hidden">
          <div className="bg-brand-wash border-b border-border px-6 py-7">
            <div className="flex flex-wrap items-center gap-6">
              <ScoreRing score={match.headline} band={match.band} size={104} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge tone={BAND_TONE[match.band]}>{BAND_LABEL[match.band]}</Badge>
                  <span className="text-xs text-subtle-foreground">
                    scorer {match.scorerVersion}
                  </span>
                </div>
                <p className="mt-2 text-base text-muted-foreground">
                  {match.band === "gated"
                    ? "Gated before scoring — a hard requirement rules this out."
                    : `${match.matched.length} requirement${
                        match.matched.length === 1 ? "" : "s"
                      } matched, ${match.missing.length} missing.`}
                </p>
                {!match.gates.passed && match.gates.failures.length > 0 && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-soft px-3.5 py-2.5">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                    <p className="text-xs text-warning">
                      {match.gates.failures.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <CardBody>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <ScoreBar label="Stack fit" value={match.subScores.stackFit} />
              <ScoreBar label="Recency fit" value={match.subScores.recencyFit} />
              <ScoreBar label="Seniority fit" value={match.subScores.seniorityFit} />
              <ScoreBar label="Domain overlap" value={match.subScores.domainOverlap} />
            </div>
          </CardBody>
        </Card>
      )}

      {match && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Matched"
              description="Backed by a real technology score in your ledger"
              action={<Badge tone="success">{match.matched.length}</Badge>}
            />
            {match.matched.length === 0 ? (
              <EmptyState icon={<Check className="size-5" />} title="Nothing matched" />
            ) : (
              <ul className="divide-y divide-border">
                {match.matched.map((m) => (
                  <li key={m.technology} className="px-6 py-4">
                    <div className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {m.technology}
                          {m.via !== m.technology && (
                            <span className="ml-1.5 text-xs font-normal text-subtle-foreground">
                              via {m.via}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          “{m.quote}”
                        </p>
                      </div>
                      <span className="ml-auto text-xs tabular-nums text-subtle-foreground">
                        {Math.round(m.score * 100)}%
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Missing"
              description="Stated in the posting, absent from your ledger"
              action={<Badge tone="warning">{match.missing.length}</Badge>}
            />
            {match.missing.length === 0 ? (
              <EmptyState icon={<Check className="size-5" />} title="Nothing missing" />
            ) : (
              <ul className="divide-y divide-border">
                {match.missing.map((m) => (
                  <li key={m.technology} className="px-6 py-4">
                    <div className="flex items-start gap-2.5">
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{m.technology}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          “{m.quote}”
                        </p>
                      </div>
                      <Badge tone="neutral" className="ml-auto">
                        {m.necessity}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {match && match.relevantProjects.length > 0 && (
        <Card>
          <CardHeader
            title="Ranked projects"
            description="Each cites a real, dated work entry from your ledger"
          />
          <ul className="divide-y divide-border">
            {match.relevantProjects.map((p) => (
              <li key={p.projectId} className="flex items-start gap-3 px-6 py-4">
                <FolderGit2 className="mt-0.5 size-4 shrink-0 text-subtle-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.projectName}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {p.matchedTechnologies.map((t) => (
                      <Badge key={t} tone="brand">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 truncate text-xs text-subtle-foreground">
                    cites “{p.citedWorkEntry.title}” ·{" "}
                    {new Date(p.citedWorkEntry.occurredOn).toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(generate.data ?? generate.error) && (
        <Card>
          <CardHeader
            title="Generated resume"
            description="Every bullet cites a claim id — nothing here is unverified"
          />
          <CardBody>
            {generate.error && <GenerationError error={generate.error} />}
            {generate.data && (
              <ul className="space-y-2.5">
                {generate.data.spans.map((span) => (
                  <li
                    key={span.id}
                    className="rounded-xl border border-border bg-surface-muted/60 px-4 py-3.5"
                  >
                    <div className="flex items-start gap-2">
                      <Badge tone={span.kind === "bullet" ? "brand" : "neutral"}>
                        {span.kind}
                      </Badge>
                      <p className="min-w-0 flex-1 text-sm">{span.text}</p>
                    </div>
                    {span.claimIds.length > 0 && (
                      <p className="mt-2 font-mono text-[11px] break-all text-subtle-foreground">
                        cites {span.claimIds.join(", ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {job && (
        <Card>
          <CardHeader
            title="Job description"
            action={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowFullDescription((v) => !v)}
              >
                {showFullDescription ? "Collapse" : "Expand"}
              </Button>
            }
          />
          <CardBody>
            <p
              className={`text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground ${
                showFullDescription ? "" : "line-clamp-6"
              }`}
            >
              {job.description}
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/**
 * A generation failure is the interesting case, not an error to hide: a
 * DOCUMENT_VALIDATION_FAILED carries the exact anti-fabrication violations
 * that stopped the draft, and those are the most useful thing on the page.
 */
function GenerationError({ error }: { error: unknown }) {
  const violations =
    error instanceof ApiError && Array.isArray(error.details?.violations)
      ? (error.details.violations as Array<{
          code: string;
          span: string;
          detail?: string;
        }>)
      : null;

  if (!violations) return <ErrorState error={error} />;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
        <p className="text-sm text-danger">
          Rejected by the validator after one retry. Nothing was rendered or saved.
        </p>
      </div>
      <ul className="space-y-2">
        {violations.map((v, i) => (
          <li
            key={i}
            className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3"
          >
            <Badge tone="danger">{v.code}</Badge>
            <p className="mt-1.5 text-sm">“{v.span}”</p>
            {v.detail && (
              <p className="mt-0.5 text-xs text-muted-foreground">{v.detail}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

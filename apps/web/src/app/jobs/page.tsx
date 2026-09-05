"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Briefcase, Clock, MapPin, Search } from "lucide-react";
import { Badge, FilterChip } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CompanyAvatar } from "@/components/ui/avatar";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { getJobs, type JobCanonical } from "@/lib/api-client";
import { useAuthGuard } from "@/lib/use-auth-guard";

/**
 * PLAN.md's "recommended/new/saved/rejected" tabs need a per-job status that
 * only exists once an application is started -- see /applications. The chips
 * below filter on facts a posting carries on its own (recency, remote-ness).
 *
 * Match scores are deliberately NOT fetched per row: scoring is a real query
 * per job (claims + taxonomy graph + projects), so 90 rows would be 90 round
 * trips. It's computed when you open one.
 */
type Filter = "all" | "week" | "remote";

const DAY = 86_400_000;

function isRemote(job: JobCanonical): boolean {
  return /remote|anywhere|distributed/i.test(job.location ?? "");
}

function relativeDays(iso: string): string {
  const days = Math.floor((Date.now() - +new Date(iso)) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function JobsPage() {
  const ready = useAuthGuard();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const {
    data: jobs,
    isLoading,
    error,
  } = useQuery({ queryKey: ["jobs"], queryFn: getJobs, enabled: ready });

  const counts = useMemo(() => {
    const all = jobs ?? [];
    return {
      all: all.length,
      week: all.filter((j) => Date.now() - +new Date(j.lastSeenAt) < 7 * DAY).length,
      remote: all.filter(isRemote).length,
    };
  }, [jobs]);

  const filtered = useMemo(() => {
    let list = jobs ?? [];
    if (filter === "week") {
      list = list.filter((j) => Date.now() - +new Date(j.lastSeenAt) < 7 * DAY);
    } else if (filter === "remote") {
      list = list.filter(isRemote);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          (j.location ?? "").toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => +new Date(b.lastSeenAt) - +new Date(a.lastSeenAt));
  }, [jobs, query, filter]);

  if (!ready) return null;

  return (
    <div className="animate-in">
      <PageHeader
        title="Jobs"
        description="Every ingested posting. Open one to score it against your verified claims."
        action={
          jobs && (
            <Badge tone="brand">
              {filtered.length}
              {filtered.length !== jobs.length ? ` of ${jobs.length}` : ""} postings
            </Badge>
          )
        }
      />

      {error && <ErrorState error={error} />}

      {!error && (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-subtle-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, company, or location…"
                className="h-11 w-full rounded-xl border border-border bg-surface pr-4 pl-11 text-sm shadow-sm transition-colors outline-none placeholder:text-subtle-foreground focus:border-brand"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={filter === "all"}
                count={counts.all}
                onClick={() => setFilter("all")}
              >
                All
              </FilterChip>
              <FilterChip
                active={filter === "week"}
                count={counts.week}
                onClick={() => setFilter("week")}
              >
                This week
              </FilterChip>
              <FilterChip
                active={filter === "remote"}
                count={counts.remote}
                onClick={() => setFilter("remote")}
              >
                Remote
              </FilterChip>
            </div>
          </div>

          {isLoading && (
            <div className="grid gap-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Card key={i} className="flex items-center gap-4 p-5">
                  <Skeleton className="size-10 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <Card>
              <EmptyState
                icon={<Briefcase className="size-5" />}
                title={
                  jobs?.length ? "No jobs match that filter" : "No jobs ingested yet"
                }
                description={
                  jobs?.length
                    ? "Try a different search term, or switch back to All."
                    : "POST /jobs/ingest with a real Greenhouse or Lever board token to pull postings in."
                }
              />
            </Card>
          )}

          <div className="grid gap-3">
            {filtered.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="group block">
                <Card interactive className="flex items-center gap-4 p-5">
                  <CompanyAvatar name={job.company} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold tracking-tight">
                      {job.title}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-muted-foreground">
                      {job.company}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtle-foreground">
                      {job.location && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-3.5" />
                          {job.location}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        seen {relativeDays(job.lastSeenAt)}
                      </span>
                    </div>
                  </div>
                  <span className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100 sm:inline-flex">
                    Score it
                    <ArrowRight className="size-4" />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

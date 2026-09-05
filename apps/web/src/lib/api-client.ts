"use client";

import type {
  EvidenceKind,
  TechTagRole,
  WorkEntryType,
} from "@jobhunter/shared-types/values";

/**
 * The one place apps/web talks to apps/api -- no server actions (matches
 * the reference repo's convention: every data-access path stays visible
 * here, not scattered across server components). Auth is a bearer JWT in
 * `localStorage`, not a cookie -- apps/api's JwtStrategy only ever reads
 * `Authorization: Bearer <token>` (see jwt.strategy.ts), so a cookie-based
 * `credentials: "include"` call would silently hit the global JwtAuthGuard
 * and 401 on every route.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
const ACCESS_TOKEN_KEY = "jobhunter.accessToken";
const REFRESH_TOKEN_KEY = "jobhunter.refreshToken";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** apps/api's AllExceptionsFilter passes AppError.details through -- e.g. the anti-fabrication violations behind a DOCUMENT_VALIDATION_FAILED. */
    public readonly code?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : null,
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as {
      error?: { message?: string; code?: string; details?: Record<string, unknown> };
    } | null;
    throw new ApiError(
      res.status,
      errorBody?.error?.message ?? `${method} ${path} failed: ${res.status}`,
      errorBody?.error?.code,
      errorBody?.error?.details,
    );
  }
  if (res.status === 204) return undefined as T;
  const parsed = (await res.json()) as { data: T };
  return parsed.data;
}

export const apiGet = <T>(path: string) => request<T>("GET", path);
export const apiPost = <T>(path: string, body?: unknown) =>
  request<T>("POST", path, body);
export const apiPatch = <T>(path: string, body?: unknown) =>
  request<T>("PATCH", path, body);
export const apiDelete = <T>(path: string) => request<T>("DELETE", path);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function login(email: string, password: string): Promise<AuthTokens> {
  return apiPost<AuthTokens>("/auth/login", { email, password });
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export interface JobCanonical {
  id: string;
  company: string;
  title: string;
  location: string | null;
  description: string;
  url: string;
  postedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export const getJobs = () => apiGet<JobCanonical[]>("/jobs");
export const getJob = (jobId: string) => apiGet<JobCanonical>(`/jobs/${jobId}`);

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export type Necessity = "required" | "preferred";
export type MatchBand = "gated" | "stretch" | "worth_applying" | "strong";

export interface MatchedTechnology {
  technology: string;
  necessity: Necessity;
  quote: string;
  via: string;
  score: number;
}

export interface MissingTechnology {
  technology: string;
  necessity: Necessity;
  quote: string;
  status: "MISSING";
}

export interface RelevantProject {
  projectId: string;
  projectName: string;
  matchedTechnologies: string[];
  citedWorkEntry: { id: string; title: string; occurredOn: string };
}

export interface JobMatchResult {
  headline: number;
  band: MatchBand;
  gates: { passed: boolean; failures: string[] };
  subScores: {
    stackFit: number;
    recencyFit: number;
    seniorityFit: number;
    domainOverlap: number;
  };
  matched: MatchedTechnology[];
  missing: MissingTechnology[];
  relevantProjects: RelevantProject[];
  scorerVersion: string;
}

export const getJobMatch = (jobId: string) =>
  apiGet<JobMatchResult>(`/matching/jobs/${jobId}`);

// ---------------------------------------------------------------------------
// Work
// ---------------------------------------------------------------------------

export interface WorkEntry {
  id: string;
  title: string;
  body: string;
  outcome: string | null;
  type: string;
  occurredOn: string;
}

export interface TechnologyScore {
  technologyId: string;
  compositeScore: string;
  recencyScore: string;
  verification: string;
  monthsActive: number;
  projectCount: number;
  technology?: { canonicalName: string };
}

export const getWorkEntries = () => apiGet<WorkEntry[]>("/work-entries");
export const getTechnologyScores = () =>
  apiGet<TechnologyScore[]>("/work-entries/technology-scores");

/**
 * Mirrors apps/api's `CreateWorkEntrySchema` (work/dto.ts). Optional fields
 * are genuinely optional rather than `| undefined` -- `exactOptionalPropertyTypes`
 * is on, and "field absent" and "field present but undefined" are different
 * requests. Callers build these with conditional spreads.
 */
export interface CreateWorkEntryInput {
  title: string;
  body: string;
  outcome?: string;
  type: WorkEntryType;
  /** `YYYY-MM-DD`; the API coerces it with `z.coerce.date()`. */
  occurredOn: string;
  occurredThrough?: string;
  projectId?: string;
  epochId?: string;
  /** Set with `sourceRef` or not at all -- see the note on WorkEntry evidence below. */
  sourceKind?: EvidenceKind;
  sourceRef?: string;
  technologies: Array<{ technologyId: string; role: TechTagRole }>;
}

export const createWorkEntry = (input: CreateWorkEntryInput) =>
  apiPost<WorkEntry>("/work-entries", input);

/** Soft-retracts (sets `retractedAt`) -- the ledger never actually deletes. */
export const retractWorkEntry = (id: string) =>
  apiDelete<WorkEntry>(`/work-entries/${id}`);

// ---------------------------------------------------------------------------
// Taxonomy + projects (reference data the Add Work form needs)
// ---------------------------------------------------------------------------

export interface TaxonomyNode {
  id: string;
  kind: string;
  canonicalName: string;
  slug: string;
  /** `proposed` nodes match but are excluded from resume emission. */
  reviewStatus: string;
  aliases: Array<{ id: string; alias: string; normalized: string }>;
}

export interface ProjectEpoch {
  id: string;
  projectId: string;
  label: string;
  stackSummary: string | null;
  startedOn: string;
  endedOn: string | null;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  isCurrent: boolean;
  epochs: ProjectEpoch[];
}

export const getTaxonomyNodes = () =>
  apiGet<TaxonomyNode[]>("/taxonomy/nodes?kind=technology");
export const getProjects = () => apiGet<Project[]>("/profile/projects");

// ---------------------------------------------------------------------------
// Conflicts
// ---------------------------------------------------------------------------

export interface ConflictPosition {
  id: string;
  value: string;
  display: string;
  strength: string;
}

export interface Conflict {
  id: string;
  kind: string;
  subject: string;
  status: string;
  blocksEmission: boolean;
  positions: ConflictPosition[];
}

export interface ResolveConflictInput {
  status: "resolved" | "accepted_both" | "wont_fix";
  resolutionNote?: string;
}

export const getConflicts = () => apiGet<Conflict[]>("/conflicts");
export const resolveConflict = (id: string, resolution: ResolveConflictInput) =>
  apiPost<Conflict>(`/conflicts/${id}/resolve`, resolution);

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface GeneratedDocument {
  document: {
    id: string;
    jobId: string | null;
    kind: string;
    filePathPdf: string;
    filePathDocx: string;
    model: string;
    promptVersion: string;
    generatedAt: string;
  };
  spans: Array<{
    id: string;
    kind: "summary" | "bullet";
    text: string;
    claimIds: string[];
    order: number;
  }>;
}

export const generateDocument = (
  jobId: string,
  kind: "resume" | "cover_letter" = "resume",
) => apiPost<GeneratedDocument>("/documents/generate", { jobId, kind });

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export type ApplicationStatus =
  | "discovered"
  | "matched"
  | "drafted"
  | "approved"
  | "applied"
  | "replied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "ghosted";

export interface Application {
  id: string;
  jobId: string;
  documentId: string | null;
  status: ApplicationStatus;
  snapshotChecksumPdf: string | null;
  snapshotClaimIds: string[] | null;
  snapshotModel: string | null;
  snapshotPromptVersion: string | null;
  snapshotCassetteKey: string | null;
  approvedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationTransition {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  note: string | null;
  occurredAt: string;
}

export interface ApplicationDetail extends Application {
  transitions: ApplicationTransition[];
}

export interface TransitionInput {
  status: ApplicationStatus;
  documentId?: string;
  note?: string;
}

export const getApplications = () => apiGet<Application[]>("/applications");
export const getApplication = (id: string) =>
  apiGet<ApplicationDetail>(`/applications/${id}`);
export const createApplication = (jobId: string) =>
  apiPost<Application>("/applications", { jobId });
export const transitionApplication = (id: string, input: TransitionInput) =>
  apiPost<Application>(`/applications/${id}/transition`, input);

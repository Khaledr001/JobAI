import { and, eq } from "drizzle-orm";
import { runAsOwner, schema, type Db, type Tx } from "@jobhunter/db";
import type { EvidenceKind, TechTagRole, WorkEntryType } from "@jobhunter/shared-types";
import { resolveOrProposeTechnology } from "./taxonomy.js";
import { contentHash } from "./hash.js";

/**
 * Shared across every importer so `--dry-run` behaves identically
 * everywhere: real mode writes through `runAsOwner` (the same RLS-scoped
 * path the API uses); dry-run mode takes the exact same inputs and just
 * counts + logs what *would* happen, never opening a transaction.
 */
export interface IngestContext {
  db: Db;
  ownerId: string;
  dryRun: boolean;
  stats: Stats;
}

export class Stats {
  private counts = new Map<string, number>();

  bump(key: string, n = 1): void {
    this.counts.set(key, (this.counts.get(key) ?? 0) + n);
  }

  print(label: string): void {
    console.log(`\n${label}:`);
    if (this.counts.size === 0) {
      console.log("  (nothing to report)");
      return;
    }
    for (const [key, n] of [...this.counts.entries()].sort()) {
      console.log(`  ${key}: ${n}`);
    }
  }
}

/**
 * Every importer-facing date is a plain ISO string ("2026-02-01") --
 * simpler to hand-transcribe from a source file than a Date literal. The
 * `date({ mode: "date" })` columns (packages/db/src/schema/*.ts) map to a
 * real JS `Date` at the driver boundary, so this is the one place that
 * conversion happens. Appending T00:00:00Z avoids the date shifting by a
 * day under a non-UTC local timezone.
 */
function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export interface ExperienceInput {
  organizationName: string;
  title: string;
  location?: string | undefined;
  startedOn: string; // ISO date
  endedOn?: string | undefined | null;
  endsOpen?: boolean | undefined;
  countsTowardTotal?: boolean | undefined;
}

/** Keyed on (ownerId, organizationName, title, startedOn) -- there is no natural DB unique constraint for experiences, so this does its own find-or-create. */
export async function upsertExperience(
  ctx: IngestContext,
  input: ExperienceInput,
): Promise<string> {
  const label = `${input.organizationName} — ${input.title} (${input.startedOn})`;
  if (ctx.dryRun) {
    console.log(`  [dry-run] experience: ${label}`);
    ctx.stats.bump("experiences (would create/reuse)");
    return "dry-run";
  }

  return runAsOwner(ctx.db, ctx.ownerId, async (tx) => {
    const existing = await tx.query.experiences.findFirst({
      where: and(
        eq(schema.experiences.ownerId, ctx.ownerId),
        eq(schema.experiences.organizationName, input.organizationName),
        eq(schema.experiences.title, input.title),
        eq(schema.experiences.startedOn, toDate(input.startedOn)),
      ),
    });
    if (existing) {
      ctx.stats.bump("experiences (reused)");
      return existing.id;
    }

    const [row] = await tx
      .insert(schema.experiences)
      .values({
        ownerId: ctx.ownerId,
        organizationName: input.organizationName,
        title: input.title,
        location: input.location,
        startedOn: toDate(input.startedOn),
        endedOn: input.endedOn ? toDate(input.endedOn) : null,
        endsOpen: input.endsOpen ?? false,
        countsTowardTotal: input.countsTowardTotal ?? true,
      })
      .returning();
    if (!row) throw new Error(`upsertExperience: insert returned no row for ${label}`);
    ctx.stats.bump("experiences (created)");
    console.log(`  + experience: ${label}`);
    return row.id;
  });
}

export interface ProjectInput {
  name: string;
  slug: string;
  description?: string | undefined;
  isCurrent?: boolean | undefined;
}

export async function upsertProject(
  ctx: IngestContext,
  input: ProjectInput,
): Promise<string> {
  if (ctx.dryRun) {
    console.log(`  [dry-run] project: ${input.name} (${input.slug})`);
    ctx.stats.bump("projects (would create/reuse)");
    return "dry-run";
  }

  return runAsOwner(ctx.db, ctx.ownerId, async (tx) => {
    const existing = await tx.query.projects.findFirst({
      where: and(
        eq(schema.projects.ownerId, ctx.ownerId),
        eq(schema.projects.slug, input.slug),
      ),
    });
    if (existing) {
      ctx.stats.bump("projects (reused)");
      return existing.id;
    }

    const [row] = await tx
      .insert(schema.projects)
      .values({
        ownerId: ctx.ownerId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        isCurrent: input.isCurrent ?? false,
      })
      .returning();
    if (!row) throw new Error(`upsertProject: insert returned no row for ${input.slug}`);
    ctx.stats.bump("projects (created)");
    console.log(`  + project: ${input.name} (${input.slug})`);
    return row.id;
  });
}

export interface ProjectEpochInput {
  projectId: string;
  label: string;
  stackSummary?: string | undefined;
  startedOn: string;
  endedOn?: string | undefined | null;
}

/** Keyed on (projectId, label) -- e.g. "aspnet-clean-arch" vs "nestjs-drizzle-electron" for the same Inventra project. */
export async function upsertProjectEpoch(
  ctx: IngestContext,
  input: ProjectEpochInput,
): Promise<string> {
  if (ctx.dryRun) {
    console.log(`  [dry-run] project epoch: ${input.label}`);
    ctx.stats.bump("project epochs (would create/reuse)");
    return "dry-run";
  }

  return runAsOwner(ctx.db, ctx.ownerId, async (tx) => {
    const existing = await tx.query.projectEpochs.findFirst({
      where: and(
        eq(schema.projectEpochs.projectId, input.projectId),
        eq(schema.projectEpochs.label, input.label),
      ),
    });
    if (existing) {
      ctx.stats.bump("project epochs (reused)");
      return existing.id;
    }

    const [row] = await tx
      .insert(schema.projectEpochs)
      .values({
        ownerId: ctx.ownerId,
        projectId: input.projectId,
        label: input.label,
        stackSummary: input.stackSummary,
        startedOn: toDate(input.startedOn),
        endedOn: input.endedOn ? toDate(input.endedOn) : null,
      })
      .returning();
    if (!row)
      throw new Error(`upsertProjectEpoch: insert returned no row for ${input.label}`);
    ctx.stats.bump("project epochs (created)");
    console.log(`  + project epoch: ${input.label}`);
    return row.id;
  });
}

export interface WorkEntryInput {
  projectId?: string | undefined | null;
  epochId?: string | undefined | null;
  title: string;
  body: string;
  outcome?: string | undefined;
  type: WorkEntryType;
  occurredOn: string;
  occurredThrough?: string | undefined;
  sourceKind?: EvidenceKind | undefined;
  sourceRef?: string | undefined;
  technologies?: Array<{ name: string; role?: TechTagRole | undefined }> | undefined;
}

/**
 * Dedupes on `(ownerId, contentHash)` -- the DB's own unique index
 * (`uq_work_entries_owner_hash`) is the real backstop, but checking first
 * lets a dry-run report "already imported" instead of just "would create"
 * on a second run.
 */
export async function upsertWorkEntry(
  ctx: IngestContext,
  input: WorkEntryInput,
): Promise<string | null> {
  const hash = contentHash(input.title, input.body, input.occurredOn);

  if (ctx.dryRun) {
    console.log(`  [dry-run] work entry: ${input.title} (${input.occurredOn})`);
    ctx.stats.bump("work entries (would create)");
    return "dry-run";
  }

  return runAsOwner(ctx.db, ctx.ownerId, async (tx) => {
    const existing = await tx.query.workEntries.findFirst({
      where: and(
        eq(schema.workEntries.ownerId, ctx.ownerId),
        eq(schema.workEntries.contentHash, hash),
      ),
    });
    if (existing) {
      ctx.stats.bump("work entries (already imported)");
      return existing.id;
    }

    const [row] = await tx
      .insert(schema.workEntries)
      .values({
        ownerId: ctx.ownerId,
        projectId: input.projectId ?? null,
        epochId: input.epochId ?? null,
        title: input.title,
        body: input.body,
        outcome: input.outcome,
        type: input.type,
        occurredOn: toDate(input.occurredOn),
        occurredThrough: input.occurredThrough
          ? toDate(input.occurredThrough)
          : undefined,
        sourceKind: input.sourceKind,
        sourceRef: input.sourceRef,
        contentHash: hash,
      })
      .returning();
    if (!row)
      throw new Error(`upsertWorkEntry: insert returned no row for ${input.title}`);
    ctx.stats.bump("work entries (created)");

    for (const tag of input.technologies ?? []) {
      const { id: technologyId, created } = await resolveOrProposeTechnology(
        tx,
        tag.name,
      );
      if (created) ctx.stats.bump("taxonomy nodes (proposed)");
      await tx
        .insert(schema.workEntryTechnologies)
        .values({
          ownerId: ctx.ownerId,
          workEntryId: row.id,
          technologyId,
          role: tag.role ?? "primary",
        })
        .onConflictDoNothing({
          target: [
            schema.workEntryTechnologies.workEntryId,
            schema.workEntryTechnologies.technologyId,
          ],
        });
    }

    return row.id;
  });
}

export interface ClaimEvidenceInput {
  kind: EvidenceKind;
  locator: string;
  excerpt?: string | undefined;
  occurredOn?: string | undefined;
}

export interface ClaimInput {
  kind: (typeof schema.claims.$inferInsert)["kind"];
  subject: string;
  statement: string;
  quantities?: Record<string, unknown> | undefined;
  evidence: ClaimEvidenceInput[];
}

/**
 * Creates a claim unconfirmed (per the schema's own rule: born unconfirmed,
 * `promote_claim()` is the only path to confirmed_at) plus its evidence.
 * Never promotes here -- promotion happens in a separate pass
 * (`lib/finalize.ts`), run only after the conflict detector, so a claim
 * that turns out to be disputed is simply never promoted rather than
 * promoted and then un-promoted.
 */
export async function createClaimWithEvidence(
  ctx: IngestContext,
  input: ClaimInput,
): Promise<string | null> {
  if (ctx.dryRun) {
    console.log(`  [dry-run] claim: ${input.subject} -- "${input.statement}"`);
    ctx.stats.bump("claims (would create)");
    return "dry-run";
  }

  return runAsOwner(ctx.db, ctx.ownerId, async (tx) => {
    const existing = await tx.query.claims.findFirst({
      where: and(
        eq(schema.claims.ownerId, ctx.ownerId),
        eq(schema.claims.subject, input.subject),
        eq(schema.claims.statement, input.statement),
      ),
    });
    if (existing) {
      ctx.stats.bump("claims (already imported)");
      return existing.id;
    }

    const [claim] = await tx
      .insert(schema.claims)
      .values({
        ownerId: ctx.ownerId,
        kind: input.kind,
        subject: input.subject,
        statement: input.statement,
        quantities: input.quantities ?? {},
      })
      .returning();
    if (!claim)
      throw new Error(
        `createClaimWithEvidence: insert returned no row for ${input.subject}`,
      );
    ctx.stats.bump("claims (created)");
    console.log(`  + claim: ${input.subject} -- "${input.statement}"`);

    for (const ev of input.evidence) {
      await tx.insert(schema.evidence).values({
        ownerId: ctx.ownerId,
        claimId: claim.id,
        kind: ev.kind,
        locator: ev.locator,
        excerpt: ev.excerpt,
        occurredOn: ev.occurredOn ? toDate(ev.occurredOn) : undefined,
      });
      ctx.stats.bump("evidence (created)");
    }

    return claim.id;
  });
}

export { resolveOrProposeTechnology };
export type { Tx };

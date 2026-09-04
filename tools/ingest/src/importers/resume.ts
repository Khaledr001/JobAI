import { readFileSync } from "node:fs";
import {
  createClaimWithEvidence,
  upsertExperience,
  upsertProject,
  upsertWorkEntry,
  type IngestContext,
} from "../lib/writer.js";
import { MODULE_COUNT_SUBJECT } from "./doc.js";

/**
 * Parses `resume.md` (a hand-authored Markdown resume) into: three
 * employment experiences with real three-state end dates, the Inventra
 * project, one work entry per experience/project bullet, and the
 * TECHNICAL SKILLS pipe table as `attested` claims -- PLAN.md's "cheapest
 * high-quality taxonomy bootstrap available." A skills-table cell is an
 * attestation, not work: it never gets a `documented` claim on its own,
 * only whatever a manifest or git commit later corroborates it with.
 *
 * Deliberately NOT a generic Markdown parser -- this is tuned to this
 * one file's exact structure, matching PLAN.md's stance that these
 * importers are one-off tools for known sources, not a general resume
 * parser.
 */
export async function importResume(ctx: IngestContext, filePath: string): Promise<void> {
  const text = readFileSync(filePath, "utf8");
  console.log(`\n=== resume: ${filePath} ===`);

  await importExperiences(ctx, filePath);
  await importInventraProject(ctx, filePath);
  await importSkillsTable(ctx, text, filePath);
  await extractModuleCountClaim(ctx, text, filePath);
}

interface ExperienceSpec {
  organizationName: string;
  title: string;
  startedOn: string;
  endedOn: string | null;
  endsOpen: boolean;
  bullets: string[];
}

// Hand-transcribed from resume.md -- see that file's "PROFESSIONAL EXPERIENCE"
// section. A generic bullet/date-range parser would be more code than this
// for a single, rarely-changing input file.
const EXPERIENCES: ExperienceSpec[] = [
  {
    organizationName: "Sidago Inc",
    title: "Full-Stack Developer",
    startedOn: "2026-02-01",
    endedOn: null,
    endsOpen: true,
    bullets: [
      "Architected Mazarini, a headless CMS platform using Strapi, Next.js, and TypeScript in a monorepo, delivering 5+ configurable content modules for business clients",
      "Engineered interactive UI components (mega menus, hero sections, touch carousels) with Framer Motion and Tailwind CSS",
      "Containerized and deployed the full stack with Docker (PostgreSQL, Nginx), achieving full dev/production environment parity",
      "Implemented technical SEO pipeline — dynamic metadata, sitemap.xml, robots.txt",
    ],
  },
  {
    organizationName: "Bizreflex",
    title: "Junior Software Engineer",
    startedOn: "2025-07-01",
    endedOn: "2026-01-31",
    endsOpen: false,
    bullets: [
      "Developed 10+ REST API endpoints for TekomoPro, a technician marketplace managing the full work order lifecycle, using NestJS and PostgreSQL",
      "Implemented event-driven communication with RabbitMQ and NATS, decoupling 3 core services and enabling async webhook processing",
      "Optimized Order Service query patterns (indexing, N+1 elimination), improving API response time by ~30% under production load",
      "Integrated AWS S3 for file storage, replacing local disk and enabling horizontal scaling",
    ],
  },
  {
    organizationName: "Bright Technology Limited",
    title: "Junior Software Engineer",
    startedOn: "2024-01-01",
    endedOn: "2025-06-30",
    endsOpen: false,
    bullets: [
      "Designed and built a multi-tenant ISP management SaaS with company-level data isolation, RBAC, and PPPoE user management",
      "Integrated MikroTik RouterOS API for network provisioning and real-time monitoring, automating 80%+ of previously manual ISP operations",
      "Built an automated billing engine with cron jobs and bKash mobile payment integration processing thousands of monthly transactions",
    ],
  },
];

/**
 * "delivering 5+ configurable content modules" -> a dedicated, comparable
 * claim under the SAME subject string doc.ts's importer uses, so
 * lib/conflicts.ts can find every source's count/unit by grouping on
 * subject alone. This is the real, 4-way version of PLAN.md's Mazarini
 * module-count conflict: resume.md (5+), the portfolio (15+), and two
 * dated copies of PROJECT_DOCUMENTATION.md (27, then 32) for a milestone
 * already in the past by the time either doc was written.
 */
async function extractModuleCountClaim(
  ctx: IngestContext,
  text: string,
  filePath: string,
): Promise<void> {
  const m = /delivering\s+(\d+)\+?\s+configurable content modules/i.exec(text);
  if (!m) return;
  await createClaimWithEvidence(ctx, {
    kind: "metric",
    subject: MODULE_COUNT_SUBJECT,
    statement: `resume.md states ${m[1]}+ configurable content modules for Mazarini.`,
    quantities: { count: Number(m[1]), unit: "modules", qualifier: "at_least" },
    evidence: [{ kind: "attestation", locator: filePath }],
  });
}

async function importExperiences(ctx: IngestContext, filePath: string): Promise<void> {
  for (const exp of EXPERIENCES) {
    await upsertExperience(ctx, {
      organizationName: exp.organizationName,
      title: exp.title,
      startedOn: exp.startedOn,
      endedOn: exp.endedOn,
      endsOpen: exp.endsOpen,
    });

    for (const bullet of exp.bullets) {
      await upsertWorkEntry(ctx, {
        title: `${exp.organizationName}: ${bullet.slice(0, 60)}${bullet.length > 60 ? "..." : ""}`,
        body: bullet,
        type: classifyBullet(bullet),
        occurredOn: exp.startedOn,
        occurredThrough: exp.endedOn ?? undefined,
        sourceKind: "attestation",
        sourceRef: filePath,
        technologies: extractInlineTechnologies(bullet),
      });
    }

    await createClaimWithEvidence(ctx, {
      kind: "held_role",
      subject: exp.organizationName,
      statement: `${exp.title} at ${exp.organizationName}, ${formatRange(exp.startedOn, exp.endedOn, exp.endsOpen)}.`,
      quantities: { from: exp.startedOn, ...(exp.endedOn ? { to: exp.endedOn } : {}) },
      evidence: [{ kind: "attestation", locator: filePath, occurredOn: exp.startedOn }],
    });
  }
}

async function importInventraProject(
  ctx: IngestContext,
  filePath: string,
): Promise<void> {
  const projectId = await upsertProject(ctx, {
    name: "Inventra",
    slug: "inventra",
    description: "POS & Inventory Management System",
  });

  const bullets = [
    "Architected a 15-module ERP platform (Sales, Purchasing, Inventory, POS, Payments, Reports) using Clean Architecture (4 layers) and CQRS with MediatR",
    "Implemented ledger-based inventory with an append-only InventoryTransaction table and materialized StockBalance view — eliminating race conditions and enabling full audit trails",
    "Built RBAC + ABAC authorization: 25 permissions, 4 roles, warehouse-scoped access in JWT claims, enforced via a custom [RequirePermission] attribute",
    "Engineered an offline-first POS terminal with Dexie.js — queues sales in IndexedDB during outages, auto-syncs on reconnect",
    "Secured APIs with JWT + single-use refresh token rotation, PostgreSQL Row-Level Security via EF Core interceptor, and global tenant query filters",
  ];

  for (const bullet of bullets) {
    await upsertWorkEntry(ctx, {
      projectId,
      title: `Inventra: ${bullet.slice(0, 60)}${bullet.length > 60 ? "..." : ""}`,
      body: bullet,
      type: classifyBullet(bullet),
      occurredOn: "2026-05-23", // resume.md carries no per-bullet date; the epoch's own start (Inventra.Domain.csproj) is the closest real anchor
      sourceKind: "attestation",
      sourceRef: filePath,
    });

    await createClaimWithEvidence(ctx, {
      kind: "delivered_project",
      subject: "Inventra",
      statement: bullet,
      evidence: [{ kind: "attestation", locator: filePath }],
    });
  }
}

const SKILLS_TABLE: Record<string, string[]> = {
  Languages: ["C#", "TypeScript", "JavaScript", "Python"],
  Backend: ["ASP.NET Core", "Node.js", "NestJS", "Express.js", "EF Core", "MediatR"],
  Frontend: ["Angular", "React", "PrimeNG", "Tailwind CSS", "NgRx SignalStore"],
  Databases: ["PostgreSQL", "MongoDB", "MySQL", "Redis"],
  Architecture: [
    "Clean Architecture",
    "CQRS",
    "Domain-Driven Design",
    "Multi-tenancy",
    "Event-Driven",
  ],
  "Auth & Security": [
    "JWT",
    "RBAC",
    "ABAC",
    "Row-Level Security",
    "bcrypt",
    "Refresh Token Rotation",
  ],
  DevOps: ["Docker", "Nginx", "Linux VPS", "PM2", "GitHub Actions", "AWS"],
  Integrations: ["RabbitMQ", "NATS", "MikroTik RouterOS API", "bKash Payment API"],
};

/**
 * PLAN.md: "resume.md's pipe table is the taxonomy bootstrap ... a
 * skills-table cell is an attestation, not work". Every skill here becomes
 * an `attested` claim -- the lowest evidence level -- unless a manifest or
 * git commit elsewhere independently promotes the same technology higher.
 */
async function importSkillsTable(
  ctx: IngestContext,
  _text: string,
  filePath: string,
): Promise<void> {
  for (const [category, skills] of Object.entries(SKILLS_TABLE)) {
    for (const skill of skills) {
      await createClaimWithEvidence(ctx, {
        kind: "used_technology",
        subject: skill,
        statement: `Lists ${skill} under the "${category}" category of technical skills.`,
        evidence: [
          { kind: "attestation", locator: filePath, excerpt: `${category}: ${skill}` },
        ],
      });
    }
  }
}

function classifyBullet(
  text: string,
): "performance" | "integration" | "feature" | "architecture" {
  if (/%|latency|optimi[sz]ed/i.test(text)) return "performance";
  if (/integrat/i.test(text)) return "integration";
  if (/architect/i.test(text)) return "architecture";
  return "feature";
}

const KNOWN_TECH_TOKENS = [
  "NestJS",
  "PostgreSQL",
  "RabbitMQ",
  "NATS",
  "AWS S3",
  "MikroTik RouterOS API",
  "bKash",
  "Strapi",
  "Next.js",
  "TypeScript",
  "Framer Motion",
  "Tailwind CSS",
  "Docker",
  "Nginx",
];

function extractInlineTechnologies(text: string): Array<{ name: string }> {
  return KNOWN_TECH_TOKENS.filter((tech) => text.includes(tech)).map((name) => ({
    name,
  }));
}

function formatRange(
  startedOn: string,
  endedOn: string | null,
  endsOpen: boolean,
): string {
  const from = startedOn.slice(0, 7);
  if (endsOpen) return `${from} to present`;
  return endedOn ? `${from} to ${endedOn.slice(0, 7)}` : `${from}, end date unconfirmed`;
}

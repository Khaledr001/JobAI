import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import {
  createClaimWithEvidence,
  upsertExperience,
  upsertProject,
  upsertWorkEntry,
  type IngestContext,
} from "../lib/writer.js";
import { MODULE_COUNT_SUBJECT } from "./doc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSET_STUB = join(__dirname, "portfolio-asset-stub.cjs");

/** Portfolio project slug -> the canonical slug other importers use for the same real project. */
const PROJECT_SLUG_ALIASES: Record<string, string> = {
  "pos-inventory-management-system": "inventra",
};

/** Portfolio's organization name -> resume.md's canonical form for the same employer. */
const ORGANIZATION_NAME_ALIASES: Record<string, string> = {
  "Bright Technology Ltd": "Bright Technology Limited",
};

interface PortfolioExperience {
  title: string;
  company_name: string;
  project: string;
  date: string; // "Feb 2026 – Present"
  points: string[];
}

interface PortfolioProject {
  name: string;
  slug: string;
  description: string;
  tags: Array<{ name: string }>;
  points?: string[];
}

interface PortfolioModule {
  experiences: PortfolioExperience[];
  projects: PortfolioProject[];
  technologies: Array<{ name: string }>;
}

/**
 * `constants/index.js` cannot be `import()`ed directly -- it opens with
 * `import { backend, creator, ... } from "../assets"`, 20+ image imports
 * that only resolve inside a Vite build. Regex-parsing the object literals
 * instead was rejected in PLAN.md: the file has nested arrays and
 * `**bold**` markers that break a regex on the first edit. Bundling with
 * esbuild and aliasing the asset import to a Proxy stub yields the real,
 * live arrays with about 15 lines of infrastructure.
 */
async function loadPortfolioModule(filePath: string): Promise<PortfolioModule> {
  const result = await esbuild.build({
    entryPoints: [filePath],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    plugins: [
      {
        name: "asset-stub",
        setup(build) {
          build.onResolve({ filter: /^\.\.\/assets$/ }, () => ({ path: ASSET_STUB }));
        },
      },
    ],
  });

  const outputFile = result.outputFiles[0];
  if (!outputFile) throw new Error(`esbuild produced no output for ${filePath}`);

  const scratchDir = mkdtempSync(join(tmpdir(), "jobhunter-ingest-"));
  const scratchFile = join(scratchDir, "portfolio-bundle.mjs");
  writeFileSync(scratchFile, outputFile.text, "utf8");
  try {
    return (await import(pathToFileURL(scratchFile).href)) as PortfolioModule;
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
}

/** "Feb 2026" | "Jul 2025" -> "2026-02-01" | "2025-07-01". "Present" is handled by the caller. */
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
function parseMonthYear(text: string): string {
  const m = /^([A-Za-z]{3})[a-z]*\s+(\d{4})$/.exec(text.trim());
  if (!m) throw new Error(`portfolio: cannot parse month/year "${text}"`);
  const monthIndex = MONTHS.indexOf(m[1]!.toLowerCase().slice(0, 3));
  if (monthIndex === -1) throw new Error(`portfolio: unknown month in "${text}"`);
  return `${m[2]}-${String(monthIndex + 1).padStart(2, "0")}-01`;
}

function parseDateRange(range: string): {
  startedOn: string;
  endedOn: string | null;
  endsOpen: boolean;
} {
  const [fromRaw, toRaw] = range.split(/[–—-]/).map((s) => s.trim());
  if (!fromRaw || !toRaw)
    throw new Error(`portfolio: cannot parse date range "${range}"`);
  const startedOn = parseMonthYear(fromRaw);
  if (/present/i.test(toRaw)) return { startedOn, endedOn: null, endsOpen: true };
  return { startedOn, endedOn: parseMonthYear(toRaw), endsOpen: false };
}

function classifyBullet(
  text: string,
): "performance" | "integration" | "feature" | "architecture" {
  if (/%|latency|optimi[sz]ed/i.test(text)) return "performance";
  if (/integrat/i.test(text)) return "integration";
  if (/architect/i.test(text)) return "architecture";
  return "feature";
}

/** Strips the portfolio's markdown-style `**bold**` emphasis before storing bullet text. */
function stripEmphasis(text: string): string {
  return text.replace(/\*\*/g, "");
}

export async function importPortfolio(
  ctx: IngestContext,
  filePath: string,
): Promise<void> {
  console.log(`\n=== portfolio: ${filePath} ===`);
  const mod = await loadPortfolioModule(filePath);

  for (const exp of mod.experiences) {
    const { startedOn, endedOn, endsOpen } = parseDateRange(exp.date);
    // "Sidago Inc — Chicago, USA (Remote)" -> "Sidago Inc". Splits on the
    // em-dash ONLY, not a plain hyphen -- "Non-Profit Organization" (a real
    // company_name with no location suffix) has no em-dash and must survive
    // whole; splitting on any "-" truncated it to "Non".
    const rawOrganizationName = exp.company_name.split("—")[0]!.trim();
    // "Bright Technology Ltd" (here) vs "Bright Technology Limited"
    // (resume.md) -- same employer, different abbreviation. Without this,
    // upsertExperience's exact-name match creates a second, disconnected
    // experience row for someone he worked for once.
    const organizationName =
      ORGANIZATION_NAME_ALIASES[rawOrganizationName] ?? rawOrganizationName;

    await upsertExperience(ctx, {
      organizationName,
      title: exp.title,
      startedOn,
      endedOn,
      endsOpen,
    });

    for (const point of exp.points) {
      const body = stripEmphasis(point);
      await upsertWorkEntry(ctx, {
        title: `${organizationName}: ${body.slice(0, 60)}${body.length > 60 ? "..." : ""}`,
        body,
        type: classifyBullet(body),
        occurredOn: startedOn,
        occurredThrough: endedOn ?? undefined,
        sourceKind: "attestation",
        sourceRef: filePath,
      });
    }

    await createClaimWithEvidence(ctx, {
      kind: "held_role",
      subject: organizationName,
      statement: `${exp.title} at ${organizationName} (${exp.project}), ${exp.date}.`,
      quantities: { from: startedOn, ...(endedOn ? { to: endedOn } : {}) },
      evidence: [{ kind: "attestation", locator: filePath, occurredOn: startedOn }],
    });
  }

  for (const project of mod.projects) {
    // The portfolio names this project differently from resume.md and the
    // git/manifest importers (which all use "inventra", matching the real
    // project's actual codebase name) -- without this remap it would create
    // a second, disconnected project row for the same real system,
    // breaking PLAN.md's "two epochs, one project" Inventra story.
    const slug = PROJECT_SLUG_ALIASES[project.slug] ?? project.slug;
    const projectId = await upsertProject(ctx, {
      name: project.name,
      slug,
      description: project.description,
    });

    for (const point of project.points ?? []) {
      const body = stripEmphasis(point);
      await upsertWorkEntry(ctx, {
        projectId,
        title: `${project.name}: ${body.slice(0, 60)}${body.length > 60 ? "..." : ""}`,
        body,
        type: classifyBullet(body),
        occurredOn: "2026-01-01", // portfolio carries no per-project date; corrected once the project's real epoch dates are known (manifests/git)
        sourceKind: "attestation",
        sourceRef: filePath,
        technologies: project.tags.map((t) => ({ name: t.name })),
      });

      await createClaimWithEvidence(ctx, {
        kind: "delivered_project",
        subject: project.name,
        statement: body,
        evidence: [{ kind: "attestation", locator: filePath }],
      });

      // "delivering **15+** configurable content modules" -- the second of
      // four real, independently-worded module-count sources; see doc.ts's
      // comment on MODULE_COUNT_SUBJECT for the other two.
      const countMatch = /(\d+)\+?\s+configurable content modules/i.exec(body);
      if (countMatch) {
        await createClaimWithEvidence(ctx, {
          kind: "metric",
          subject: MODULE_COUNT_SUBJECT,
          statement: `The portfolio states ${countMatch[1]}+ configurable content modules for Mazarini.`,
          quantities: {
            count: Number(countMatch[1]),
            unit: "modules",
            qualifier: "at_least",
          },
          evidence: [{ kind: "attestation", locator: filePath }],
        });
      }
    }
  }

  for (const tech of mod.technologies) {
    await createClaimWithEvidence(ctx, {
      kind: "used_technology",
      subject: tech.name,
      statement: `Lists ${tech.name} among the portfolio's showcased technologies.`,
      evidence: [{ kind: "attestation", locator: filePath, excerpt: tech.name }],
    });
  }
}

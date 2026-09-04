import { existsSync, readFileSync, statSync } from "node:fs";
import { createClaimWithEvidence, type IngestContext } from "../lib/writer.js";

/**
 * Dependency manifests are the highest-trust, cheapest evidence on the
 * machine (PLAN.md: "manifests before the git scan ... resolves most
 * technology mentions so the git scan proposes far fewer taxonomy nodes").
 * Every claim here cites `dependency_manifest` evidence, which
 * `lib/finalize.ts` treats as `documented`-eligible -- one tier above a
 * bare resume attestation.
 */

/** package.json dependency key -> canonical technology name. Extend as real manifests show up. */
const NPM_DEPENDENCY_MAP: Record<string, string> = {
  "@nestjs/core": "NestJS",
  "@nestjs/common": "NestJS",
  "drizzle-orm": "Drizzle",
  "drizzle-kit": "Drizzle",
  next: "Next.js",
  react: "React",
  "react-dom": "React",
  electron: "Electron",
  ioredis: "Redis",
  redis: "Redis",
  bullmq: "BullMQ",
  "@nestjs/bullmq": "BullMQ",
  vite: "Vite",
  tailwindcss: "Tailwind CSS",
  postgres: "PostgreSQL",
  pg: "PostgreSQL",
  typescript: "TypeScript",
  "socket.io": "Socket.IO",
  zod: "Zod",
};

/** A .csproj filename/PackageReference fragment -> canonical technology name. */
const CSPROJ_DEPENDENCY_MAP: Record<string, string> = {
  "Microsoft.EntityFrameworkCore": "EF Core",
  MediatR: "MediatR",
  "Npgsql.EntityFrameworkCore.PostgreSQL": "PostgreSQL",
  "Microsoft.AspNetCore": "ASP.NET Core",
};

function fileDate(path: string): string {
  return statSync(path).mtime.toISOString().slice(0, 10);
}

async function claimTechnology(
  ctx: IngestContext,
  technology: string,
  manifestPath: string,
  occurredOn: string,
): Promise<void> {
  await createClaimWithEvidence(ctx, {
    kind: "used_technology",
    subject: technology,
    statement: `${technology} appears as a real dependency in ${manifestPath}.`,
    evidence: [{ kind: "dependency_manifest", locator: manifestPath, occurredOn }],
  });
}

export async function importNpmManifest(
  ctx: IngestContext,
  packageJsonPath: string,
): Promise<void> {
  if (!existsSync(packageJsonPath)) {
    console.warn(`  ! manifest not found: ${packageJsonPath}`);
    return;
  }
  console.log(`\n=== manifest: ${packageJsonPath} ===`);

  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const occurredOn = fileDate(packageJsonPath);

  const matched = new Set<string>();
  for (const dep of Object.keys(allDeps)) {
    const tech = NPM_DEPENDENCY_MAP[dep];
    if (tech) matched.add(tech);
  }

  for (const tech of matched) {
    await claimTechnology(ctx, tech, packageJsonPath, occurredOn);
  }
  console.log(`  ${matched.size} known technology dependency(ies) found`);
}

export async function importCsprojManifests(
  ctx: IngestContext,
  csprojPaths: string[],
): Promise<void> {
  console.log(`\n=== manifests: ${csprojPaths.length} .csproj file(s) ===`);
  const matched = new Map<string, { path: string; date: string }>();

  for (const path of csprojPaths) {
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    const date = fileDate(path);
    for (const [fragment, tech] of Object.entries(CSPROJ_DEPENDENCY_MAP)) {
      if (content.includes(fragment) && !matched.has(tech)) {
        matched.set(tech, { path, date });
      }
    }
    // A .csproj targeting net10.0 etc. is itself evidence of ".NET".
    if (/<TargetFramework>net\d/i.test(content) && !matched.has(".NET")) {
      matched.set(".NET", { path, date });
    }
  }

  for (const [tech, { path, date }] of matched) {
    await claimTechnology(ctx, tech, path, date);
  }
  console.log(`  ${matched.size} known technology dependency(ies) found`);
}

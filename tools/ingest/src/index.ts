/**
 * Operator CLI -- one subcommand per source, plus `conflicts` and `report`.
 * See PLAN.md's Seeding section for the import order this follows:
 * resume.md's skills table bootstraps the taxonomy first, then manifests
 * (cheap, highest-trust) before the git scan, then the remaining sources,
 * then conflict detection, then promotion.
 *
 * Source paths are hardcoded, not `--file` flags: this is explicitly a
 * one-off tool for this operator's own known files (PLAN.md's stance),
 * not a general importer. `--dry-run` prints what would be written without
 * opening a transaction; see lib/writer.ts.
 */
import { connect, getOperatorId } from "./lib/db.js";
import { Stats, type IngestContext } from "./lib/writer.js";
import { importResume } from "./importers/resume.js";
import { importPortfolio } from "./importers/portfolio.js";
import { importWorkLog } from "./importers/worklog.js";
import { importProjectDocumentation } from "./importers/doc.js";
import { importGitEpoch } from "./importers/git.js";
import { importNpmManifest, importCsprojManifests } from "./importers/manifests.js";
import { runConflictDetectors } from "./lib/conflicts.js";
import { promoteUndisputedClaims } from "./lib/finalize.js";
import { printReport } from "./lib/report.js";

const RESUME_PATH = "/media/khaled/Education/My Projects/POS system/resume.md";
const PORTFOLIO_PATH =
  "/media/khaled/Education/My Projects/my-protfolio/src/constants/index.js";
const WORKLOG_PATH = "/media/khaled/Education/Sidago/Mazarini/work-log.txt";
const DOC_PATHS = [
  "/media/khaled/Education/Sidago/PROJECT_DOCUMENTATION.md",
  "/media/khaled/Education/Sidago/Mazarini/PROJECT_DOCUMENTATION.md",
];

const GIT_EPOCHS = [
  {
    repoPath: "/media/khaled/Education/DevsFleet/DevsFleet POS",
    projectSlug: "inventra",
    projectName: "Inventra",
    projectDescription: "POS & Inventory Management System",
    epochLabel: "nestjs-drizzle-electron",
    stackSummary:
      "NestJS 11, Drizzle ORM, Next.js 16 (admin), Electron + Vite (POS terminal), PostgreSQL 18",
  },
  {
    repoPath: "/media/khaled/Education/My Projects/POS system/apps/pos-backend",
    projectSlug: "inventra",
    projectName: "Inventra",
    projectDescription: "POS & Inventory Management System",
    epochLabel: "aspnet-clean-arch",
    stackSummary:
      "ASP.NET Core 10, EF Core, MediatR, Clean Architecture (4 layers), CQRS",
  },
  {
    repoPath: "/media/khaled/Education/My Projects/POS system/apps/pos-frontend",
    projectSlug: "inventra",
    projectName: "Inventra",
    projectDescription: "POS & Inventory Management System",
    epochLabel: "aspnet-clean-arch",
    stackSummary: "Angular 21, PrimeNG, NgRx SignalStore",
  },
];

const NPM_MANIFESTS = [
  "/media/khaled/Education/DevsFleet/DevsFleet POS/apps/api/package.json",
  "/media/khaled/Education/DevsFleet/DevsFleet POS/apps/admin/package.json",
  "/media/khaled/Education/DevsFleet/DevsFleet POS/apps/pos/package.json",
  "/media/khaled/Education/DevsFleet/DevsFleet POS/packages/db/package.json",
];

const CSPROJ_MANIFESTS = [
  "/media/khaled/Education/My Projects/POS system/apps/pos-backend/src/Inventra.API/Inventra.API.csproj",
  "/media/khaled/Education/My Projects/POS system/apps/pos-backend/src/Inventra.Application/Inventra.Application.csproj",
  "/media/khaled/Education/My Projects/POS system/apps/pos-backend/src/Inventra.Domain/Inventra.Domain.csproj",
  "/media/khaled/Education/My Projects/POS system/apps/pos-backend/src/Inventra.Infrastructure/Inventra.Infrastructure.csproj",
];

const KNOWN_COMMANDS = [
  "resume",
  "portfolio",
  "work-log",
  "doc",
  "git",
  "manifests",
  "conflicts",
  "finalize",
  "report",
  "all",
] as const;
type Command = (typeof KNOWN_COMMANDS)[number];

async function runSources(ctx: IngestContext): Promise<void> {
  await importResume(ctx, RESUME_PATH);
  for (const manifest of NPM_MANIFESTS) await importNpmManifest(ctx, manifest);
  await importCsprojManifests(ctx, CSPROJ_MANIFESTS);
  for (const epoch of GIT_EPOCHS) await importGitEpoch(ctx, epoch);
  await importPortfolio(ctx, PORTFOLIO_PATH);
  await importWorkLog(ctx, WORKLOG_PATH);
  for (const docPath of DOC_PATHS) await importProjectDocumentation(ctx, docPath);
}

async function dispatch(command: Command, ctx: IngestContext): Promise<void> {
  switch (command) {
    case "resume":
      return importResume(ctx, RESUME_PATH);
    case "portfolio":
      return importPortfolio(ctx, PORTFOLIO_PATH);
    case "work-log":
      return importWorkLog(ctx, WORKLOG_PATH);
    case "doc":
      for (const docPath of DOC_PATHS) await importProjectDocumentation(ctx, docPath);
      return;
    case "git":
      for (const epoch of GIT_EPOCHS) await importGitEpoch(ctx, epoch);
      return;
    case "manifests":
      for (const manifest of NPM_MANIFESTS) await importNpmManifest(ctx, manifest);
      await importCsprojManifests(ctx, CSPROJ_MANIFESTS);
      return;
    case "conflicts":
      return runConflictDetectors(ctx);
    case "finalize":
      return promoteUndisputedClaims(ctx);
    case "report":
      return printReport(ctx.db, ctx.ownerId);
    case "all":
      await runSources(ctx);
      await runConflictDetectors(ctx);
      await promoteUndisputedClaims(ctx);
      await printReport(ctx.db, ctx.ownerId);
      return;
  }
}

async function main(): Promise<void> {
  const [, , commandArg, ...rest] = process.argv;
  const dryRun = rest.includes("--dry-run");

  if (!commandArg || !KNOWN_COMMANDS.includes(commandArg as Command)) {
    console.error(`Usage: pnpm ingest <${KNOWN_COMMANDS.join("|")}> [--dry-run]`);
    process.exit(1);
  }
  const command = commandArg as Command;

  const db = connect();
  const ownerId = await getOperatorId(db);
  const stats = new Stats();
  const ctx: IngestContext = { db, ownerId, dryRun, stats };

  if (dryRun) console.log("--dry-run: no writes will be made.\n");

  await dispatch(command, ctx);

  if (command !== "report") stats.print(dryRun ? "Would do" : "Done");
  await db.$client.end();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

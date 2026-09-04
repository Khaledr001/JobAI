#!/usr/bin/env node
/**
 * Enforces the layering rules from docs/VERIFICATION.md by static analysis
 * of import specifiers. Deliberately regex-based rather than a full TS
 * parser -- good enough for import statements, and it means this script has
 * zero dependencies and runs before anything else in `pnpm verify`.
 *
 * Rules:
 *   1. No app imports another app's package.
 *   2. No relative import escapes its own top-level package/app directory.
 *   3. apps/web may not import @jobhunter/db or @jobhunter/llm.
 *   4. Only apps/assist may import "playwright".
 *   5. packages/claims and packages/matching may not import @jobhunter/db
 *      or @jobhunter/llm -- a validator/scorer that can reach a database or
 *      an LLM is not pure.
 *   6. Every workspace package a file imports must be declared in that
 *      package's own package.json dependencies.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const IMPORT_RE = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;

function listSourceFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".next")
      continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

function findImports(file) {
  const content = readFileSync(file, "utf8");
  return [...content.matchAll(IMPORT_RE)].map((m) => m[1]);
}

function packageJsonFor(pkgDir) {
  try {
    return JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

const violations = [];

function scanWorkspaceGroup(groupDir) {
  let entries;
  try {
    entries = readdirSync(groupDir, { withFileTypes: true }).filter((e) =>
      e.isDirectory(),
    );
  } catch {
    return [];
  }
  return entries.map((e) => ({ name: e.name, dir: join(groupDir, e.name) }));
}

const apps = scanWorkspaceGroup(join(ROOT, "apps"));
const allPackages = [
  ...apps.map((a) => ({ ...a, kind: "apps" })),
  ...scanWorkspaceGroup(join(ROOT, "packages")).map((p) => ({ ...p, kind: "packages" })),
  ...scanWorkspaceGroup(join(ROOT, "tools")).map((t) => ({ ...t, kind: "tools" })),
];

const appPackageNames = new Set();
for (const app of apps) {
  const pkg = packageJsonFor(app.dir);
  if (pkg?.name) appPackageNames.add(pkg.name);
}

const PURE_PACKAGES = ["claims", "matching"];
const FORBIDDEN_FOR_PURE = ["@jobhunter/db", "@jobhunter/llm"];

for (const unit of allPackages) {
  const pkg = packageJsonFor(unit.dir);
  if (!pkg) continue;
  const declaredDeps = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
  const srcDir = join(unit.dir, "src");
  const files = listSourceFiles(srcDir);

  for (const file of files) {
    for (const spec of findImports(file)) {
      // Rule 1: no app imports another app.
      if (unit.kind === "apps" && appPackageNames.has(spec) && spec !== pkg.name) {
        violations.push(
          `${relative(ROOT, file)}: app "${unit.name}" imports another app (${spec})`,
        );
      }

      // Rule 2: a relative import must resolve inside this unit's own directory.
      if (spec.startsWith(".")) {
        const resolved = resolve(dirname(file), spec);
        if (!resolved.startsWith(unit.dir)) {
          violations.push(
            `${relative(ROOT, file)}: relative import "${spec}" escapes ${unit.kind}/${unit.name}`,
          );
        }
      }

      // Rule 3: apps/web may not import @jobhunter/db or @jobhunter/llm.
      if (unit.name === "web" && FORBIDDEN_FOR_PURE.includes(spec)) {
        violations.push(
          `${relative(ROOT, file)}: apps/web must not import ${spec} (server-only)`,
        );
      }

      // Rule 4: only apps/assist may import "playwright".
      if (spec === "playwright" && unit.name !== "assist") {
        violations.push(
          `${relative(ROOT, file)}: only apps/assist may import "playwright"`,
        );
      }

      // Rule 5: packages/claims and packages/matching stay IO-free.
      if (
        unit.kind === "packages" &&
        PURE_PACKAGES.includes(unit.name) &&
        FORBIDDEN_FOR_PURE.includes(spec)
      ) {
        violations.push(
          `${relative(ROOT, file)}: ${unit.name} must stay pure -- cannot import ${spec}`,
        );
      }

      // Rule 6: every @jobhunter/* import must be a declared dependency.
      if (
        spec.startsWith("@jobhunter/") &&
        !declaredDeps.has(spec) &&
        spec !== pkg.name
      ) {
        violations.push(
          `${relative(ROOT, file)}: imports ${spec} without declaring it in package.json`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`check-boundaries: ${violations.length} violation(s)\n`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("check-boundaries: ok -- every app is independently deployable.");

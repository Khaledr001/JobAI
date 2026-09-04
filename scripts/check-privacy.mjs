#!/usr/bin/env node
/**
 * The structural fix for a real incident on a sibling project on this
 * machine: a committed .env sitting next to its .env.example, and a
 * database dump left in the working tree. An ignore rule is one
 * `git add -f` from irrelevant, so this checks TRACKED files
 * (`git ls-files`), not the working tree.
 *
 * Operator PII patterns (real name/email/phone) are read from an untracked
 * `.privacy-patterns.local` file so the patterns themselves are never
 * committed. Its absence is not a failure -- it just means that check is
 * skipped, loudly, rather than silently.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

function trackedFiles() {
  try {
    return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    console.warn("check-privacy: not a git repository (or git unavailable) -- skipping.");
    return [];
  }
}

const files = trackedFiles();
const violations = [];

const KEY_PATTERNS = [
  { name: "generic API key prefix", re: /\bsk-[A-Za-z0-9_-]{16,}\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{20,}\b/ },
  { name: "GitHub token", re: /\bghp_[A-Za-z0-9]{20,}\b/ },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "PEM private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

// Words that mark a Postgres URL's password as an obvious placeholder --
// local dev creds, fixtures, and docs use these; a real leaked credential
// won't. Checked against the password segment only, case-insensitively.
const SAFE_PASSWORD_WORDS =
  /dev|test|invalid|change|placeholder|example|migrator|password/i;
const POSTGRES_URL_RE = /postgres:\/\/[^:\s]+:([^@\s]+)@/g;

function findPostgresCredentialViolations(content) {
  const hits = [];
  for (const match of content.matchAll(POSTGRES_URL_RE)) {
    const password = match[1];
    if (!SAFE_PASSWORD_WORDS.test(password)) {
      hits.push(match[0]);
    }
  }
  return hits;
}

const FORBIDDEN_EXTENSIONS = [".pdf", ".docx", ".doc", ".dump", ".sql.gz", ".backup"];
const MAX_TRACKED_BYTES = 1_000_000;

let patterns = [];
const patternsFile = join(ROOT, ".privacy-patterns.local");
if (existsSync(patternsFile)) {
  patterns = readFileSync(patternsFile, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
} else {
  console.warn(
    "check-privacy: .privacy-patterns.local not found -- operator-PII check skipped. " +
      "Create it locally (gitignored) with one literal string per line to enable.",
  );
}

for (const file of files) {
  const abs = join(ROOT, file);
  if (!existsSync(abs)) continue;

  if (
    FORBIDDEN_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext)) &&
    !file.startsWith("docs/")
  ) {
    violations.push(`${file}: forbidden extension tracked in git`);
    continue;
  }

  const size = statSync(abs).size;
  if (size > MAX_TRACKED_BYTES && file !== "pnpm-lock.yaml") {
    violations.push(
      `${file}: ${size} bytes tracked -- looks like an accidental large file`,
    );
  }

  let content;
  try {
    content = readFileSync(abs, "utf8");
  } catch {
    continue; // binary file that passed the extension check -- fine
  }

  for (const { name, re } of KEY_PATTERNS) {
    if (re.test(content)) violations.push(`${file}: matches ${name} pattern`);
  }
  // docs/ describes connection-URL shapes in prose -- that's documentation,
  // not a credential leak vector.
  if (!file.startsWith("docs/")) {
    for (const hit of findPostgresCredentialViolations(content)) {
      violations.push(`${file}: non-placeholder Postgres credential (${hit})`);
    }
  }
  for (const pattern of patterns) {
    if (content.includes(pattern))
      violations.push(`${file}: contains an operator-PII pattern`);
  }
}

if (violations.length > 0) {
  console.error(`check-privacy: ${violations.length} violation(s)\n`);
  for (const v of violations) console.error(`  - ${v}`);
  console.error("\nFix: git rm --cached <file>, then add it to .gitignore.");
  process.exit(1);
}

console.log(`check-privacy: ok -- ${files.length} tracked file(s) checked.`);

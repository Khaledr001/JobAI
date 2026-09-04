import { execFileSync } from "node:child_process";
import { isOperatorIdentity } from "../lib/identities.js";
import {
  upsertProject,
  upsertProjectEpoch,
  upsertWorkEntry,
  type IngestContext,
} from "../lib/writer.js";

export interface GitEpochSpec {
  repoPath: string;
  projectSlug: string;
  projectName: string;
  projectDescription?: string;
  epochLabel: string;
  stackSummary: string;
}

interface RawCommit {
  sha: string;
  date: string; // YYYY-MM-DD
  authorName: string;
  authorEmail: string;
  subject: string;
}

// ASCII unit separator (0x1F) and record separator (0x1E), built from
// numeric code points rather than written as literal control characters in
// this file -- an invisible byte sitting in source is unreviewable (see
// docs/PATTERNS.md's gotcha on exactly this). Neither byte can appear in a
// real commit subject line, so splitting on them is unambiguous even if a
// commit message contains arbitrary text.
const FIELD_SEP = String.fromCharCode(0x1f);
const RECORD_SEP = String.fromCharCode(0x1e);

/**
 * Reads only commit metadata (hash, date, author, subject) -- never a
 * diff or file content. Several of the scanned repos hold real secrets in
 * their own working trees (see docs/PRIVACY.md's ISP-repo cautionary
 * tale); this importer has no code path that could ever surface one.
 */
function readGitLog(repoPath: string): RawCommit[] | null {
  let output: string;
  try {
    output = execFileSync(
      "git",
      [
        "log",
        `--format=%H${FIELD_SEP}%ad${FIELD_SEP}%an${FIELD_SEP}%ae${FIELD_SEP}%s${RECORD_SEP}`,
        "--date=short",
      ],
      { cwd: repoPath, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (err) {
    console.warn(
      `  ! git log failed in ${repoPath}: ${err instanceof Error ? err.message.split("\n")[0] : err}`,
    );
    return null;
  }

  return output
    .split(RECORD_SEP)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((record) => {
      const [sha, date, authorName, authorEmail, subject] = record.split(FIELD_SEP);
      return {
        sha: sha!,
        date: date!,
        authorName: authorName!,
        authorEmail: authorEmail!,
        subject: subject ?? "",
      };
    });
}

function classifyCommit(
  subject: string,
): "feature" | "fix" | "refactor" | "infra" | "docs" {
  if (/^fix(\(|:)/i.test(subject)) return "fix";
  if (/^refactor(\(|:)/i.test(subject)) return "refactor";
  if (/^(chore|ci|build)(\(|:)/i.test(subject)) return "infra";
  if (/^docs(\(|:)/i.test(subject)) return "docs";
  return "feature";
}

export async function importGitEpoch(
  ctx: IngestContext,
  spec: GitEpochSpec,
): Promise<void> {
  console.log(`\n=== git: ${spec.repoPath} (${spec.epochLabel}) ===`);

  const commits = readGitLog(spec.repoPath);
  if (commits === null) {
    ctx.stats.bump("git repos (unreadable, skipped)");
    return;
  }

  const attributed = commits.filter((c) => isOperatorIdentity(c.authorEmail));
  const excluded = commits.length - attributed.length;
  if (excluded > 0) {
    console.log(
      `  excluded ${excluded} commit(s) not authored by the operator (see docs/DECISIONS.md D21): ` +
        `${[...new Set(commits.filter((c) => !isOperatorIdentity(c.authorEmail)).map((c) => c.authorEmail))].join(", ")}`,
    );
    ctx.stats.bump("git commits (excluded, non-operator identity)", excluded);
  }

  if (attributed.length === 0) {
    console.warn(
      `  no operator-attributed commits in ${spec.repoPath} -- skipping epoch creation`,
    );
    return;
  }

  const dates = attributed.map((c) => c.date).sort();
  const startedOn = dates[0]!;
  const endedOn = dates[dates.length - 1]!;

  const projectId = await upsertProject(ctx, {
    name: spec.projectName,
    slug: spec.projectSlug,
    description: spec.projectDescription,
  });
  const epochId = await upsertProjectEpoch(ctx, {
    projectId,
    label: spec.epochLabel,
    stackSummary: spec.stackSummary,
    startedOn,
    endedOn,
  });

  for (const commit of attributed) {
    await upsertWorkEntry(ctx, {
      projectId,
      epochId,
      title: commit.subject.slice(0, 120),
      body: commit.subject,
      type: classifyCommit(commit.subject),
      occurredOn: commit.date,
      sourceKind: "git_commit",
      sourceRef: commit.sha,
    });
  }

  console.log(
    `  ${attributed.length} commit(s) -> work entries, epoch ${startedOn}..${endedOn}`,
  );
}

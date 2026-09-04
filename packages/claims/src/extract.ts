import { normalizeForMatching } from "./normalize.js";

/**
 * Deliberately a curated set of regexes, not a general NLP pipeline: this
 * package is pure (no dependencies beyond zod) and needs to stay
 * deterministic and auditable. It's tuned to the adversarial fixture corpus
 * in fixtures/adversarial/ -- the goal is a validator that demonstrably
 * enforces the seven passes, not a universal resume parser.
 */

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

export interface TenureMention {
  type: "tenure";
  years: number;
  raw: string;
}
export interface PercentageMention {
  type: "percentage";
  percent: number;
  raw: string;
}
export interface TeamSizeMention {
  type: "teamSize";
  size: number;
  raw: string;
}
export interface ProficiencyMention {
  type: "proficiency";
  language: string;
  level: string;
  raw: string;
}
export interface VersionMention {
  type: "version";
  technology: string;
  version: string;
  raw: string;
}
export type QuantityMention =
  | TenureMention
  | PercentageMention
  | TeamSizeMention
  | ProficiencyMention
  | VersionMention;

const LANGUAGE_NAMES = [
  "English",
  "French",
  "Spanish",
  "German",
  "Arabic",
  "Bengali",
  "Hindi",
  "Mandarin",
  "Chinese",
  "Portuguese",
  "Russian",
  "Japanese",
  "Urdu",
];
/** Declaration order is the fluency order QUANTITY_INFLATED compares against. */
export const PROFICIENCY_LEVELS = [
  "basic",
  "conversational",
  "professional",
  "fluent",
  "native",
];

const TECH_VERSION_NAMES = [
  "React",
  "Angular",
  "PostgreSQL",
  "Node\\.js",
  "Node",
  "NestJS",
  "Next\\.js",
  "Vue",
  "Python",
  "TypeScript",
  "Drizzle",
  "Docker",
  "Redis",
];

/** Quantity-containment's lookup key into a claim's `quantities` for a given mention. */
export function quantityKeyFor(mention: QuantityMention): string {
  switch (mention.type) {
    case "tenure":
      return "years";
    case "percentage":
      return "percent";
    case "teamSize":
      return "teamSize";
    case "proficiency":
      return `proficiency:${mention.language}`;
    case "version":
      return `version:${mention.technology}`;
  }
}

export function extractQuantities(rawText: string): QuantityMention[] {
  const text = normalizeForMatching(rawText);
  const mentions: QuantityMention[] = [];

  for (const m of text.matchAll(/\b(\d+(?:\.\d+)?)\+?\s*years?\b/gi)) {
    mentions.push({ type: "tenure", years: Number(m[1]), raw: m[0] });
  }
  for (const [word, num] of Object.entries(WORD_NUMBERS)) {
    for (const m of text.matchAll(new RegExp(`\\b${word}\\+?\\s*years?\\b`, "gi"))) {
      mentions.push({ type: "tenure", years: num, raw: m[0] });
    }
  }

  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)) {
    mentions.push({ type: "percentage", percent: Number(m[1]), raw: m[0] });
  }

  for (const m of text.matchAll(/team of (\d+)/gi)) {
    mentions.push({ type: "teamSize", size: Number(m[1]), raw: m[0] });
  }
  for (const m of text.matchAll(
    /(\d+)[- ](?:person|people|engineers?|developers?)\b/gi,
  )) {
    mentions.push({ type: "teamSize", size: Number(m[1]), raw: m[0] });
  }

  for (const language of LANGUAGE_NAMES) {
    for (const level of PROFICIENCY_LEVELS) {
      const patterns = [
        new RegExp(`\\b${level}\\b[^.]{0,4}\\b${language}\\b`, "i"),
        new RegExp(`\\b${language}\\b[^.]{0,20}\\(?${level}\\)?`, "i"),
      ];
      for (const re of patterns) {
        const m = text.match(re);
        if (m) mentions.push({ type: "proficiency", language, level, raw: m[0] });
      }
    }
  }

  for (const tech of TECH_VERSION_NAMES) {
    for (const m of text.matchAll(
      new RegExp(`\\b(${tech})\\s+(\\d+(?:\\.\\d+)*)\\b`, "g"),
    )) {
      const technology = m[1];
      const version = m[2];
      if (technology === undefined || version === undefined) continue;
      mentions.push({
        type: "version",
        technology: technology.replace(/\\/g, ""),
        version,
        raw: m[0],
      });
    }
  }

  return mentions;
}

/**
 * Sentence-initial and generically-capitalized words that are not proper
 * nouns -- resume bullets universally start with a capitalized verb, and
 * that capital alone must never be enough to flag "Optimised" as an unknown
 * entity. Curated, not exhaustive: extend it as real false positives show up.
 */
const ENTITY_STOPWORDS = new Set([
  "Built",
  "Implemented",
  "Designed",
  "Developed",
  "Created",
  "Delivered",
  "Reduced",
  "Improved",
  "Migrated",
  "Refactored",
  "Automated",
  "Deployed",
  "Established",
  "Optimised",
  "Optimized",
  "Led",
  "Managed",
  "Owned",
  "Architected",
  "Drove",
  "Launched",
  "Shipped",
  "Introduced",
  "Collaborated",
  "Contracted",
  "Contributed",
  "Supported",
  "Maintained",
  "Debugged",
  "Wrote",
  "Worked",
  "Authored",
  "Holds",
  "Earned",
  "Completed",
  "Achieved",
  "The",
  "This",
  "That",
  "These",
  "Those",
  "A",
  "An",
  "And",
  "With",
  "For",
  "In",
  "On",
  "At",
  "To",
  "Of",
  "By",
  "From",
  "As",
  "Its",
  "Their",
  "His",
  "Her",
  "Team",
  "Teams",
  "Engineer",
  "Engineering",
  "Backend",
  "Frontend",
  "Full",
  "Stack",
  "System",
  "Systems",
  "Service",
  "Services",
  "Database",
  "Server",
  "Application",
  "Applications",
  "Project",
  "Projects",
  "Company",
  "Organization",
  "Client",
  "Customer",
  "User",
  "Users",
  "Native",
  "Fluent",
  "Professional",
  "Conversational",
  "Basic",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

const SYMBOL_TECH_RE = /\bC#|\bC\+\+|\.NET\b|\bNode\.js\b|\bNext\.js\b|\bASP\.NET\b/g;

/**
 * Extracts candidate proper-noun / technology phrases: Title-Case runs
 * (with leading/trailing stopwords stripped so "Optimised Order Service"
 * yields "Order Service"), plus punctuation-bearing tech names that a plain
 * Title-Case regex can't match ("C#", ".NET", "Node.js").
 */
export function extractEntityMentions(rawText: string): string[] {
  const text = normalizeForMatching(rawText);
  const mentions = new Set<string>();

  for (const m of text.matchAll(SYMBOL_TECH_RE)) {
    mentions.add(m[0]);
  }

  for (const m of text.matchAll(/\b[A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*)*\b/g)) {
    const words = m[0].split(/\s+/);
    let start = 0;
    while (start < words.length && ENTITY_STOPWORDS.has(words[start] ?? "")) start++;
    let end = words.length;
    while (end > start && ENTITY_STOPWORDS.has(words[end - 1] ?? "")) end--;
    const core = words.slice(start, end).join(" ");
    if (core.length > 0 && !ENTITY_STOPWORDS.has(core)) mentions.add(core);
  }

  return Array.from(mentions);
}

export const SENIORITY_TERMS = [
  "led",
  "architected",
  "owned",
  "managed",
  "directed",
  "spearheaded",
  "founded",
];
export const SUPERLATIVE_TERMS = [
  "expert",
  "world-class",
  "best-in-class",
  "unparalleled",
  "guru",
  "ninja",
];

export function findLexiconHits(rawText: string, terms: readonly string[]): string[] {
  const text = normalizeForMatching(rawText).toLowerCase();
  return terms.filter((term) => new RegExp(`\\b${term}\\b`, "i").test(text));
}

/** Longest run of consecutive words shared between two word arrays, for JD-echo detection. */
export function longestSharedRun(a: readonly string[], b: readonly string[]): number {
  let best = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let run = 0;
      while (i + run < a.length && j + run < b.length && a[i + run] === b[j + run]) run++;
      if (run > best) best = run;
    }
  }
  return best;
}

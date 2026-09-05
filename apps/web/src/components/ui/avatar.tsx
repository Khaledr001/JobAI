import { cn } from "@/lib/cn";

/**
 * A company mark built entirely from the company name -- no logo fetch, no
 * third-party favicon service. Deliberate: this dashboard would otherwise
 * tell an external host which companies the operator is tracking on every
 * render, and it would break with no network. See docs/PRIVACY.md.
 */

/** Ten hues spread around the wheel, picked so none collides with the brand violet. */
const HUES = [15, 45, 95, 140, 175, 200, 225, 310, 340, 5];

/** FNV-1a: tiny, stable, and evenly spread over short strings like company names. */
function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** "Mixpanel" -> "MX"; "Acme Health Systems" -> "AH"; "x" -> "X". */
export function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) {
    return (words[0] ?? "").slice(0, 2).toUpperCase();
  }
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
}

const SIZES = {
  sm: "size-8 text-[0.6875rem] rounded-lg",
  md: "size-10 text-xs rounded-xl",
  lg: "size-12 text-sm rounded-2xl",
} as const;

export function CompanyAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const hue = HUES[hashString(name) % HUES.length] ?? 225;

  return (
    <span
      aria-hidden
      className={cn(
        "company-avatar flex shrink-0 items-center justify-center font-semibold tracking-tight select-none",
        SIZES[size],
        className,
      )}
      // Only the hue is inline -- it's per-company data, not a design token,
      // so there is no finite set of classes Tailwind could pre-generate.
      // Lightness and chroma live in `.company-avatar`, which flips with the
      // theme; a fixed pale chip would glare on the dark canvas.
      style={{ "--avatar-hue": hue } as React.CSSProperties}
    >
      {initialsOf(name)}
    </span>
  );
}

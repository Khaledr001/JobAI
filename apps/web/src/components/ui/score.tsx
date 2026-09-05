import type { MatchBand } from "@/lib/api-client";
import type { Tone } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export const BAND_LABEL: Record<MatchBand, string> = {
  gated: "Gated",
  stretch: "Stretch",
  worth_applying: "Worth applying",
  strong: "Strong match",
};

export const BAND_TONE: Record<MatchBand, Tone> = {
  gated: "neutral",
  stretch: "warning",
  worth_applying: "info",
  strong: "success",
};

const BAND_STROKE: Record<MatchBand, string> = {
  gated: "text-subtle-foreground",
  stretch: "text-warning",
  worth_applying: "text-info",
  strong: "text-success",
};

/**
 * The headline number, as a ring rather than bare text -- the whole point
 * of the matching engine is triage at a glance, and a filled arc reads
 * faster than two digits.
 */
export function ScoreRing({
  score,
  band,
  size = 72,
}: {
  score: number;
  band: MatchBand;
  size?: number;
}) {
  const stroke = size >= 96 ? 9 : size >= 64 ? 7 : 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-sunken"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (clamped / 100) * circumference}
          className={cn(
            "stroke-current transition-[stroke-dashoffset] duration-700",
            BAND_STROKE[band],
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-semibold tracking-tight tabular-nums",
            size >= 96 ? "text-3xl" : size >= 64 ? "text-xl" : "text-sm",
          )}
        >
          {clamped}
        </span>
        {size >= 96 && (
          <span className="text-[0.625rem] font-medium tracking-wide text-subtle-foreground uppercase">
            match
          </span>
        )}
      </div>
    </div>
  );
}

export function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{pct}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken">
        <div
          className="bg-brand-gradient h-full rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

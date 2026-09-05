import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Tone } from "@/components/ui/badge";

const ICON_TONES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted-foreground",
  brand: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

/**
 * The big-number tile. The value is deliberately the largest thing on the
 * card -- these exist to be read at a glance from across the desk, which is
 * the whole difference between a dashboard and a table of counts.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "brand",
  href,
  loading,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: Tone;
  href?: string;
  loading?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            ICON_TONES[tone],
          )}
        >
          {icon}
        </span>
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="h-9 w-16 animate-pulse rounded-lg bg-surface-muted" />
        ) : (
          <p className="text-3xl leading-none font-semibold tracking-tight tabular-nums">
            {value}
          </p>
        )}
        <p className="mt-2 text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-subtle-foreground">{hint}</p>}
      </div>
    </>
  );

  const className = cn(
    "block rounded-card border border-border bg-surface p-5 shadow-card",
    href &&
      "transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

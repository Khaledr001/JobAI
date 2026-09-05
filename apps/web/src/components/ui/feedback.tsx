import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-muted", className)} />;
}

/** Repeated row skeleton -- keeps list pages from jumping on load. */
export function SkeletonRows({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-px", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-14 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {/* Concentric rings instead of a flat chip -- an empty state is the
          first thing a new operator sees, and it should not look broken. */}
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-surface-muted">
        <div className="flex size-11 items-center justify-center rounded-full bg-surface text-subtle-foreground shadow-sm">
          {icon}
        </div>
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3.5">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-danger">Request failed</p>
        <p className="mt-0.5 text-xs wrap-break-word text-danger/80">{message}</p>
      </div>
    </div>
  );
}

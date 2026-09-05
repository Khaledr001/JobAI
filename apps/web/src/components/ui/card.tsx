import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  interactive,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  /** Adds the hover lift used by clickable cards (job rows, stat tiles). */
  interactive?: boolean;
}) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-card border border-border bg-surface shadow-card",
        interactive &&
          "transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift",
        className,
      )}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-border px-6 py-5",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("p-6", className)} />;
}

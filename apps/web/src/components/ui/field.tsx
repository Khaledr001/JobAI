import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

const CONTROL = [
  "w-full rounded-lg border bg-surface px-3 text-sm text-foreground",
  "placeholder:text-subtle-foreground",
  "transition-colors focus:outline-none focus-visible:border-brand",
  "disabled:cursor-not-allowed disabled:opacity-55",
].join(" ");

/**
 * Label + optional hint + error, wrapping one control. `error` takes the
 * hint's place rather than stacking under it -- a field that is both
 * explained and wrong should say what's wrong, not both at once.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | undefined;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center gap-1 text-xs font-medium text-foreground"
      >
        {label}
        {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-subtle-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  className,
  invalid,
  ...props
}: ComponentPropsWithRef<"input"> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid ?? undefined}
      className={cn(
        CONTROL,
        "h-9.5",
        invalid ? "border-danger" : "border-border",
        className,
      )}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: ComponentPropsWithRef<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid ?? undefined}
      className={cn(
        CONTROL,
        "resize-y py-2 leading-relaxed",
        invalid ? "border-danger" : "border-border",
        className,
      )}
    />
  );
}

export function Select({
  className,
  invalid,
  ...props
}: ComponentPropsWithRef<"select"> & { invalid?: boolean }) {
  return (
    <select
      {...props}
      aria-invalid={invalid ?? undefined}
      className={cn(
        CONTROL,
        "h-9.5",
        invalid ? "border-danger" : "border-border",
        className,
      )}
    />
  );
}

/** Right-aligned `123 / 4000`, reddening as it approaches the DTO's cap. */
export function CharCount({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  const near = value.length > max * 0.9;
  return (
    <span
      className={cn(
        "tabular-nums",
        over ? "text-danger" : near ? "text-warning" : "text-subtle-foreground",
      )}
    >
      {value.length} / {max}
    </span>
  );
}

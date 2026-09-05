"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyTheme, isTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";
import { cn } from "@/lib/cn";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
] as const satisfies ReadonlyArray<{ value: Theme; label: string; icon: unknown }>;

/**
 * `useLayoutEffect` warns when React renders a client component on the
 * server. Aliasing to `useEffect` there is the standard escape -- the branch
 * is module-level, so hook order never changes between renders.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function ThemeToggle() {
  // Starts at "system" so the hydration render matches the server's markup.
  // The real value is read below, before paint -- reading localStorage in a
  // lazy initializer instead would make hydration disagree with the HTML.
  const [theme, setTheme] = useState<Theme>("system");

  useIsomorphicLayoutEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // Private mode / blocked storage: fall through to "system".
    }
    const initial = isTheme(stored) ? stored : "system";
    setTheme(initial);
    // Re-apply: in dev, React's Strict Mode remount resets <html> to only the
    // attributes it manages from JSX, wiping what layout.tsx's inline script
    // set. Harmless no-op in production.
    applyTheme(initial);
  }, []);

  function select(next: Theme) {
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Choice won't survive a reload, but the page still switches.
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex items-center gap-0.5 rounded-lg bg-surface-muted p-0.5"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => select(value)}
            className={cn(
              "flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors",
              active
                ? "bg-surface text-foreground shadow-sm"
                : "text-subtle-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

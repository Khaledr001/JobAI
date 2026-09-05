"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Briefcase,
  FileStack,
  GitCompareArrows,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import { clearTokens, getAccessToken } from "@/lib/api-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/applications", label: "Applications", icon: FileStack },
  { href: "/work", label: "My Work", icon: LayoutGrid },
  { href: "/conflicts", label: "Conflicts", icon: GitCompareArrows },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Read after mount: localStorage doesn't exist during SSR, and reading it
  // inline would produce a client/server markup mismatch.
  useEffect(() => setSignedIn(getAccessToken() !== null), [pathname]);
  useEffect(() => setMobileOpen(false), [pathname]);

  if (pathname === "/login") return <>{children}</>;

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-soft text-brand"
                : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            {/* The active rail -- a small thing that makes a sidebar read as
                navigation rather than a list of links. */}
            {active && (
              <span className="absolute top-1/2 -left-3 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand" />
            )}
            <Icon
              className={cn(
                "size-4.5 shrink-0",
                active
                  ? "text-brand"
                  : "text-subtle-foreground group-hover:text-foreground",
              )}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <Link href="/dashboard" className="flex items-center gap-3 px-1 py-1">
      <div className="bg-brand-gradient shadow-brand flex size-9 items-center justify-center rounded-xl text-white">
        <Sparkles className="size-5" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[0.9375rem] font-semibold tracking-tight">
          Job Hunter
        </p>
        <p className="truncate text-[0.6875rem] text-subtle-foreground">
          Evidence-backed
        </p>
      </div>
    </Link>
  );

  const footer = (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      {signedIn && (
        <button
          type="button"
          onClick={() => {
            clearTokens();
            router.replace("/login");
          }}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <LogOut className="size-4.5 text-subtle-foreground" />
          Sign out
        </button>
      )}
      <ThemeToggle />
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-border bg-surface px-4 py-5 lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/85 px-4 py-3 backdrop-blur-md lg:hidden">
        {brand}
        <button
          type="button"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-xl p-2 text-muted-foreground hover:bg-surface-muted"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      {mobileOpen && (
        <div className="sticky top-15 z-20 flex flex-col gap-2 border-b border-border bg-surface px-4 py-3 lg:hidden">
          {nav}
          {footer}
        </div>
      )}

      <main className="min-w-0 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

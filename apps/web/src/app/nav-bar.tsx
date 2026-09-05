"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearTokens, getAccessToken } from "@/lib/api-client";

const LINKS = [
  { href: "/jobs", label: "Jobs" },
  { href: "/work", label: "My Work" },
  { href: "/conflicts", label: "Conflicts" },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  // Read after mount, not during render -- localStorage doesn't exist during
  // SSR, and reading it inline would produce a client/server markup mismatch.
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => setLoggedIn(getAccessToken() !== null), [pathname]);

  if (pathname === "/login") return null;

  return (
    <nav className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold">Job Hunter</span>
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname.startsWith(link.href)
                  ? "text-sm font-medium text-neutral-900"
                  : "text-sm text-neutral-500 hover:text-neutral-900"
              }
            >
              {link.label}
            </Link>
          ))}
        </div>
        {loggedIn && (
          <button
            type="button"
            onClick={() => {
              clearTokens();
              router.replace("/login");
            }}
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            Log out
          </button>
        )}
      </div>
    </nav>
  );
}

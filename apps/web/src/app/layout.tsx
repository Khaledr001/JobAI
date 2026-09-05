import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import { QueryProvider } from "@/lib/query-provider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Hunter",
  description: "My Work profile, job matching, and application tracking.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#16181d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning on <html>: the script below sets `data-theme`
    // during parsing, so the DOM legitimately differs from the server markup.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs synchronously while the HTML is parsed -- before first paint,
            before React loads. An effect would run after paint, which is the
            dark-flash-on-every-navigation bug. Deliberately not <Script>:
            that defers, and deferred is too late to matter here. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* suppressHydrationWarning: browser extensions (Grammarly et al) inject
          attributes onto <body> before React hydrates. Scoped to this element's
          own attributes only -- a real mismatch anywhere else still surfaces. */}
      <body suppressHydrationWarning>
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}

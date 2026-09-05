import type { Metadata } from "next";
import { QueryProvider } from "@/lib/query-provider";
import { NavBar } from "./nav-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Hunter",
  description: "My Work profile, job matching, and application tracking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className="min-h-screen bg-neutral-50 text-neutral-900"
        suppressHydrationWarning
      >
        <QueryProvider>
          <NavBar />
          <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
        </QueryProvider>
      </body>
    </html>
  );
}

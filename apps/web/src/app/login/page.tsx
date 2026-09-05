"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ApiError, login, setTokens } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const tokens = await login(email, password);
      setTokens(tokens.accessToken, tokens.refreshToken);
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the API. Is it running on port 3001?",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="bg-brand-wash relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div className="animate-in w-full max-w-104">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="bg-brand-gradient shadow-brand mb-4 flex size-14 items-center justify-center rounded-2xl text-white">
            <Sparkles className="size-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back to <span className="text-brand-gradient">Job Hunter</span>
          </h1>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Nothing here asserts a fact your ledger can&apos;t prove.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            void onSubmit(e);
          }}
          className="space-y-5 rounded-panel border border-border bg-surface p-7 shadow-lift"
        >
          <Field label="Email" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Password" htmlFor="password" required>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
            />
          </Field>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
              <p className="text-xs text-danger">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={pending}
            className="w-full"
            icon={pending ? undefined : <ArrowRight className="size-4" />}
          >
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-subtle-foreground">
          Single operator. There is no signup route.
        </p>
      </div>
    </main>
  );
}

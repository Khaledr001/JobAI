"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccessToken } from "./api-client";

/**
 * Every page but /login needs a token -- there is exactly one operator and
 * no anonymous read path (matches apps/api's global JwtAuthGuard). Client-side
 * only: this is a static-shell app with no server actions, so redirect
 * happens after mount, not via middleware.
 */
export function useAuthGuard(): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  return ready;
}

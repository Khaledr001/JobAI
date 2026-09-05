"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getAccessToken } from "@/lib/api-client";

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getAccessToken() ? "/jobs" : "/login");
  }, [router]);
  return null;
}

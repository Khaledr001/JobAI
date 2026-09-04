/**
 * The one place apps/web talks to apps/api. No server actions (matches the
 * reference repo's convention) -- every data access path stays visible in
 * this one client rather than scattered across server components.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status}`);
  }
  const body = (await res.json()) as { data: T };
  return body.data;
}

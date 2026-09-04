import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // apps/web may not import @jobhunter/db or @jobhunter/llm (see
  // scripts/check-boundaries.mjs and eslint.config.mjs) -- both are
  // server-only and bundling either ships the Postgres driver / LLM API key
  // to the browser.
  output: "standalone",
};

export default nextConfig;

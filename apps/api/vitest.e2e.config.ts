import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/**
 * Separate from vitest.config.ts on purpose -- e2e specs boot a real Nest
 * application (see test/health.e2e-spec.ts) and are slower and fewer than
 * unit specs. The reference repo's apps/api declares this script but the
 * config file it points at doesn't exist; this repo's version of that gap is
 * closed by this file actually being here.
 */
export default defineConfig({
  test: {
    include: ["test/**/*.e2e-spec.ts"],
    globals: true,
    root: "./",
    testTimeout: 30000,
    // Applied before any test file is imported -- app.module.ts calls
    // ConfigModule.forRoot() at class-decoration time (i.e. at import time,
    // not inside a beforeAll), so these must exist before that import runs.
    env: {
      DATABASE_URL: "postgres://test:test@127.0.0.1:1/test",
      REDIS_URL: "redis://127.0.0.1:1",
      JWT_ACCESS_SECRET: "test-only-access-secret-at-least-32-chars",
      JWT_REFRESH_SECRET: "test-only-refresh-secret-at-least-32-chars",
    },
  },
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: { transform: { decoratorMetadata: true, legacyDecorator: true } },
    }),
  ],
});

// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

/**
 * Flat config, one file, whole workspace.
 *
 * Type-aware rules here are hand-picked, not a preset. `recommendedTypeChecked`
 * pays the full cost of type-aware analysis; enabling it and then disabling
 * every `no-unsafe-*` rule (as the older ISP Management repo's config does)
 * buys nothing over `eslint:recommended` at that cost. Each rule below earns
 * its place by catching a bug class this system will actually produce.
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "packages/db/migrations/**",
      "packages/llm/cassettes/**",
      "packages/sources/fixtures/**",
      "packages/matching/golden/**",
    ],
  },

  js.configs.recommended,

  {
    files: [
      "apps/*/src/**/*.{ts,tsx}",
      "packages/*/src/**/*.ts",
      "tools/*/src/**/*.ts",
      "packages/*/scripts/**/*.ts",
      "apps/*/test/**/*.ts",
    ],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node },
    },
    rules: {
      /**
       * The single highest-value rule in this repo. `queue.add(...)` returns a
       * promise; an unawaited one in a service still enqueues, so it looks
       * fine until the request finishes, the transaction rolls back, and the
       * job runs against a row that was never committed.
       */
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unnecessary-condition": "warn",

      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always", { null: "ignore" }],

      /**
       * Downgraded, not off. `any` at a parse boundary (an LLM's JSON, a job
       * board's payload) is honest -- that data really is unknown until zod
       * says otherwise. `any` twelve lines deep in a scorer is a bug.
       */
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  {
    // Scoped to apps/api's src only -- config/env.ts is where the answer to
    // "which variables does this need" actually lives. Standalone CLI
    // entrypoints (packages/db/scripts, tools/*, apps/assist) have no
    // equivalent config module and read process.env directly by design.
    files: ["apps/api/src/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            "Read configuration from the validated env object (config/env.ts), not process.env.",
        },
      ],
      /**
       * OFF, deliberately, and only here. `import type` erases the type at
       * compile time, so `emitDecoratorMetadata` writes `Object` into
       * `design:paramtypes` and Nest injects `undefined`. A lint autofix that
       * converts constructor-injected imports to type-only imports breaks
       * dependency injection at runtime with a green build.
       */
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },
  {
    files: ["packages/*/src/**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },

  {
    files: ["packages/claims/src/**/*.ts", "packages/matching/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@jobhunter/db", message: "claims and matching must stay IO-free." },
            {
              name: "@jobhunter/llm",
              message: "A validator that can call a model is not a validator.",
            },
          ],
        },
      ],
      /**
       * Determinism. A golden-file test over a scorer that reads the clock is
       * a test that fails on the day the clock crosses a boundary, and an
       * anti-fabrication validator that randomises is not an invariant.
       */
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "Take the reference date as a parameter." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Deterministic only." },
      ],
    },
  },

  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@jobhunter/db",
                "@jobhunter/db/*",
                "@jobhunter/llm",
                "@jobhunter/llm/*",
              ],
              message:
                "Server-only. Bundling these ships the Postgres driver and the LLM API key to the browser.",
            },
          ],
        },
      ],
    },
  },

  // Must stay last: strips every rule Prettier already decides.
  prettier,
);

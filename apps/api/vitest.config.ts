import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/**
 * unplugin-swc, not esbuild's default transform: esbuild strips decorators
 * without emitting design:paramtypes metadata, which silently breaks
 * NestJS's constructor-injection DI. This is a Vitest-specific concern --
 * `tsc` (the build script) already emits correct metadata on its own.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    globals: true,
    root: "./",
  },
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: { transform: { decoratorMetadata: true, legacyDecorator: true } },
    }),
  ],
});

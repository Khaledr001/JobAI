// Stand-in for the portfolio's real "../assets" module (image imports that
// only resolve inside a Vite build). Every requested key resolves to its
// own name as a plain string -- harmless, since the importer only reads
// `experiences`/`projects`/`technologies`, never the icon/image values
// themselves. See PLAN.md's "Two mechanics to settle before writing
// importers" and docs/DECISIONS.md.
//
// Written as CommonJS deliberately: esbuild's ESM named-import interop for
// a CJS module resolves each imported name as a property access on
// `module.exports` at runtime, which is exactly what lets a single Proxy
// stand in for 20+ named imports the source file never enumerates for us.
module.exports = new Proxy(
  {},
  {
    get: (_target, prop) => (typeof prop === "string" ? prop : String(prop)),
  },
);

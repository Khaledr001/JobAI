/**
 * Split into its own file to avoid a module.ts <-> service.ts circular
 * import: `llm.module.ts` needs `LlmService` and `LlmService` needs this
 * token, and having each import the other broke DI resolution (the
 * `@Inject(LLM_PROVIDER)` decorator saw `undefined` at decoration time).
 */
export const LLM_PROVIDER = Symbol("LLM_PROVIDER");

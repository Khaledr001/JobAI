import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmCompleteResult, LlmProvider } from "@jobhunter/llm";
import { DB } from "../../database/database.module.js";
import { LLM_PROVIDER } from "./llm-provider.token.js";
import { LlmService } from "./llm.service.js";

const CONFIG_VALUES: Record<string, unknown> = {
  LLM_MODE: "live",
  LLM_DAILY_BUDGET_USD: 1,
};

const OWNER_ID = "11111111-1111-1111-1111-111111111111";

/**
 * A fake `Db` whose `.transaction()` hands the callback a fake `tx`
 * supporting exactly the three calls `runAsOwner`/`LlmService` make:
 * `execute` (the `set_config` call), `select().from().where()` (the spend
 * query), and `insert().values()` (the ledger write). This is deliberately
 * NOT a full Drizzle mock -- just enough surface for these two call sites.
 */
function makeMockDb(spentTotal: string) {
  const where = vi.fn().mockResolvedValue([{ total: spentTotal }]);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values });
  const execute = vi.fn().mockResolvedValue(undefined);
  const tx: { execute: typeof execute; select: typeof select; insert: typeof insert } = {
    execute,
    select,
    insert,
  };
  const transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(tx));
  return { transaction, select, insert, execute, values };
}

const FAKE_RESULT: LlmCompleteResult = {
  content: "hello",
  usage: {
    promptTokens: 100,
    completionTokens: 20,
    cacheHitTokens: 80,
    cacheMissTokens: 20,
  },
  estimatedCostUsd: 0.001,
};

describe("LlmService", () => {
  let complete: ReturnType<typeof vi.fn>;
  let fakeProvider: LlmProvider;

  beforeEach(() => {
    complete = vi.fn().mockResolvedValue(FAKE_RESULT);
    fakeProvider = { id: "fake", complete };
  });

  async function build(
    db: ReturnType<typeof makeMockDb>,
    configOverrides: Record<string, unknown> = {},
  ) {
    const values = { ...CONFIG_VALUES, ...configOverrides };
    const moduleRef = await Test.createTestingModule({
      providers: [
        LlmService,
        { provide: DB, useValue: db },
        { provide: LLM_PROVIDER, useValue: fakeProvider },
        { provide: ConfigService, useValue: { get: (key: string) => values[key] } },
      ],
    }).compile();
    return moduleRef.get(LlmService);
  }

  it("checks the budget before calling the provider", async () => {
    const db = makeMockDb("0");
    const service = await build(db, { LLM_DAILY_BUDGET_USD: 0 });

    await expect(
      service.complete(OWNER_ID, "gap-analysis", {
        model: "deepseek-v4-flash",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow();

    expect(complete).not.toHaveBeenCalled();
  });

  it("calls the provider and records the call when within budget", async () => {
    const db = makeMockDb("0.10");
    const service = await build(db);

    const result = await service.complete(OWNER_ID, "gap-analysis", {
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(complete).toHaveBeenCalledOnce();
    expect(result).toEqual(FAKE_RESULT);
    expect(db.insert).toHaveBeenCalledOnce();
    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: OWNER_ID,
        feature: "gap-analysis",
        provider: "deepseek",
        model: "deepseek-v4-flash",
        promptTokens: 100,
        completionTokens: 20,
        cacheHitTokens: 80,
        cacheMissTokens: 20,
        estimatedCostUsd: "0.001000",
        cassetteMode: "live",
      }),
    );
  });

  it("throws when spend already at the daily budget, without ever querying the provider", async () => {
    const db = makeMockDb("1.00");
    const service = await build(db, { LLM_DAILY_BUDGET_USD: 1 });

    await expect(
      service.complete(OWNER_ID, "gap-analysis", {
        model: "deepseek-v4-flash",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow();

    expect(complete).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("reports spend for the day via getSpentTodayUsd", async () => {
    const db = makeMockDb("0.42");
    const service = await build(db);

    await expect(service.getSpentTodayUsd(OWNER_ID)).resolves.toBe(0.42);
  });
});

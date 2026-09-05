import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmCompleteResult } from "@jobhunter/llm";
import { DB } from "../../database/database.module.js";
import { LlmService } from "../llm/llm.service.js";
import { GapAnalysisService } from "./gap-analysis.service.js";

const OWNER_ID = "11111111-1111-1111-1111-111111111111";
const JOB_DESCRIPTION =
  "We need a backend engineer with strong NestJS and Kubernetes experience, ".repeat(2);

function makeMockDb(claimRows: Array<{ subject: string; statement: string }>) {
  const execute = vi.fn().mockResolvedValue(claimRows);
  const tx = { execute };
  const transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(tx));
  return { transaction, execute };
}

function fakeResult(content: unknown): LlmCompleteResult {
  return {
    content: JSON.stringify(content),
    usage: {
      promptTokens: 10,
      completionTokens: 5,
      cacheHitTokens: 5,
      cacheMissTokens: 5,
    },
    estimatedCostUsd: 0.0001,
  };
}

describe("GapAnalysisService", () => {
  let complete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    complete = vi.fn();
  });

  async function build(db: ReturnType<typeof makeMockDb>) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GapAnalysisService,
        { provide: DB, useValue: db },
        { provide: LlmService, useValue: { complete } },
      ],
    }).compile();
    return moduleRef.get(GapAnalysisService);
  }

  it("passes the verified profile and the JD to the prompt, and returns the parsed result", async () => {
    const db = makeMockDb([
      { subject: "NestJS", statement: "Built production NestJS APIs." },
    ]);
    complete.mockResolvedValue(
      fakeResult({
        matched: [
          { technology: "NestJS", jdQuote: "strong NestJS", claimSubject: "NestJS" },
        ],
        missing: [
          {
            technology: "Kubernetes",
            jdQuote: "Kubernetes experience",
            necessity: "required",
          },
        ],
        summary: "Strong backend match; Kubernetes is the one gap.",
      }),
    );
    const service = await build(db);

    const result = await service.analyze(OWNER_ID, { jobDescription: JOB_DESCRIPTION });

    expect(complete).toHaveBeenCalledOnce();
    const [ownerArg, featureArg, options] = complete.mock.calls[0] as [
      string,
      string,
      { messages: Array<{ content: string }> },
    ];
    expect(ownerArg).toBe(OWNER_ID);
    expect(featureArg).toBe("gap-analysis");
    const userMessage = options.messages.find((m) => m.content.includes(JOB_DESCRIPTION));
    expect(userMessage).toBeDefined();
    expect(options.messages.some((m) => m.content.includes("NestJS"))).toBe(true);

    expect(result.matched).toHaveLength(1);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0]?.technology).toBe("Kubernetes");
  });

  it("rejects a response that doesn't match the schema, rather than passing it through", async () => {
    const db = makeMockDb([]);
    complete.mockResolvedValue(
      fakeResult({ matched: [], missing: [], summaryTypo: "oops" }),
    );
    const service = await build(db);

    await expect(
      service.analyze(OWNER_ID, { jobDescription: JOB_DESCRIPTION }),
    ).rejects.toThrow(/schema validation/);
  });

  it("rejects a response that isn't valid JSON", async () => {
    const db = makeMockDb([]);
    complete.mockResolvedValue({
      content: "not json",
      usage: {
        promptTokens: 1,
        completionTokens: 1,
        cacheHitTokens: 0,
        cacheMissTokens: 1,
      },
      estimatedCostUsd: 0,
    });
    const service = await build(db);

    await expect(
      service.analyze(OWNER_ID, { jobDescription: JOB_DESCRIPTION }),
    ).rejects.toThrow(/not valid JSON/);
  });

  it("still calls the LLM with an empty profile when the operator has no emittable claims yet", async () => {
    const db = makeMockDb([]);
    complete.mockResolvedValue(
      fakeResult({ matched: [], missing: [], summary: "No verified skills yet." }),
    );
    const service = await build(db);

    const result = await service.analyze(OWNER_ID, { jobDescription: JOB_DESCRIPTION });
    expect(result.summary).toBe("No verified skills yet.");
  });
});

import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { schema } from "@jobhunter/db";
import type { LlmCompleteResult } from "@jobhunter/llm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DB } from "../../database/database.module.js";
import { LlmService } from "../llm/llm.service.js";
import { DocumentsService } from "./documents.service.js";

const OWNER_ID = "11111111-1111-1111-1111-111111111111";
const JOB_ROW = {
  id: "job-1",
  title: "Backend Engineer",
  company: "Acme",
  location: null,
  description: "We need a backend engineer.",
};
const CLAIM_ROW = {
  id: "22222222-2222-4222-8222-222222222222",
  kind: "used_technology",
  subject: "NestJS",
  statement: "Used NestJS in production.",
  quantities: {},
  verification: "documented",
};

function fakeResult(content: unknown): LlmCompleteResult {
  return {
    content: JSON.stringify(content),
    usage: {
      promptTokens: 10,
      completionTokens: 5,
      cacheHitTokens: 0,
      cacheMissTokens: 10,
    },
    estimatedCostUsd: 0.0001,
  };
}

function makeMockDb() {
  const findFirst = vi.fn().mockResolvedValue(JOB_ROW);
  const execute = vi.fn().mockResolvedValue([CLAIM_ROW]);

  const documentsReturning = vi.fn().mockImplementation(() =>
    Promise.resolve([
      {
        id: "doc-1",
        ownerId: OWNER_ID,
        jobId: JOB_ROW.id,
        kind: "resume",
        filePathPdf: "/tmp/doc-1.pdf",
        filePathDocx: "/tmp/doc-1.docx",
      },
    ]),
  );
  const documentsValues = vi.fn().mockReturnValue({ returning: documentsReturning });

  const spansReturning = vi
    .fn()
    .mockImplementation(() => Promise.resolve([{ id: "span-1" }]));
  const spansValues = vi.fn().mockReturnValue({ returning: spansReturning });

  const insert = vi.fn((table: unknown) => {
    if (table === schema.documents) return { values: documentsValues };
    if (table === schema.documentSpans) return { values: spansValues };
    throw new Error("unexpected insert target in test");
  });

  const tx: { execute: typeof execute; insert: typeof insert } = { execute, insert };
  const transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(tx));

  return {
    query: { jobCanonical: { findFirst } },
    transaction,
    execute,
    insert,
    documentsValues,
    spansValues,
  };
}

describe("DocumentsService", () => {
  let complete: ReturnType<typeof vi.fn>;
  let documentsDir: string;

  beforeEach(() => {
    complete = vi.fn();
    documentsDir = mkdtempSync(join(tmpdir(), "jobhunter-documents-test-"));
  });

  afterEach(() => {
    rmSync(documentsDir, { recursive: true, force: true });
  });

  async function build(db: ReturnType<typeof makeMockDb>) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: DB, useValue: db },
        { provide: LlmService, useValue: { complete } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === "DOCUMENTS_DIR" ? documentsDir : undefined),
          },
        },
      ],
    }).compile();
    return moduleRef.get(DocumentsService);
  }

  it("generates and persists a document when the first draft passes validation", async () => {
    complete.mockResolvedValue(
      fakeResult({
        candidateName: "Operator",
        spans: [
          {
            kind: "bullet",
            text: "Used NestJS in production.",
            claimIds: [CLAIM_ROW.id],
          },
        ],
      }),
    );
    const db = makeMockDb();
    const service = await build(db);

    const result = await service.generate(OWNER_ID, {
      jobId: JOB_ROW.id,
      kind: "resume",
    });

    expect(complete).toHaveBeenCalledOnce();
    expect(db.documentsValues).toHaveBeenCalledOnce();
    expect(db.spansValues).toHaveBeenCalledWith([
      expect.objectContaining({ claimIds: [CLAIM_ROW.id], kind: "bullet", order: 0 }),
    ]);
    expect(result.document.id).toBe("doc-1");

    // The render step is real (pdfkit/docx), not mocked -- confirm real
    // .pdf/.docx files actually landed on disk under this owner's directory.
    const files = readdirSync(join(documentsDir, OWNER_ID));
    expect(files.some((f) => f.endsWith(".pdf"))).toBe(true);
    expect(files.some((f) => f.endsWith(".docx"))).toBe(true);
  });

  it("retries once with violations appended when the first draft is rejected, and succeeds if the retry is clean", async () => {
    complete
      .mockResolvedValueOnce(
        fakeResult({
          candidateName: "Operator",
          // Fabricated skill (Kubernetes) not present in any claim --
          // PLAN.md's literal acceptance-test scenario for Phase 8.
          spans: [
            { kind: "bullet", text: "Expert in Kubernetes.", claimIds: [CLAIM_ROW.id] },
          ],
        }),
      )
      .mockResolvedValueOnce(
        fakeResult({
          candidateName: "Operator",
          spans: [
            {
              kind: "bullet",
              text: "Used NestJS in production.",
              claimIds: [CLAIM_ROW.id],
            },
          ],
        }),
      );
    const db = makeMockDb();
    const service = await build(db);

    const result = await service.generate(OWNER_ID, {
      jobId: JOB_ROW.id,
      kind: "resume",
    });

    expect(complete).toHaveBeenCalledTimes(2);
    // The retry prompt must include the violation the first draft triggered.
    const secondCallMessages = complete.mock.calls[1]![2].messages as Array<{
      content: string;
    }>;
    expect(secondCallMessages.some((m) => m.content.includes("UNSUPPORTED_ENTITY"))).toBe(
      true,
    );
    expect(result.document.id).toBe("doc-1");
  });

  it("throws DOCUMENT_VALIDATION_FAILED with the violations, and persists nothing, if the retry is also rejected", async () => {
    complete.mockResolvedValue(
      fakeResult({
        candidateName: "Operator",
        spans: [
          { kind: "bullet", text: "Expert in Kubernetes.", claimIds: [CLAIM_ROW.id] },
        ],
      }),
    );
    const db = makeMockDb();
    const service = await build(db);

    await expect(
      service.generate(OWNER_ID, { jobId: JOB_ROW.id, kind: "resume" }),
    ).rejects.toMatchObject({
      code: "DOCUMENT_VALIDATION_FAILED",
      details: {
        violations: expect.arrayContaining([
          expect.objectContaining({ code: "UNSUPPORTED_ENTITY" }),
        ]),
      },
    });

    expect(complete).toHaveBeenCalledTimes(2);
    expect(db.documentsValues).not.toHaveBeenCalled();
  });
});

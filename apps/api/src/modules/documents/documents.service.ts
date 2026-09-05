import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq, sql } from "drizzle-orm";
import { runAsOwner, schema, type Db } from "@jobhunter/db";
import {
  validate,
  type Claim,
  type DocumentSpan,
  type Violation,
} from "@jobhunter/claims";
import { computeCassetteKey } from "@jobhunter/llm";
import { renderDocx, renderPdf, type ResumeDocument } from "@jobhunter/resume-render";
import { AppError, ERROR_CODES } from "@jobhunter/shared-utils";
import { DB } from "../../database/database.module.js";
import type { AppEnv } from "../../config/env.js";
import { LlmService } from "../llm/llm.service.js";
import {
  buildDocumentGenerationPrompt,
  DOCUMENT_RESPONSE_JSON_SCHEMA,
  PROMPT_VERSION,
} from "./prompts/documents.prompt.js";
import { GeneratedDocumentSchema, type GenerateDocumentDto } from "./dto.js";

const MODEL = "deepseek-v4-pro" as const;

interface EmittableClaimRow {
  [key: string]: unknown;
  id: string;
  kind: Claim["kind"];
  subject: string;
  statement: string;
  quantities: Record<string, unknown>;
  verification: Claim["verification"];
}

/**
 * The generator loop from PLAN.md's "Resume generation + anti-fabrication"
 * diagram: `v_emittable_claims` -> LLM draft -> `validate()` -> pass ->
 * render; fail -> retry once with violations appended -> fail again ->
 * surface to the operator, never persisted, never rendered. Three
 * independent layers keep this honest: this service only ever shows the
 * model `v_emittable_claims`; `validate()` runs here, in the write path,
 * before a single byte is rendered; and the `document_spans` DB trigger
 * (sql/04-functions.sql) is the backstop if this service is ever bypassed.
 */
@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly llmService: LlmService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  async generate(ownerId: string, dto: GenerateDocumentDto) {
    const job = await this.db.query.jobCanonical.findFirst({
      where: eq(schema.jobCanonical.id, dto.jobId),
    });
    if (!job) {
      throw new AppError(ERROR_CODES.NOT_FOUND, `Job ${dto.jobId} not found`);
    }

    const claimRows = await runAsOwner(this.db, ownerId, (tx) =>
      tx.execute<EmittableClaimRow>(
        sql`SELECT id, kind, subject, statement, quantities, verification FROM v_emittable_claims WHERE owner_id = ${ownerId}::uuid ORDER BY subject, id`,
      ),
    );
    const claims: Claim[] = claimRows.map((r) => ({
      id: r.id,
      kind: r.kind,
      subject: r.subject,
      statement: r.statement,
      quantities: r.quantities,
      verification: r.verification,
      emittable: true,
    }));

    let { spans, cassetteKey } = await this.draft(ownerId, claims, job);
    let result = validate(spans, claims, { jobDescription: job.description });

    if (!result.ok) {
      ({ spans, cassetteKey } = await this.draft(
        ownerId,
        claims,
        job,
        result.violations,
      ));
      result = validate(spans, claims, { jobDescription: job.description });
    }

    if (!result.ok) {
      throw new AppError(
        ERROR_CODES.DOCUMENT_VALIDATION_FAILED,
        "Generated document failed validation after one retry -- not persisted, not rendered.",
        { violations: result.violations },
      );
    }

    return this.persist(ownerId, dto, job, spans, cassetteKey);
  }

  private async draft(
    ownerId: string,
    claims: Claim[],
    job: { title: string; company: string; description: string },
    priorViolations?: readonly Violation[],
  ): Promise<{ spans: DocumentSpan[]; cassetteKey: string }> {
    const messages = buildDocumentGenerationPrompt(claims, job, priorViolations);
    const options = {
      model: MODEL,
      messages,
      temperature: 0,
      responseSchema: DOCUMENT_RESPONSE_JSON_SCHEMA,
    };
    const result = await this.llmService.complete(ownerId, "documents", options);
    // Computed from the exact request just sent -- the same key withCassette()
    // itself would compute -- and frozen onto the `documents` row at
    // generation time (persist()), not recomputed later at approval time,
    // since the underlying claims (and so the key) could change by then.
    const cassetteKey = computeCassetteKey(
      "deepseek",
      options,
      this.configService.get("LLM_SEED", { infer: true }),
    );

    let raw: unknown;
    try {
      raw = JSON.parse(result.content);
    } catch {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        "Document generation response was not valid JSON",
      );
    }
    const parsed = GeneratedDocumentSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        `Document generation response failed schema validation: ${parsed.error.message}`,
      );
    }
    return { spans: parsed.data.spans, cassetteKey };
  }

  private async persist(
    ownerId: string,
    dto: GenerateDocumentDto,
    job: { title: string; company: string },
    spans: DocumentSpan[],
    cassetteKey: string,
  ) {
    // The operator's real name, read from the row that owns the ledger --
    // never asked of the model, which has no way to know it and would have
    // to invent one. `users` is not owner-scoped, so this is a plain read.
    const [user] = await this.db
      .select({ displayName: schema.users.displayName })
      .from(schema.users)
      .where(eq(schema.users.id, ownerId))
      .limit(1);
    if (!user?.displayName) {
      throw new AppError(
        ERROR_CODES.NOT_FOUND,
        `Cannot render a resume: user ${ownerId} has no displayName.`,
      );
    }

    const resumeDocument: ResumeDocument = {
      candidateName: user.displayName,
      sections: [
        {
          heading: `${job.title} at ${job.company}`,
          spans: spans.map((span) => ({
            kind: span.kind,
            text: span.text,
            claimIds: span.claimIds,
            ...(span.scopeRef !== undefined ? { scopeRef: span.scopeRef } : {}),
          })),
        },
      ],
    };
    const [pdfBuffer, docxBuffer] = await Promise.all([
      renderPdf(resumeDocument),
      renderDocx(resumeDocument),
    ]);

    const documentId = randomUUID();
    const dir = resolve(
      process.cwd(),
      this.configService.get("DOCUMENTS_DIR", { infer: true }),
      ownerId,
    );
    mkdirSync(dir, { recursive: true });
    const filePathPdf = resolve(dir, `${documentId}.pdf`);
    const filePathDocx = resolve(dir, `${documentId}.docx`);
    writeFileSync(filePathPdf, pdfBuffer);
    writeFileSync(filePathDocx, docxBuffer);

    return runAsOwner(this.db, ownerId, async (tx) => {
      const [documentRow] = await tx
        .insert(schema.documents)
        .values({
          id: documentId,
          ownerId,
          jobId: dto.jobId,
          kind: dto.kind,
          filePathPdf,
          filePathDocx,
          model: MODEL,
          promptVersion: PROMPT_VERSION,
          cassetteKey,
        })
        .returning();
      if (!documentRow) {
        throw new AppError(ERROR_CODES.INTERNAL, "documents insert returned no row");
      }

      const spanRows = await tx
        .insert(schema.documentSpans)
        .values(
          spans.map((span, index) => ({
            documentId: documentRow.id,
            ownerId,
            kind: span.kind,
            text: span.text,
            claimIds: span.claimIds,
            scopeRef: span.scopeRef,
            order: index,
          })),
        )
        .returning();

      return { document: documentRow, spans: spanRows };
    });
  }
}

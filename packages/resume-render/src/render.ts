/**
 * STUB -- Phase 8. Renders a validated document model to PDF and DOCX.
 * Mirrors the reference repo's packages/pdf-documents shape: a pure
 * `render() -> Buffer` with no side effects, so a render is reproducible
 * from stored input alone (needed for the immutable application snapshot in
 * Phase 9).
 */
export interface ResumeDocument {
  sections: Array<{
    heading: string;
    spans: Array<{ text: string; claimIds: string[] }>;
  }>;
}

export function renderPdf(_doc: ResumeDocument): Buffer {
  throw new Error("renderPdf: not yet implemented (Phase 8)");
}

export function renderDocx(_doc: ResumeDocument): Buffer {
  throw new Error("renderDocx: not yet implemented (Phase 8)");
}

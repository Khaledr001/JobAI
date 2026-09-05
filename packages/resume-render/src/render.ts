import PDFDocument from "pdfkit";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

/**
 * Mirrors packages/claims' `DocumentSpan` shape exactly (`kind`, `text`,
 * `claimIds`, `scopeRef`) -- this package never invents its own citation
 * model. A document is validated (`@jobhunter/claims`' `validate()`)
 * *before* it ever reaches `renderPdf`/`renderDocx`; this package has no
 * opinion on what's true, only how to lay out what's already been proven.
 */
export interface ResumeSpan {
  kind: "summary" | "bullet";
  text: string;
  claimIds: string[];
  scopeRef?: string;
}

export interface ResumeSection {
  heading: string;
  spans: ResumeSpan[];
}

export interface ResumeDocument {
  candidateName: string;
  contactLine?: string;
  sections: ResumeSection[];
}

/**
 * Pure `render() -> Buffer` (Promise-wrapped: both pdfkit and docx are
 * stream/async-buffer libraries, not synchronous ones -- no side effects
 * either way). Reproducible from stored input alone, which is what backs
 * Phase 9's immutable application snapshot: the exact bytes sent to an
 * employer must be re-derivable from the `documents`/`document_spans` rows
 * that produced them.
 *
 * No custom font embedding yet -- `assets/` is empty and pdfkit's built-in
 * standard fonts (Helvetica family) need no external file at all. A
 * dual-path `resolveFont` (the reference repo's shape) is real follow-up
 * work, not needed for a correct, real PDF today.
 */
export function renderPdf(doc: ResumeDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    pdf.font("Helvetica-Bold").fontSize(18).text(doc.candidateName);
    if (doc.contactLine) {
      pdf.font("Helvetica").fontSize(10).text(doc.contactLine);
    }
    pdf.moveDown();

    for (const section of doc.sections) {
      pdf.font("Helvetica-Bold").fontSize(13).text(section.heading);
      pdf.moveDown(0.3);
      for (const span of section.spans) {
        pdf.font("Helvetica").fontSize(10.5);
        if (span.kind === "bullet") {
          pdf.text(`• ${span.text}`, { indent: 12 });
        } else {
          pdf.text(span.text);
        }
      }
      pdf.moveDown();
    }

    pdf.end();
  });
}

export async function renderDocx(doc: ResumeDocument): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: doc.candidateName, bold: true })],
    }),
  ];
  if (doc.contactLine) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: doc.contactLine, size: 20 })] }),
    );
  }

  for (const section of doc.sections) {
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_2, text: section.heading }),
    );
    for (const span of section.spans) {
      children.push(
        new Paragraph({
          ...(span.kind === "bullet" ? { bullet: { level: 0 } } : {}),
          children: [new TextRun({ text: span.text })],
        }),
      );
    }
  }

  const document = new Document({ sections: [{ children }] });
  return Packer.toBuffer(document);
}

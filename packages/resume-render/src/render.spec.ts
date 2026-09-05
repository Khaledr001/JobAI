import { describe, expect, it } from "vitest";
import { renderDocx, renderPdf, type ResumeDocument } from "./render.js";

const DOC: ResumeDocument = {
  candidateName: "Test Candidate",
  contactLine: "test@example.invalid",
  sections: [
    {
      heading: "Experience",
      spans: [
        { kind: "summary", text: "Backend engineer.", claimIds: [] },
        {
          kind: "bullet",
          text: "Built a real thing.",
          claimIds: ["11111111-1111-1111-1111-111111111111"],
        },
      ],
    },
  ],
};

describe("renderPdf", () => {
  it("produces a real PDF file (starts with the %PDF- magic bytes)", async () => {
    const buffer = await renderPdf(DOC);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(500);
  });

  it("is reproducible: the same input renders to the same byte length twice in a row", async () => {
    const a = await renderPdf(DOC);
    const b = await renderPdf(DOC);
    // pdfkit embeds a CreationDate, so exact byte equality isn't guaranteed
    // across two calls a millisecond apart -- length stability is the
    // practical proxy that rendering has no hidden randomness in content.
    expect(a.length).toBe(b.length);
  });
});

describe("renderDocx", () => {
  it("produces a real DOCX file (a zip archive -- starts with the PK magic bytes)", async () => {
    const buffer = await renderDocx(DOC);
    expect(buffer.subarray(0, 2).toString("ascii")).toBe("PK");
    expect(buffer.length).toBeGreaterThan(500);
  });
});

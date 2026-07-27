// @vitest-environment node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ResumeProcessingLimits } from "./contracts";
import { extractResumeText } from "./extract.server";
import {
  classifyPdfParserError,
  type PdfTextParser,
} from "./pdf-parser.server";

const fixture = (name: string) =>
  fileURLToPath(
    new URL(`../../../tests/fixtures/resume/${name}`, import.meta.url),
  );
const limits: ResumeProcessingLimits = {
  maxUploadBytes: 5 * 1024 * 1024,
  maxPages: 20,
  maxTextCharacters: 200_000,
  minMeaningfulAlphanumericCharacters: 40,
};

async function extractFixture(
  name: string,
  overrides: Partial<ResumeProcessingLimits> = {},
) {
  return extractResumeText({
    data: new Uint8Array(await readFile(fixture(name))),
    filename: name,
    limits: { ...limits, ...overrides },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("server-side PDF text extraction", () => {
  it("extracts deterministic normalized text and matching metadata", async () => {
    const result = await extractFixture("valid-resume.pdf");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.filename).toBe("valid-resume.pdf");
    expect(result.data.pageCount).toBe(1);
    expect(result.data.text).toContain("FICTIONAL RESUME");
    expect(result.data.text).toContain(
      "Experience: Created reliable tools and documented repeatable workflows.",
    );
    expect(result.data.characterCount).toBe(result.data.text.length);
    expect(result.data.warnings).toHaveLength(1);
  });

  it("extracts every page in source order", async () => {
    const result = await extractFixture("multi-page-resume.pdf");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.pageCount).toBe(2);
      expect(result.data.text.indexOf("FICTIONAL RESUME")).toBeLessThan(
        result.data.text.indexOf("FICTIONAL EXPERIENCE CONTINUED"),
      );
    }
  });

  it.each([
    ["blank-resume.pdf", "empty_pdf"],
    ["image-only-resume.pdf", "image_only_pdf"],
    ["encrypted-resume.pdf", "encrypted_pdf"],
    ["corrupted-resume.pdf", "corrupted_pdf"],
    ["renamed-text.pdf", "unreadable_pdf"],
    ["symbols-only-resume.pdf", "no_meaningful_text"],
  ])("maps %s to the stable %s code", async (name, code) => {
    const result = await extractFixture(name);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(code);
      expect(result.error.message).not.toContain("Invalid PDF structure");
    }
  });

  it("rejects page and text limits without partial output", async () => {
    const pageResult = await extractFixture("multi-page-resume.pdf", {
      maxPages: 1,
    });
    const textResult = await extractFixture("valid-resume.pdf", {
      maxTextCharacters: 100,
    });

    expect(pageResult).toMatchObject({
      ok: false,
      error: { code: "page_limit_exceeded" },
    });
    expect(textResult).toMatchObject({
      ok: false,
      error: { code: "text_limit_exceeded" },
    });
  });

  it("maps negligible parser output independently of PDF.js", async () => {
    const parser: PdfTextParser = async () => ({
      pageCount: 1,
      pageTexts: ["1\n2\n---\nA"],
      hasImages: false,
    });
    const result = await extractResumeText({
      data: new Uint8Array([1]),
      filename: "negligible.pdf",
      limits,
      parser,
    });

    expect(result).toMatchObject({
      ok: false,
      status: "no_meaningful_text",
      error: { code: "no_meaningful_text" },
    });
  });

  it("contains unexpected parser errors without logging content or messages", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const parser: PdfTextParser = async () => {
      throw new Error("SECRET DOCUMENT TEXT /Users/private/path");
    };
    const result = await extractResumeText({
      data: new Uint8Array([1]),
      filename: "fictional.pdf",
      limits,
      parser,
    });

    expect(result).toMatchObject({
      ok: false,
      status: "extraction_failure",
      error: { code: "internal_extraction_failure" },
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Resume extraction failed unexpectedly.",
      { errorName: "Error" },
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("SECRET");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("/Users");
  });

  it("classifies parser errors by stable type/name/code boundaries", () => {
    expect(classifyPdfParserError({ name: "PasswordException", code: 1 })).toBe(
      "encrypted_pdf",
    );
    expect(classifyPdfParserError({ name: "XRefParseException" })).toBe(
      "corrupted_pdf",
    );
    expect(
      classifyPdfParserError({ name: "UnexpectedResponseException" }),
    ).toBe("unreadable_pdf");
    expect(classifyPdfParserError(new Error("unknown"))).toBeNull();
  });
});

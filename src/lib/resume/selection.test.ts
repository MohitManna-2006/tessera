import { describe, expect, it } from "vitest";

import {
  formatFileSize,
  hasPdfExtension,
  hasPdfFileSignature,
  hasSupportedPdfMimeType,
  validateResumeFileSelection,
} from "./selection";

function file(name: string, options: { size?: number; type?: string } = {}) {
  return new File([new Uint8Array(options.size ?? 12)], name, {
    type: options.type ?? "application/pdf",
  });
}

describe("resume file selection", () => {
  it("accepts a single PDF through the shared picker/drop validation path", () => {
    const selected = file("FICTIONAL-RESUME.PDF");

    expect(validateResumeFileSelection([selected])).toEqual({
      ok: true,
      file: selected,
    });
    expect(hasPdfExtension("FICTIONAL-RESUME.PDF")).toBe(true);
    expect(hasSupportedPdfMimeType("")).toBe(true);
  });

  it.each([
    { files: [], code: "missing_file" },
    {
      files: [file("first.pdf"), file("second.pdf")],
      code: "invalid_upload",
    },
    { files: [file("empty.pdf", { size: 0 })], code: "empty_file" },
    {
      files: [file("large.pdf", { size: 17 })],
      maxUploadBytes: 16,
      code: "file_too_large",
    },
    {
      files: [file("resume.txt")],
      code: "unsupported_file_type",
    },
    {
      files: [file("resume.pdf", { type: "text/plain" })],
      code: "unsupported_file_type",
    },
  ])(
    "rejects invalid selection as $code",
    ({ files, maxUploadBytes, code }) => {
      expect(validateResumeFileSelection(files, maxUploadBytes)).toEqual({
        ok: false,
        code,
      });
    },
  );

  it("recognizes a PDF signature only near the beginning of the bytes", () => {
    expect(
      hasPdfFileSignature(
        new TextEncoder().encode("metadata\n%PDF-1.7\nsynthetic"),
      ),
    ).toBe(true);
    expect(hasPdfFileSignature(new TextEncoder().encode("plain text"))).toBe(
      false,
    );
    expect(
      hasPdfFileSignature(
        new Uint8Array([
          ...new Uint8Array(1025),
          ...new TextEncoder().encode("%PDF-1.7"),
        ]),
      ),
    ).toBe(false);
  });

  it("formats human-readable file sizes without unsafe precision", () => {
    expect(formatFileSize(0)).toBe("0 bytes");
    expect(formatFileSize(1)).toBe("1 byte");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

import { describe, expect, it } from "vitest";

import {
  DEFAULT_RESUME_PROCESSING_LIMITS,
  isResumeExtractionResult,
  RESUME_EXTRACTION_ERROR_CODES,
  type ResumeExtractionResult,
} from "./contracts";
import {
  createResumeExtractionFailure,
  getResumeErrorHttpStatus,
} from "./errors";

describe("resume extraction contract", () => {
  it("maps every stable error code to a typed status, safe message, and HTTP status", () => {
    for (const code of RESUME_EXTRACTION_ERROR_CODES) {
      const failure: ResumeExtractionResult = createResumeExtractionFailure(
        code,
        DEFAULT_RESUME_PROCESSING_LIMITS,
      );

      expect(isResumeExtractionResult(failure)).toBe(true);
      expect(failure.ok).toBe(false);
      expect(failure.error.code).toBe(code);
      expect(failure.error.message).not.toMatch(
        /stack|node_modules|\/Users\/|buffer/iu,
      );
      expect(getResumeErrorHttpStatus(code)).toBeGreaterThanOrEqual(400);
    }
  });

  it("accepts a coherent success result and rejects mismatched metadata", () => {
    const success: ResumeExtractionResult = {
      ok: true,
      status: "success",
      data: {
        filename: "fictional.pdf",
        pageCount: 1,
        characterCount: 4,
        text: "Test",
        warnings: [],
      },
    };

    expect(isResumeExtractionResult(success)).toBe(true);
    expect(
      isResumeExtractionResult({
        ...success,
        data: { ...success.data, characterCount: 99 },
      }),
    ).toBe(false);
  });
});

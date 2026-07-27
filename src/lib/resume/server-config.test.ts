// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DEFAULT_RESUME_PROCESSING_LIMITS,
  parseResumeProcessingLimits,
} from "./server-config";

describe("resume processing limit configuration", () => {
  it("uses the documented safe defaults", () => {
    expect(parseResumeProcessingLimits({})).toEqual({
      maxUploadBytes: 5 * 1024 * 1024,
      maxPages: 20,
      maxTextCharacters: 200_000,
      minMeaningfulAlphanumericCharacters: 40,
    });
  });

  it("accepts strict bounded integer overrides", () => {
    expect(
      parseResumeProcessingLimits({
        RESUME_MAX_UPLOAD_BYTES: "1048576",
        RESUME_MAX_PAGES: "12",
        RESUME_MAX_TEXT_CHARACTERS: "120000",
        RESUME_MIN_MEANINGFUL_ALPHANUMERIC_CHARACTERS: "60",
      }),
    ).toEqual({
      maxUploadBytes: 1_048_576,
      maxPages: 12,
      maxTextCharacters: 120_000,
      minMeaningfulAlphanumericCharacters: 60,
    });
  });

  it.each(["", "0", "-1", "1.5", "12px", " 12", "99999999999999999"])(
    "falls back safely for invalid page limits: %s",
    (value) => {
      expect(
        parseResumeProcessingLimits({ RESUME_MAX_PAGES: value }).maxPages,
      ).toBe(DEFAULT_RESUME_PROCESSING_LIMITS.maxPages);
    },
  );

  it("falls back for positive but unreasonable values", () => {
    expect(
      parseResumeProcessingLimits({
        RESUME_MAX_UPLOAD_BYTES: "999999999",
        RESUME_MAX_PAGES: "101",
        RESUME_MAX_TEXT_CHARACTERS: "999",
        RESUME_MIN_MEANINGFUL_ALPHANUMERIC_CHARACTERS: "1001",
      }),
    ).toEqual(DEFAULT_RESUME_PROCESSING_LIMITS);
  });
});

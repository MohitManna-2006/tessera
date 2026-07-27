import { describe, expect, it } from "vitest";

import {
  analyzeMeaningfulResumeText,
  MIN_MEANINGFUL_TOKEN_COUNT,
  normalizeResumeText,
} from "./normalization";

describe("resume text normalization", () => {
  it("normalizes parser artifacts while preserving source wording and sections", () => {
    const source =
      "\u0000FICTIONAL\u00a0RESUME \r\nCandidate: Test Persona\t \r" +
      "URL: https://example.invalid/test?q=1  \n\n\n\n\n" +
      "Dates: 2024–2026; Email: fictional@example.invalid\n";

    expect(normalizeResumeText(source)).toBe(
      "FICTIONAL RESUME\n" +
        "Candidate: Test Persona\n" +
        "URL: https://example.invalid/test?q=1\n\n\n" +
        "Dates: 2024–2026; Email: fictional@example.invalid",
    );
  });

  it("does not rewrite punctuation, casing, dates, or internal spacing", () => {
    const source = "TypeScript  /  React\nQ4 2026 — 100%\nA.B. Example";
    expect(normalizeResumeText(source)).toBe(source);
  });
});

describe("meaningful resume text detection", () => {
  it("accepts sufficiently substantive deterministic text", () => {
    const analysis = analyzeMeaningfulResumeText(
      "Fictional candidate builds reliable developer tools and documents repeatable testing workflows.",
      40,
    );

    expect(analysis.meaningful).toBe(true);
    expect(analysis.substantiveTokenCount).toBeGreaterThanOrEqual(
      MIN_MEANINGFUL_TOKEN_COUNT,
    );
  });

  it.each([
    "",
    "   \n\u0000",
    "---- .... **** !!!!",
    "1\n2\n3\n4\n5\n6\n7\n8\n9\n10",
    "A B C D E",
  ])("rejects empty, symbolic, page-number, or negligible output", (text) => {
    expect(analyzeMeaningfulResumeText(text, 40).meaningful).toBe(false);
  });
});

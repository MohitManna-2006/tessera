import { describe, expect, it } from "vitest";

import { RESUME_DRAFT_LIMITS } from "./contracts";
import { verifyEvidenceExcerpt } from "./evidence";

describe("resume evidence verification", () => {
  const source =
    "Built a release dashboard.\n\nTypeScript, React — 30% faster.\n" +
    "“Accessible by default”\nRepeated value\nRepeated value";

  it("matches exact excerpts", () => {
    expect(verifyEvidenceExcerpt(source, "Built a release dashboard.")).toEqual(
      {
        matched: true,
        occurrences: 1,
        normalization: "none",
      },
    );
  });

  it("matches conservative whitespace and line-break normalization", () => {
    expect(
      verifyEvidenceExcerpt(
        "Built reliable\nrelease tooling for teams.",
        "Built reliable release tooling for teams.",
      ),
    ).toEqual({
      matched: true,
      occurrences: 1,
      normalization: "whitespace",
    });
  });

  it("matches conservative typographic punctuation normalization", () => {
    expect(
      verifyEvidenceExcerpt(source, '"Accessible by default"'),
    ).toMatchObject({
      matched: true,
      normalization: "safe_reformat",
    });
    expect(
      verifyEvidenceExcerpt(source, "TypeScript, React - 30% faster."),
    ).toMatchObject({
      matched: true,
      normalization: "safe_reformat",
    });
  });

  it("reports repeated exact evidence without treating similarity as proof", () => {
    expect(verifyEvidenceExcerpt(source, "Repeated value")).toMatchObject({
      matched: true,
      occurrences: 2,
    });
    expect(
      verifyEvidenceExcerpt(source, "Built an unrelated dashboard."),
    ).toEqual({
      matched: false,
      occurrences: 0,
      normalization: "none",
    });
  });

  it("rejects absent and oversized excerpts", () => {
    expect(verifyEvidenceExcerpt(source, "")).toMatchObject({ matched: false });
    expect(
      verifyEvidenceExcerpt(
        source,
        "x".repeat(RESUME_DRAFT_LIMITS.maxEvidenceExcerptCharacters + 1),
      ),
    ).toMatchObject({ matched: false });
  });
});

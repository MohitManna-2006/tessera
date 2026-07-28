import { describe, expect, it } from "vitest";

import {
  PartialDateV1Schema,
  RESUME_DRAFT_LIMITS,
  ResumeDraftV1Schema,
  ResumeExtractionRequestV1Schema,
  SafeHttpUrlSchema,
} from "./contracts";
import { normalizeProviderResumeDraft } from "./normalization";
import {
  experiencedEngineerResumeText,
  validProviderResumeDraft,
} from "../../../tests/fixtures/resume-ai/fixtures";

function deterministicIds() {
  let index = 0;
  return (prefix: string) =>
    `${prefix}_test${String(++index).padStart(6, "0")}`;
}

function createValidDraft() {
  return normalizeProviderResumeDraft({
    providerOutput: structuredClone(validProviderResumeDraft),
    sourceText: experiencedEngineerResumeText,
    source: {
      filename: "synthetic-resume.pdf",
      pageCount: 2,
    },
    now: () => new Date("2026-07-27T12:00:00.000Z"),
    createId: deterministicIds(),
  });
}

describe("ResumeDraftV1 contract", () => {
  it("accepts a complete evidence-backed synthetic draft", () => {
    const result = ResumeDraftV1Schema.safeParse(createValidDraft());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schemaVersion).toBe(1);
      expect(result.data.operation).toBe("extract_resume");
      expect(result.data.promptVersion).toBe("resume-extract-v1");
      expect(result.data.draft.profile.emailPublic).toBe(false);
      expect(result.data.draft.profile.phonePublic).toBe(false);
      expect(result.data.draft.education[0]?.gpaPublic).toBe(false);
    }
  });

  it("accepts missing optional values without inventing empty strings", () => {
    const draft = createValidDraft();
    draft.draft.profile.sourceTitle = null;
    draft.draft.profile.location = null;
    draft.draft.projects[0]!.liveUrl = null;

    expect(
      ResumeDraftV1Schema.parse(draft).draft.profile.sourceTitle,
    ).toBeNull();
  });

  it("rejects future versions, unknown operations, unknown keys, and unsafe URLs", () => {
    const draft = createValidDraft();
    expect(
      ResumeDraftV1Schema.safeParse({ ...draft, schemaVersion: 2 }).success,
    ).toBe(false);
    expect(
      ResumeDraftV1Schema.safeParse({ ...draft, operation: "write_code" })
        .success,
    ).toBe(false);
    expect(
      ResumeDraftV1Schema.safeParse({ ...draft, providerResponseId: "secret" })
        .success,
    ).toBe(false);

    draft.draft.projects[0]!.repositoryUrl = "javascript:alert(1)";
    expect(ResumeDraftV1Schema.safeParse(draft).success).toBe(false);
  });

  it("enforces field and array bounds", () => {
    const draft = createValidDraft();
    draft.draft.profile.name = "N".repeat(
      RESUME_DRAFT_LIMITS.maxNameCharacters + 1,
    );
    expect(ResumeDraftV1Schema.safeParse(draft).success).toBe(false);

    const bounded = createValidDraft();
    bounded.draft.skills = Array.from(
      { length: RESUME_DRAFT_LIMITS.maxSkills + 1 },
      (_, index) => ({
        id: `skill_overflow${String(index).padStart(4, "0")}`,
        name: `Skill ${index}`,
        group: "Other",
      }),
    );
    expect(ResumeDraftV1Schema.safeParse(bounded).success).toBe(false);
  });
});

describe("partial dates", () => {
  it("preserves year-only precision and Present as separate state", () => {
    expect(
      PartialDateV1Schema.parse({
        precision: "year",
        year: 2026,
        month: null,
        sourceText: "2026",
      }),
    ).toEqual({
      precision: "year",
      year: 2026,
      month: null,
      sourceText: "2026",
    });
    expect(createValidDraft().draft.experience[0]).toMatchObject({
      current: true,
      endDate: null,
    });
  });

  it("rejects impossible months and precision increases", () => {
    expect(
      PartialDateV1Schema.safeParse({
        precision: "month",
        year: 2026,
        month: 13,
        sourceText: "2026",
      }).success,
    ).toBe(false);
    expect(
      PartialDateV1Schema.safeParse({
        precision: "year",
        year: 2026,
        month: 1,
        sourceText: "2026",
      }).success,
    ).toBe(false);
  });
});

describe("AI extraction request contract", () => {
  const request = {
    operation: "extract_resume" as const,
    text: experiencedEngineerResumeText,
    source: {
      filename: "synthetic.pdf",
      pageCount: 1,
      characterCount: experiencedEngineerResumeText.length,
    },
  };

  it("accepts strict meaningful input", () => {
    expect(ResumeExtractionRequestV1Schema.parse(request)).toEqual(request);
  });

  it.each([
    "",
    " \n\t ",
    "Too short",
    "A".repeat(RESUME_DRAFT_LIMITS.maxInputCharacters + 1),
  ])("rejects empty, negligible, or oversized input", (text) => {
    expect(
      ResumeExtractionRequestV1Schema.safeParse({ ...request, text }).success,
    ).toBe(false);
  });

  it("rejects unknown request fields and unexpected types", () => {
    expect(
      ResumeExtractionRequestV1Schema.safeParse({
        ...request,
        model: "client-selected-model",
      }).success,
    ).toBe(false);
    expect(
      ResumeExtractionRequestV1Schema.safeParse({
        ...request,
        operation: "write_code",
      }).success,
    ).toBe(false);
    expect(
      ResumeExtractionRequestV1Schema.safeParse({
        ...request,
        text: 42,
      }).success,
    ).toBe(false);
  });
});

describe("safe URLs", () => {
  it.each(["https://example.test", "http://localhost:3000/path"])(
    "accepts %s",
    (url) => {
      expect(SafeHttpUrlSchema.safeParse(url).success).toBe(true);
    },
  );

  it.each([
    "javascript:alert(1)",
    "data:text/plain,secret",
    "file:///Users/private/resume.pdf",
    "not a url",
  ])("rejects %s", (url) => {
    expect(SafeHttpUrlSchema.safeParse(url).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  experiencedEngineerResumeText,
  providerOutputFixtures,
  validProviderResumeDraft,
} from "../../../tests/fixtures/resume-ai/fixtures";
import { normalizeProviderResumeDraft } from "./normalization";

function ids() {
  let index = 0;
  return (prefix: string) => `${prefix}_trusted${++index}`;
}

function normalize(providerOutput: unknown = validProviderResumeDraft) {
  return normalizeProviderResumeDraft({
    providerOutput: structuredClone(providerOutput),
    sourceText: experiencedEngineerResumeText,
    source: {
      filename: "synthetic.pdf",
      pageCount: 1,
    },
    now: () => new Date("2026-07-27T12:00:00.000Z"),
    createId: ids(),
  });
}

describe("provider draft normalization", () => {
  it("assigns trusted stable IDs and preserves source order, dates, and metrics", () => {
    const draft = normalize();

    expect(draft.draftId).toMatch(/^draft_trusted/u);
    expect(draft.draft.experience[0]?.id).toMatch(/^experience_trusted/u);
    expect(draft.draft.experience[0]?.achievements[0]?.id).toMatch(
      /^achievement_trusted/u,
    );
    expect(draft.draft.experience[0]?.achievements[0]?.text).toContain("30%");
    expect(draft.draft.education[0]?.startDate).toEqual({
      precision: "year",
      year: 2018,
      month: null,
      sourceText: "2018",
    });
    expect(draft.draft.skills.map((skill) => skill.name)).toEqual([
      "TypeScript",
      "React",
      "PostgreSQL",
    ]);
  });

  it("downgrades unmatched evidence and creates an actionable warning", () => {
    const draft = normalize(
      providerOutputFixtures.evidence_mismatch_provider_output,
    );
    const nameEvidence = draft.evidence.find(
      (record) => record.target.field === "profile.name",
    );

    expect(nameEvidence).toMatchObject({
      support: "unsupported",
      matched: false,
    });
    expect(draft.warnings).toContainEqual(
      expect.objectContaining({
        category: "evidence_mismatch",
        severity: "review",
        target: expect.objectContaining({ field: "profile.name" }),
      }),
    );
  });

  it("rejects malformed output and unsafe provider URLs", () => {
    expect(() =>
      normalize(providerOutputFixtures.malformed_provider_output),
    ).toThrow();

    const unsafe = structuredClone(validProviderResumeDraft);
    unsafe.projects[0]!.repositoryUrl.value = "javascript:alert(1)";
    expect(() => normalize(unsafe)).toThrow();
  });

  it("deduplicates only exact case-insensitive skills and keeps a warning", () => {
    const duplicate = structuredClone(validProviderResumeDraft);
    duplicate.skills.push({
      ...duplicate.skills[0]!,
      name: { ...duplicate.skills[0]!.name, value: "typescript" },
    });
    duplicate.skills.push({
      ...duplicate.skills[0]!,
      name: { ...duplicate.skills[0]!.name, value: "TypeScript SDK" },
    });

    const draft = normalize(duplicate);

    expect(draft.draft.skills.map((skill) => skill.name)).toEqual([
      "TypeScript",
      "React",
      "PostgreSQL",
      "TypeScript SDK",
    ]);
    expect(draft.warnings).toContainEqual(
      expect.objectContaining({ category: "duplicate_entry" }),
    );
  });

  it("creates blocking warnings for structurally incomplete entries and invalid date order", () => {
    const invalid = structuredClone(validProviderResumeDraft);
    invalid.experience[0]!.company.value = null;
    invalid.experience[0]!.startDate.value = {
      precision: "year",
      year: 2026,
      month: null,
      sourceText: "2026",
    };
    invalid.experience[0]!.endDate.value = {
      precision: "year",
      year: 2024,
      month: null,
      sourceText: "2024",
    };

    const draft = normalize(invalid);

    expect(draft.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "missing_required_value",
          severity: "blocking",
        }),
        expect.objectContaining({
          category: "invalid_date_order",
          severity: "blocking",
        }),
      ]),
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  createInitialResumeReviewState,
  type DraftFieldReferenceV1,
} from "@/lib/resume-draft/contracts";
import { normalizeProviderResumeDraft } from "@/lib/resume-draft/normalization";
import {
  experiencedEngineerResumeText,
  providerOutputFixtures,
  validProviderResumeDraft,
} from "../../../tests/fixtures/resume-ai/fixtures";
import {
  approveResumeSection,
  commitResumeDraftChange,
  formatSectionSummary,
  getResumeDraftBlockingIssues,
  getReviewedSectionCount,
  getUnresolvedWarnings,
  resolveWarningsForTarget,
  validateResumeDraftReferences,
} from "./review-model";

function draft(providerOutput: unknown = validProviderResumeDraft) {
  return normalizeProviderResumeDraft({
    providerOutput,
    sourceText: experiencedEngineerResumeText,
    source: { filename: "synthetic.pdf", pageCount: 1 },
  });
}

describe("guided resume review model", () => {
  it("derives summary, warnings, and explicit review progress", () => {
    const current = draft();
    const review = createInitialResumeReviewState();

    expect(formatSectionSummary(current)).toBe(
      "1 experience, 1 project, 3 skills, 1 education entry",
    );
    expect(getReviewedSectionCount(review)).toBe(0);
    expect(
      getReviewedSectionCount(approveResumeSection(review, "profile")),
    ).toBe(1);
    expect(
      getUnresolvedWarnings(current, review).every(
        (warning) => warning.severity !== "info",
      ),
    ).toBe(true);
  });

  it("resolves a target warning without changing evidence status", () => {
    const current = draft(
      providerOutputFixtures.evidence_mismatch_provider_output,
    );
    const review = createInitialResumeReviewState();
    const target = current.warnings.find(
      (warning) => warning.category === "evidence_mismatch",
    )?.target;
    expect(target).not.toBeNull();

    const nextReview = resolveWarningsForTarget(
      current,
      review,
      target as DraftFieldReferenceV1,
    );
    expect(getUnresolvedWarnings(current, nextReview)).not.toContainEqual(
      expect.objectContaining({ category: "evidence_mismatch" }),
    );
    expect(
      current.evidence.find(
        (evidence) => evidence.target.field === "profile.name",
      )?.support,
    ).toBe("unsupported");
  });

  it("records edits, resets approval, resolves targeted warnings, and clears confirmation", () => {
    const current = draft(
      providerOutputFixtures.evidence_mismatch_provider_output,
    );
    const review = {
      ...approveResumeSection(createInitialResumeReviewState(), "profile"),
      confirmedAt: "2026-07-27T12:00:00.000Z",
    };
    const nextData = structuredClone(current.draft);
    nextData.profile.name = "Alex R. Rivera";
    const target: DraftFieldReferenceV1 = {
      section: "profile",
      field: "profile.name",
      entryId: null,
      itemId: null,
    };

    const result = commitResumeDraftChange(current, review, nextData, {
      section: "profile",
      changedFields: [target],
    });

    expect(result.review.sections.profile).toBe(false);
    expect(result.review.confirmedAt).toBeNull();
    expect(result.draft.evidence.at(-1)).toMatchObject({
      target,
      support: "user_edited",
      transformation: "user_change",
    });
    expect(
      getUnresolvedWarnings(result.draft, result.review),
    ).not.toContainEqual(expect.objectContaining({ target }));
  });

  it("removes orphan evidence and warnings with deleted entries", () => {
    const current = draft();
    const review = createInitialResumeReviewState();
    const removed = current.draft.projects[0]!.id;
    const nextData = structuredClone(current.draft);
    nextData.projects = [];

    const result = commitResumeDraftChange(current, review, nextData, {
      section: "projects",
      changedFields: [],
      removedEntryIds: [removed],
    });

    expect(
      result.draft.evidence.some(
        (evidence) => evidence.target.entryId === removed,
      ),
    ).toBe(false);
    expect(
      result.draft.warnings.some(
        (warning) => warning.target?.entryId === removed,
      ),
    ).toBe(false);
    expect(validateResumeDraftReferences(result.draft)).toBe(true);
  });

  it("derives structural confirmation issues after user changes", () => {
    const current = draft();
    current.draft.profile.name = null;
    current.draft.projects[0]!.startDate = {
      precision: "year",
      year: 2028,
      month: null,
      sourceText: "2028",
    };
    current.draft.projects[0]!.endDate = {
      precision: "year",
      year: 2027,
      month: null,
      sourceText: "2027",
    };

    expect(getResumeDraftBlockingIssues(current)).toEqual([
      {
        section: "profile",
        message: "Add a name before confirming this draft.",
      },
      {
        section: "projects",
        message: "A project end date cannot be before its start date.",
      },
    ]);
  });
});

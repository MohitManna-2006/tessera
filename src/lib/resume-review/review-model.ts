import {
  RESUME_REVIEW_SECTIONS,
  ResumeDraftV1Schema,
  ResumeReviewStateV1Schema,
  type DraftFieldReferenceV1,
  type ResumeDraftV1,
  type ResumeEvidenceV1,
  type ResumeReviewSection,
  type ResumeReviewStateV1,
  type ResumeWarningV1,
} from "@/lib/resume-draft/contracts";

export const RESUME_SECTION_LABELS: Record<ResumeReviewSection, string> = {
  profile: "Profile",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  education: "Education",
};

export type ResumeDraftChange = Readonly<{
  section: ResumeReviewSection;
  changedFields: readonly DraftFieldReferenceV1[];
  enteredFields?: readonly DraftFieldReferenceV1[];
  removedEntryIds?: readonly string[];
  provenance?: "user_entered" | "user_edited";
}>;

function newClientId(prefix: "evidence"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function referencesEqual(
  left: DraftFieldReferenceV1,
  right: DraftFieldReferenceV1,
): boolean {
  return (
    left.section === right.section &&
    left.field === right.field &&
    left.entryId === right.entryId &&
    left.itemId === right.itemId
  );
}

function targetUsesRemovedEntry(
  target: DraftFieldReferenceV1 | null,
  removedIds: ReadonlySet<string>,
): boolean {
  return (
    target !== null &&
    ((target.entryId !== null && removedIds.has(target.entryId)) ||
      (target.itemId !== null && removedIds.has(target.itemId)))
  );
}

export function getUnresolvedWarnings(
  draft: ResumeDraftV1,
  review: ResumeReviewStateV1,
): ResumeWarningV1[] {
  const resolved = new Set([
    ...review.resolvedWarningIds,
    ...review.acknowledgedWarningIds,
  ]);
  return draft.warnings.filter(
    (warning) => warning.severity !== "info" && !resolved.has(warning.id),
  );
}

export function getSectionWarnings(
  draft: ResumeDraftV1,
  review: ResumeReviewStateV1,
  section: ResumeReviewSection,
): ResumeWarningV1[] {
  return getUnresolvedWarnings(draft, review).filter(
    (warning) => warning.section === section,
  );
}

export function getReviewedSectionCount(review: ResumeReviewStateV1): number {
  return RESUME_REVIEW_SECTIONS.filter((section) => review.sections[section])
    .length;
}

export function findEvidenceForTarget(
  draft: ResumeDraftV1,
  target: DraftFieldReferenceV1,
): ResumeEvidenceV1 | null {
  return (
    [...draft.evidence]
      .reverse()
      .find((evidence) => referencesEqual(evidence.target, target)) ?? null
  );
}

export function approveResumeSection(
  review: ResumeReviewStateV1,
  section: ResumeReviewSection,
): ResumeReviewStateV1 {
  return ResumeReviewStateV1Schema.parse({
    ...review,
    sections: { ...review.sections, [section]: true },
  });
}

export function resolveWarningsForTarget(
  draft: ResumeDraftV1,
  review: ResumeReviewStateV1,
  target: DraftFieldReferenceV1,
): ResumeReviewStateV1 {
  const matchingIds = draft.warnings
    .filter(
      (warning) =>
        warning.target !== null && referencesEqual(warning.target, target),
    )
    .map((warning) => warning.id);
  return ResumeReviewStateV1Schema.parse({
    ...review,
    resolvedWarningIds: [
      ...new Set([...review.resolvedWarningIds, ...matchingIds]),
    ],
    confirmedAt: null,
  });
}

export function commitResumeDraftChange(
  draft: ResumeDraftV1,
  review: ResumeReviewStateV1,
  nextData: ResumeDraftV1["draft"],
  change: ResumeDraftChange,
): { draft: ResumeDraftV1; review: ResumeReviewStateV1 } {
  const removedIds = new Set(change.removedEntryIds ?? []);
  const remainingWarnings = draft.warnings.filter(
    (warning) => !targetUsesRemovedEntry(warning.target, removedIds),
  );
  const remainingEvidence = draft.evidence.filter(
    (evidence) => !targetUsesRemovedEntry(evidence.target, removedIds),
  );
  const changedWarningIds = remainingWarnings
    .filter(
      (warning) =>
        warning.target !== null &&
        change.changedFields.some((target) =>
          referencesEqual(warning.target!, target),
        ),
    )
    .map((warning) => warning.id);
  const userEvidence: ResumeEvidenceV1[] = change.changedFields.map(
    (target) => ({
      id: newClientId("evidence"),
      target,
      sourceExcerpt: null,
      support: change.enteredFields?.some((field) =>
        referencesEqual(field, target),
      )
        ? "user_entered"
        : (change.provenance ?? "user_edited"),
      transformation: "user_change",
      matched: false,
    }),
  );
  const warningIds = new Set(remainingWarnings.map((warning) => warning.id));
  const nextReview = ResumeReviewStateV1Schema.parse({
    ...review,
    sections: { ...review.sections, [change.section]: false },
    resolvedWarningIds: [
      ...new Set([...review.resolvedWarningIds, ...changedWarningIds]),
    ].filter((id) => warningIds.has(id)),
    acknowledgedWarningIds: review.acknowledgedWarningIds.filter((id) =>
      warningIds.has(id),
    ),
    confirmedAt: null,
  });
  const nextDraft = ResumeDraftV1Schema.parse({
    ...draft,
    draft: nextData,
    evidence: [...remainingEvidence, ...userEvidence],
    warnings: remainingWarnings,
  });
  return { draft: nextDraft, review: nextReview };
}

export type ResumeDraftBlockingIssue = Readonly<{
  section: ResumeReviewSection;
  message: string;
}>;

function partialDateOrder(
  start: { year: number; month: number | null } | null,
  end: { year: number; month: number | null } | null,
): number | null {
  if (start === null || end === null) return null;
  if (start.year !== end.year) return start.year - end.year;
  if (start.month === null || end.month === null) return null;
  return start.month - end.month;
}

export function getResumeDraftBlockingIssues(
  draft: ResumeDraftV1,
): ResumeDraftBlockingIssue[] {
  const issues: ResumeDraftBlockingIssue[] = [];
  if (draft.draft.profile.name === null) {
    issues.push({
      section: "profile",
      message: "Add a name before confirming this draft.",
    });
  }
  for (const entry of draft.draft.experience) {
    if (entry.company === null || entry.role === null) {
      issues.push({
        section: "experience",
        message: "Each experience needs an employer and role.",
      });
    }
    if (entry.current && entry.endDate !== null) {
      issues.push({
        section: "experience",
        message: "A current role cannot also have an end date.",
      });
    }
    if ((partialDateOrder(entry.startDate, entry.endDate) ?? 0) > 0) {
      issues.push({
        section: "experience",
        message: "An experience end date cannot be before its start date.",
      });
    }
  }
  for (const entry of draft.draft.projects) {
    if (entry.name === null) {
      issues.push({
        section: "projects",
        message: "Each project needs a name.",
      });
    }
    if ((partialDateOrder(entry.startDate, entry.endDate) ?? 0) > 0) {
      issues.push({
        section: "projects",
        message: "A project end date cannot be before its start date.",
      });
    }
  }
  for (const entry of draft.draft.education) {
    if (entry.institution === null) {
      issues.push({
        section: "education",
        message: "Each education entry needs an institution.",
      });
    }
    if ((partialDateOrder(entry.startDate, entry.endDate) ?? 0) > 0) {
      issues.push({
        section: "education",
        message: "An education end date cannot be before its start date.",
      });
    }
  }
  return issues;
}

export function validateResumeDraftReferences(draft: ResumeDraftV1): boolean {
  const ids = {
    links: new Set(draft.draft.profile.links.map((link) => link.id)),
    experience: new Set(draft.draft.experience.map((entry) => entry.id)),
    achievements: new Set(
      draft.draft.experience.flatMap((entry) =>
        entry.achievements.map((item) => item.id),
      ),
    ),
    projects: new Set(draft.draft.projects.map((entry) => entry.id)),
    technologies: new Set(
      draft.draft.projects.flatMap((entry) =>
        entry.technologies.map((item) => item.id),
      ),
    ),
    skills: new Set(draft.draft.skills.map((entry) => entry.id)),
    education: new Set(draft.draft.education.map((entry) => entry.id)),
    honors: new Set(
      draft.draft.education.flatMap((entry) =>
        entry.honors.map((item) => item.id),
      ),
    ),
  };

  const validTarget = (target: DraftFieldReferenceV1): boolean => {
    if (target.field.startsWith("profile.links.")) {
      return target.entryId !== null && ids.links.has(target.entryId);
    }
    if (target.field.startsWith("profile.")) {
      return target.entryId === null && target.itemId === null;
    }
    if (target.field.startsWith("experience.")) {
      return (
        target.entryId !== null &&
        ids.experience.has(target.entryId) &&
        (target.field === "experience.achievements.text"
          ? target.itemId !== null && ids.achievements.has(target.itemId)
          : target.itemId === null)
      );
    }
    if (target.field.startsWith("projects.")) {
      return (
        target.entryId !== null &&
        ids.projects.has(target.entryId) &&
        (target.field === "projects.technologies.name"
          ? target.itemId !== null && ids.technologies.has(target.itemId)
          : target.itemId === null)
      );
    }
    if (target.field.startsWith("skills.")) {
      return (
        target.entryId !== null &&
        ids.skills.has(target.entryId) &&
        target.itemId === null
      );
    }
    return (
      target.entryId !== null &&
      ids.education.has(target.entryId) &&
      (target.field === "education.honors.text"
        ? target.itemId !== null && ids.honors.has(target.itemId)
        : target.itemId === null)
    );
  };

  return (
    draft.evidence.every((evidence) => validTarget(evidence.target)) &&
    draft.warnings.every(
      (warning) => warning.target === null || validTarget(warning.target),
    )
  );
}

export function formatSectionSummary(draft: ResumeDraftV1): string {
  const count = (value: number, singular: string, plural = `${singular}s`) =>
    `${value} ${value === 1 ? singular : plural}`;
  return [
    count(draft.draft.experience.length, "experience"),
    count(draft.draft.projects.length, "project"),
    count(draft.draft.skills.length, "skill"),
    count(draft.draft.education.length, "education entry", "education entries"),
  ].join(", ");
}

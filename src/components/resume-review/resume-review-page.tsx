"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  RESUME_REVIEW_SECTIONS,
  ResumeDraftV1Schema,
  ResumeReviewStateV1Schema,
  type DraftFieldKey,
  type DraftFieldReferenceV1,
  type ResumeDraftV1,
  type ResumeReviewSection,
} from "@/lib/resume-draft/contracts";
import {
  approveResumeSection,
  commitResumeDraftChange,
  findEvidenceForTarget,
  formatSectionSummary,
  getResumeDraftBlockingIssues,
  getReviewedSectionCount,
  getSectionWarnings,
  getUnresolvedWarnings,
  RESUME_SECTION_LABELS,
  resolveWarningsForTarget,
  validateResumeDraftReferences,
  type ResumeDraftChange,
} from "@/lib/resume-review/review-model";
import {
  readResumeTransferState,
  writeResumeTransferState,
  type ResumeTransferEnvelopeV1,
} from "@/lib/resume-review/transfer-store";

import { ConfirmationDialog } from "./confirmation-dialog";
import { EvidenceDialog } from "./evidence-dialog";
import { ResumeSectionEditor } from "./section-editor";
import { SourceTextDialog } from "./source-text-dialog";

type RecoveryState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; envelope: ResumeTransferEnvelopeV1 };

const EDIT_FIELD_LABELS: Record<DraftFieldKey, string> = {
  "profile.name": "Name",
  "profile.sourceTitle": "Resume title",
  "profile.location": "Broad location",
  "profile.email": "Private email",
  "profile.phone": "Private phone",
  "profile.links.label": "Link",
  "profile.links.url": "Link",
  "profile.links.kind": "Link",
  "experience.company": "Employer",
  "experience.role": "Role",
  "experience.location": "Broad location",
  "experience.employmentType": "Employment type",
  "experience.startDate": "Start date",
  "experience.endDate": "End date",
  "experience.current": "This is a current role",
  "experience.achievements.text": "Achievement",
  "projects.name": "Project name",
  "projects.description": "Description",
  "projects.role": "Your role",
  "projects.technologies.name": "Technology",
  "projects.startDate": "Start date",
  "projects.endDate": "End date",
  "projects.repositoryUrl": "Repository URL",
  "projects.liveUrl": "Live URL",
  "skills.name": "Skill",
  "skills.group": "Group",
  "education.institution": "Institution",
  "education.degree": "Degree",
  "education.field": "Field of study",
  "education.location": "Broad location",
  "education.startDate": "Start date",
  "education.endDate": "End or expected date",
  "education.expected": "This is an expected graduation date",
  "education.gpa": "Private GPA",
  "education.honors.text": "Honor",
};

function focusRequestedEditField(field: DraftFieldKey) {
  const form = document.querySelector<HTMLFormElement>(".review-edit-form");
  if (!form) return;
  const labelText = EDIT_FIELD_LABELS[field];
  const label = [...form.querySelectorAll("label")].find((candidate) =>
    candidate.textContent?.trim().startsWith(labelText),
  );
  const control =
    label?.querySelector<HTMLElement>("input, textarea, select, button") ??
    form.querySelector<HTMLElement>("input, textarea, select");
  control?.focus();
}

export function ResumeReviewPage() {
  const [recovery, setRecovery] = useState<RecoveryState>({
    status: "loading",
  });
  const [activeSection, setActiveSection] =
    useState<ResumeReviewSection>("profile");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [selectedTarget, setSelectedTarget] =
    useState<DraftFieldReferenceV1 | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [editRequest, setEditRequest] = useState<{
    entryId: string | null;
  } | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const sectionHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const envelope = readResumeTransferState(window.sessionStorage);
      setRecovery(
        envelope ? { status: "ready", envelope } : { status: "missing" },
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (recovery.status === "loading") {
    return (
      <main className="review-state-main" aria-busy="true">
        <div className="review-state-card">
          <p className="onboarding-eyebrow">Resume review</p>
          <h1>Opening your private draft…</h1>
          <p>Recovering the temporary draft from this browser tab.</p>
        </div>
      </main>
    );
  }

  if (recovery.status === "missing") {
    return (
      <main className="review-state-main">
        <div className="review-state-card">
          <p className="onboarding-eyebrow">Resume review</p>
          <h1>A resume draft isn’t available.</h1>
          <p>
            The temporary draft may have expired, been cleared, or been created
            in another browser tab. Return to your resume to create a new one.
          </p>
          <Link className="onboarding-primary-action" href="/resume">
            Return to resume
          </Link>
        </div>
      </main>
    );
  }

  const { envelope } = recovery;
  const { draft, review } = envelope;
  const unresolved = getUnresolvedWarnings(draft, review);
  const activeWarnings = getSectionWarnings(draft, review, activeSection);
  const infoWarnings = draft.warnings.filter(
    (warning) =>
      warning.section === activeSection && warning.severity === "info",
  );
  const reviewedCount = getReviewedSectionCount(review);
  const selectedEvidence = selectedTarget
    ? findEvidenceForTarget(draft, selectedTarget)
    : null;
  const warningSections = new Set(unresolved.map((warning) => warning.section));
  const visibleSections =
    needsReviewOnly && unresolved.length > 0
      ? RESUME_REVIEW_SECTIONS.filter(
          (section) =>
            warningSections.has(section) || section === activeSection,
        )
      : RESUME_REVIEW_SECTIONS;

  const updateEnvelope = (next: ResumeTransferEnvelopeV1) => {
    writeResumeTransferState(window.sessionStorage, next);
    setRecovery({ status: "ready", envelope: next });
  };

  const persistNow = (next = envelope) => {
    writeResumeTransferState(window.sessionStorage, next);
  };

  const changeDraft = (
    data: ResumeDraftV1["draft"],
    change: ResumeDraftChange,
  ) => {
    const next = commitResumeDraftChange(draft, review, data, change);
    updateEnvelope({ ...envelope, ...next });
    setPageMessage("Changes saved. This section needs your approval again.");
  };

  const switchSection = (section: ResumeReviewSection) => {
    setActiveSection(section);
    setSelectedTarget(null);
    setEditRequest(null);
    setPageMessage(null);
  };

  const approveSection = () => {
    if (activeWarnings.some((warning) => warning.severity === "blocking")) {
      setPageMessage(
        "Resolve the blocking issue in this section before marking it reviewed.",
      );
      return;
    }
    const nextReview = approveResumeSection(review, activeSection);
    updateEnvelope({ ...envelope, review: nextReview });
    setPageMessage(`${RESUME_SECTION_LABELS[activeSection]} marked reviewed.`);
  };

  const confirmEvidence = (target: DraftFieldReferenceV1) => {
    const nextReview = resolveWarningsForTarget(draft, review, target);
    updateEnvelope({ ...envelope, review: nextReview });
    setPageMessage("Value confirmed. Its evidence record is unchanged.");
  };

  const editEvidenceValue = (target: DraftFieldReferenceV1) => {
    setSelectedTarget(null);
    setNeedsReviewOnly(false);
    setActiveSection(target.section);
    setEditRequest({ entryId: target.entryId });
    window.setTimeout(() => focusRequestedEditField(target.field), 0);
  };

  const finalizeConfirmation = (warningIds: readonly string[]) => {
    const nextReview = ResumeReviewStateV1Schema.parse({
      ...review,
      acknowledgedWarningIds: [
        ...new Set([...review.acknowledgedWarningIds, ...warningIds]),
      ],
      confirmedAt: new Date().toISOString(),
    });
    const nextEnvelope = { ...envelope, review: nextReview };
    updateEnvelope(nextEnvelope);
    persistNow(nextEnvelope);
    setConfirmationOpen(false);
    setPageMessage(
      "Private portfolio draft confirmed. It remains available in this tab for the current review session.",
    );
  };

  const confirmDraft = () => {
    const parsedDraft = ResumeDraftV1Schema.safeParse(draft);
    if (!parsedDraft.success || !validateResumeDraftReferences(draft)) {
      setPageMessage(
        "The draft has a structural issue. Return to the resume and create a fresh draft.",
      );
      return;
    }
    const structuralIssue = getResumeDraftBlockingIssues(draft)[0];
    if (structuralIssue) {
      setActiveSection(structuralIssue.section);
      setPageMessage(structuralIssue.message);
      window.setTimeout(() => sectionHeadingRef.current?.focus(), 0);
      return;
    }
    const blocking = unresolved.find(
      (warning) => warning.severity === "blocking",
    );
    if (blocking) {
      setActiveSection(blocking.section);
      setPageMessage(blocking.message);
      window.setTimeout(() => sectionHeadingRef.current?.focus(), 0);
      return;
    }
    const firstUnreviewed = RESUME_REVIEW_SECTIONS.find(
      (section) => !review.sections[section],
    );
    if (firstUnreviewed) {
      setActiveSection(firstUnreviewed);
      setPageMessage(
        `Review ${RESUME_SECTION_LABELS[firstUnreviewed]} and mark it “Looks right” before confirming.`,
      );
      window.setTimeout(() => sectionHeadingRef.current?.focus(), 0);
      return;
    }
    if (unresolved.length > 0) {
      setConfirmationOpen(true);
      return;
    }
    finalizeConfirmation([]);
  };

  const handleBack = () => {
    persistNow();
  };

  const activeHasNoFilteredWarnings =
    needsReviewOnly && activeWarnings.length === 0 && unresolved.length > 0;

  return (
    <div className="review-page-shell">
      <header className="review-workflow-header">
        <div className="resume-container review-header-inner">
          <Link className="onboarding-wordmark wordmark" href="/">
            Tessera
          </Link>
          <Link href="/resume" onClick={handleBack}>
            Back to resume
          </Link>
        </div>
      </header>

      <main className="review-main">
        <div className="resume-container">
          <nav className="review-breadcrumb" aria-label="Resume workflow">
            <Link href="/resume" onClick={handleBack}>
              Resume
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Review draft</span>
          </nav>

          <section className="review-intro" aria-labelledby="review-title">
            <p className="onboarding-eyebrow">Private guided review</p>
            <h1 id="review-title">Your portfolio draft is ready.</h1>
            <p>
              We found {formatSectionSummary(draft)}. Review each section before
              confirming this private draft.
            </p>
            <div className="review-progress-summary">
              <strong>{reviewedCount} of 5 sections reviewed</strong>
              <span>
                {unresolved.length === 0
                  ? "No details need review."
                  : `${unresolved.length} ${
                      unresolved.length === 1 ? "detail needs" : "details need"
                    } review.`}
              </span>
              <button
                className="resume-secondary-button"
                type="button"
                onClick={() => setSourceOpen(true)}
              >
                View full resume text
              </button>
            </div>
          </section>

          <div className="review-controls">
            <nav
              className="review-section-navigation"
              aria-label="Draft sections"
            >
              {visibleSections.map((section) => {
                const sectionWarningCount = getSectionWarnings(
                  draft,
                  review,
                  section,
                ).length;
                return (
                  <button
                    key={section}
                    type="button"
                    aria-current={
                      section === activeSection ? "page" : undefined
                    }
                    onClick={() => switchSection(section)}
                  >
                    <span>{RESUME_SECTION_LABELS[section]}</span>
                    {review.sections[section] ? (
                      <small>Reviewed</small>
                    ) : sectionWarningCount > 0 ? (
                      <small>{sectionWarningCount} to review</small>
                    ) : (
                      <small>Not reviewed</small>
                    )}
                  </button>
                );
              })}
            </nav>
            <button
              className="review-filter-button"
              type="button"
              aria-pressed={needsReviewOnly}
              onClick={() => {
                setNeedsReviewOnly((current) => !current);
                setPageMessage(null);
              }}
            >
              Needs review · {unresolved.length}
            </button>
          </div>

          {pageMessage ? (
            <p
              className={
                pageMessage.includes("structural") ||
                pageMessage.includes("blocking")
                  ? "review-page-message review-page-message-error"
                  : "review-page-message"
              }
              role="status"
            >
              {pageMessage}
            </p>
          ) : null}

          {needsReviewOnly && unresolved.length === 0 ? (
            <section className="review-all-clear">
              <h2>Everything is clear.</h2>
              <p>No unresolved details remain in this draft.</p>
              <button
                className="resume-secondary-button"
                type="button"
                onClick={() => setNeedsReviewOnly(false)}
              >
                Return to all sections
              </button>
            </section>
          ) : (
            <section
              className="review-active-section"
              aria-labelledby="active-section-title"
            >
              <div className="review-section-heading">
                <div>
                  <p className="review-section-kicker">
                    Section {RESUME_REVIEW_SECTIONS.indexOf(activeSection) + 1}{" "}
                    of 5
                  </p>
                  <h2
                    ref={sectionHeadingRef}
                    id="active-section-title"
                    tabIndex={-1}
                  >
                    {RESUME_SECTION_LABELS[activeSection]}
                  </h2>
                </div>
                <span>
                  {review.sections[activeSection] ? "Reviewed" : "Not reviewed"}
                </span>
              </div>

              {infoWarnings.length > 0 ? (
                <div className="review-info-list">
                  {infoWarnings.map((warning) => (
                    <p key={warning.id}>{warning.message}</p>
                  ))}
                </div>
              ) : null}

              {activeWarnings.length > 0 ? (
                <div className="review-warning-list">
                  {activeWarnings.map((warning) => (
                    <div key={warning.id}>
                      <div>
                        <strong>
                          {warning.severity === "blocking"
                            ? "Action required"
                            : "Needs review"}
                        </strong>
                        <p>{warning.message}</p>
                      </div>
                      {warning.target &&
                      findEvidenceForTarget(draft, warning.target) ? (
                        <button
                          type="button"
                          onClick={() => setSelectedTarget(warning.target)}
                        >
                          Review source
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {activeHasNoFilteredWarnings ? (
                <div className="review-section-clear">
                  <h3>This section is clear.</h3>
                  <p>
                    Choose another section with a marker, or return to all
                    sections.
                  </p>
                  <button
                    className="resume-secondary-button"
                    type="button"
                    onClick={() => setNeedsReviewOnly(false)}
                  >
                    Return to all sections
                  </button>
                </div>
              ) : (
                <ResumeSectionEditor
                  data={draft.draft}
                  section={activeSection}
                  warnings={activeWarnings}
                  needsReviewOnly={needsReviewOnly}
                  editRequest={editRequest}
                  onConsumeEditRequest={() => setEditRequest(null)}
                  onChange={changeDraft}
                  onViewSource={setSelectedTarget}
                  hasEvidence={(target) =>
                    findEvidenceForTarget(draft, target) !== null
                  }
                />
              )}

              <div className="review-section-approval">
                <button
                  className="resume-primary-button"
                  type="button"
                  disabled={review.sections[activeSection]}
                  onClick={approveSection}
                >
                  {review.sections[activeSection]
                    ? "Section reviewed"
                    : "Looks right"}
                </button>
                <p>
                  Mark this section reviewed only after checking the current
                  values.
                </p>
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="review-sticky-footer">
        <div className="resume-container review-footer-inner">
          <div>
            <strong>{reviewedCount} of 5 reviewed</strong>
            <span>
              {unresolved.length} unresolved{" "}
              {unresolved.length === 1 ? "detail" : "details"}
            </span>
          </div>
          <div>
            <Link
              className="resume-secondary-button review-footer-link"
              href="/resume"
              onClick={handleBack}
            >
              Back to resume
            </Link>
            <button
              className="resume-primary-button"
              type="button"
              disabled={review.confirmedAt !== null}
              onClick={confirmDraft}
            >
              {review.confirmedAt
                ? "Draft confirmed"
                : "Confirm portfolio draft"}
            </button>
            {review.confirmedAt ? (
              <Link
                className="resume-primary-button review-footer-link"
                href="/builder?source=resume"
              >
                Continue to builder
              </Link>
            ) : null}
          </div>
        </div>
      </footer>

      <EvidenceDialog
        evidence={selectedEvidence}
        target={selectedTarget}
        onClose={() => setSelectedTarget(null)}
        onConfirm={confirmEvidence}
        onEdit={editEvidenceValue}
      />
      <SourceTextDialog
        text={envelope.extractedText}
        open={sourceOpen}
        onClose={() => setSourceOpen(false)}
      />
      <ConfirmationDialog
        warningCount={unresolved.length}
        open={confirmationOpen}
        onContinue={() =>
          finalizeConfirmation(unresolved.map((warning) => warning.id))
        }
        onKeepReviewing={() => setConfirmationOpen(false)}
      />
    </div>
  );
}

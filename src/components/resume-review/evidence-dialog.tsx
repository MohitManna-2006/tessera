"use client";

import { useEffect, useRef, type SyntheticEvent } from "react";

import type {
  DraftFieldKey,
  DraftFieldReferenceV1,
  ResumeEvidenceV1,
} from "@/lib/resume-draft/contracts";

const FIELD_LABELS: Record<DraftFieldKey, string> = {
  "profile.name": "Name",
  "profile.sourceTitle": "Resume title",
  "profile.location": "Broad location",
  "profile.email": "Private email",
  "profile.phone": "Private phone",
  "profile.links.label": "Link label",
  "profile.links.url": "Link URL",
  "profile.links.kind": "Link type",
  "experience.company": "Employer",
  "experience.role": "Role",
  "experience.location": "Experience location",
  "experience.employmentType": "Employment type",
  "experience.startDate": "Experience start date",
  "experience.endDate": "Experience end date",
  "experience.current": "Current role",
  "experience.achievements.text": "Achievement",
  "projects.name": "Project name",
  "projects.description": "Project description",
  "projects.role": "Project role",
  "projects.technologies.name": "Project technology",
  "projects.startDate": "Project start date",
  "projects.endDate": "Project end date",
  "projects.repositoryUrl": "Repository URL",
  "projects.liveUrl": "Live URL",
  "skills.name": "Skill",
  "skills.group": "Skill group",
  "education.institution": "Institution",
  "education.degree": "Degree",
  "education.field": "Field of study",
  "education.location": "Education location",
  "education.startDate": "Education start date",
  "education.endDate": "Education end date",
  "education.expected": "Expected graduation",
  "education.gpa": "Private GPA",
  "education.honors.text": "Honor",
};

const SUPPORT_LABELS: Record<ResumeEvidenceV1["support"], string> = {
  direct: "Found directly",
  reformatted: "Reformatted",
  ambiguous: "Needs confirmation",
  unsupported: "Needs confirmation",
  user_entered: "Added by you",
  user_edited: "Edited by you",
};

export function EvidenceDialog({
  evidence,
  target,
  onClose,
  onConfirm,
  onEdit,
}: {
  evidence: ResumeEvidenceV1 | null;
  target: DraftFieldReferenceV1 | null;
  onClose: () => void;
  onConfirm: (target: DraftFieldReferenceV1) => void;
  onEdit: (target: DraftFieldReferenceV1) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const restoreTriggerFocusRef = useRef(true);
  const isOpen = target !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      restoreTriggerFocusRef.current = true;
      triggerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
      closeButtonRef.current?.focus();
    } else if (!isOpen && dialog.open) {
      dialog.close();
      if (restoreTriggerFocusRef.current) {
        triggerRef.current?.focus();
      }
      triggerRef.current = null;
    }
  }, [isOpen]);

  const close = () => onClose();
  const cancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    close();
  };

  return (
    <dialog
      ref={dialogRef}
      className="review-context-dialog"
      aria-labelledby="evidence-dialog-title"
      aria-describedby="evidence-dialog-description"
      aria-modal="true"
      onCancel={cancel}
    >
      <div className="review-dialog-header">
        <div>
          <p className="onboarding-eyebrow">Resume evidence</p>
          <h2 id="evidence-dialog-title">
            {target ? FIELD_LABELS[target.field] : "Source evidence"}
          </h2>
        </div>
        <button
          ref={closeButtonRef}
          className="resume-secondary-button"
          type="button"
          onClick={close}
        >
          Close
        </button>
      </div>
      <p id="evidence-dialog-description" className="review-dialog-description">
        This is the source Tessera used for this value.
      </p>

      {evidence?.sourceExcerpt ? (
        <blockquote className="review-source-excerpt">
          {evidence.sourceExcerpt}
        </blockquote>
      ) : (
        <p className="review-source-missing">
          Tessera could not verify this value in the extracted resume text.
        </p>
      )}
      {evidence ? (
        <p className="review-support-label">
          Evidence status: <strong>{SUPPORT_LABELS[evidence.support]}</strong>
        </p>
      ) : null}
      {evidence?.support === "reformatted" ? (
        <p className="review-dialog-description">
          The source was organized with safe formatting while preserving its
          meaning and precision.
        </p>
      ) : null}
      {evidence?.support === "ambiguous" ||
      evidence?.support === "unsupported" ||
      evidence?.matched === false ? (
        <p className="review-dialog-description">
          Confirm the current value or edit it before final review.
        </p>
      ) : null}

      {target ? (
        <div className="review-dialog-actions">
          <button
            className="resume-primary-button"
            type="button"
            onClick={() => onConfirm(target)}
          >
            Confirm this value
          </button>
          <button
            className="resume-secondary-button"
            type="button"
            onClick={() => {
              restoreTriggerFocusRef.current = false;
              onEdit(target);
            }}
          >
            Edit value
          </button>
        </div>
      ) : null}
    </dialog>
  );
}

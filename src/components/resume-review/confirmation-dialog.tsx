"use client";

import { useEffect, useRef, type SyntheticEvent } from "react";

export function ConfirmationDialog({
  warningCount,
  open,
  onContinue,
  onKeepReviewing,
}: {
  warningCount: number;
  open: boolean;
  onContinue: () => void;
  onKeepReviewing: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const keepReviewingRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      triggerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
      keepReviewingRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      triggerRef.current?.focus();
      triggerRef.current = null;
    }
  }, [open]);

  const keepReviewing = () => onKeepReviewing();
  const cancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    keepReviewing();
  };
  const detailLabel = `${warningCount} ${
    warningCount === 1 ? "detail remains" : "details remain"
  }`;

  return (
    <dialog
      ref={dialogRef}
      className="export-dialog"
      aria-labelledby="confirmation-dialog-title"
      aria-describedby="confirmation-dialog-description"
      aria-modal="true"
      onCancel={cancel}
    >
      <div className="export-dialog-content">
        <div className="export-dialog-copy">
          <h2 id="confirmation-dialog-title">
            Confirm with details to revisit?
          </h2>
          <p id="confirmation-dialog-description">
            {detailLabel}. You can keep reviewing or acknowledge them and
            confirm the current private draft.
          </p>
        </div>
        <div className="export-dialog-actions">
          <button
            className="resume-primary-button"
            type="button"
            onClick={onContinue}
          >
            Continue with current values
          </button>
          <button
            ref={keepReviewingRef}
            className="resume-secondary-button"
            type="button"
            onClick={keepReviewing}
          >
            Keep reviewing
          </button>
        </div>
      </div>
    </dialog>
  );
}

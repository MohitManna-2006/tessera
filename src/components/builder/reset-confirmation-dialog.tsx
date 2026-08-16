"use client";

import { useEffect, useRef, type SyntheticEvent } from "react";

type ResetConfirmationDialogProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ResetConfirmationDialog({
  open,
  onConfirm,
  onCancel,
}: ResetConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
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
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      triggerRef.current?.focus();
      triggerRef.current = null;
    }
  }, [open]);

  const handleCancel = (event?: SyntheticEvent<HTMLDialogElement>) => {
    event?.preventDefault();
    onCancel();
  };

  return (
    <dialog
      ref={dialogRef}
      className="export-dialog"
      aria-labelledby="reset-dialog-title"
      aria-describedby="reset-dialog-description"
      aria-modal="true"
      onCancel={handleCancel}
    >
      <div className="export-dialog-content">
        <div className="export-dialog-copy">
          <h2 id="reset-dialog-title">Reset draft to original?</h2>
          <p id="reset-dialog-description">
            Every field will be replaced with the original portfolio fixture.
            Your edits will be lost, but you can edit again afterwards.
          </p>
        </div>
        <div className="export-dialog-actions">
          <button
            className="resume-secondary-button"
            type="button"
            ref={cancelRef}
            onClick={onCancel}
          >
            Keep my edits
          </button>
          <button
            className="resume-primary-button"
            type="button"
            onClick={onConfirm}
          >
            Reset draft
          </button>
        </div>
      </div>
    </dialog>
  );
}

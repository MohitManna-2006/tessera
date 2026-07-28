"use client";

import { useEffect, useRef, type SyntheticEvent } from "react";

export function SourceTextDialog({
  text,
  open,
  onClose,
}: {
  text: string;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
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
      closeButtonRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      triggerRef.current?.focus();
      triggerRef.current = null;
    }
  }, [open]);

  const cancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="review-context-dialog review-source-dialog"
      aria-labelledby="source-text-title"
      aria-describedby="source-text-description"
      aria-modal="true"
      onCancel={cancel}
    >
      <div className="review-dialog-header">
        <div>
          <p className="onboarding-eyebrow">Original extraction</p>
          <h2 id="source-text-title">Full resume text</h2>
        </div>
        <button
          ref={closeButtonRef}
          className="resume-secondary-button"
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <p id="source-text-description" className="review-dialog-description">
        This plain text is exactly what Tessera processed. It may not preserve
        the PDF’s visual layout.
      </p>
      <pre className="review-full-source">{text}</pre>
    </dialog>
  );
}

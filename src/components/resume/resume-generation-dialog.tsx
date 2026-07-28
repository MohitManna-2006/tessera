"use client";

import { useEffect, useRef, type SyntheticEvent } from "react";

export type ResumeGenerationStatus =
  "idle" | "preparing" | "creating" | "validating" | "failed";

export type ResumeGenerationState = Readonly<{
  status: ResumeGenerationStatus;
  failedStage?: "preparing" | "creating" | "validating";
  errorMessage?: string;
  retryable?: boolean;
}>;

const STAGES = [
  { id: "preparing", label: "Preparing extracted text" },
  { id: "creating", label: "Creating structured draft" },
  { id: "validating", label: "Validating portfolio information" },
] as const;

function stageIndex(status: ResumeGenerationStatus): number {
  if (status === "preparing") return 0;
  if (status === "creating") return 1;
  if (status === "validating") return 2;
  return -1;
}

export function ResumeGenerationDialog({
  state,
  onClose,
  onRetry,
}: {
  state: ResumeGenerationState;
  onClose: () => void;
  onRetry: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const isOpen = state.status !== "idle";
  const isFailure = state.status === "failed";
  const currentIndex = stageIndex(
    state.status === "failed"
      ? (state.failedStage ?? "creating")
      : state.status,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      dialog.focus();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isFailure) {
      primaryActionRef.current?.focus();
    }
  }, [isFailure]);

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (isFailure) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="export-dialog resume-generation-dialog"
      aria-labelledby="resume-generation-title"
      aria-describedby="resume-generation-description"
      aria-modal="true"
      onCancel={handleCancel}
      tabIndex={-1}
    >
      <div className="export-dialog-content">
        <div
          className="resume-generation-mark"
          role="img"
          aria-label={
            isFailure
              ? "Draft creation stopped"
              : `Draft creation stage ${currentIndex + 1} of 3`
          }
        >
          {STAGES.map((stage, index) => (
            <span
              key={stage.id}
              aria-hidden="true"
              data-status={
                index < currentIndex
                  ? "complete"
                  : index === currentIndex
                    ? isFailure
                      ? "failed"
                      : "current"
                    : "upcoming"
              }
            />
          ))}
        </div>

        <div className="export-dialog-copy">
          <h2 id="resume-generation-title">
            {isFailure
              ? "Draft creation couldn’t finish"
              : "Creating your portfolio draft"}
          </h2>
          <p
            id="resume-generation-description"
            aria-live={isFailure ? undefined : "polite"}
            role={isFailure ? "alert" : undefined}
          >
            {isFailure
              ? state.errorMessage
              : (STAGES[currentIndex]?.label ?? STAGES[0].label)}
          </p>
        </div>

        <ol className="export-stage-list" aria-label="Draft creation stages">
          {STAGES.map((stage, index) => {
            const status =
              index < currentIndex
                ? "complete"
                : index === currentIndex
                  ? isFailure
                    ? "failed"
                    : "current"
                  : "upcoming";
            return (
              <li
                key={stage.id}
                data-status={status}
                aria-current={status === "current" ? "step" : undefined}
              >
                <span className="export-stage-index" aria-hidden="true">
                  {index + 1}
                </span>
                <span>{stage.label}</span>
                <span className="export-stage-status">
                  {status === "complete"
                    ? "Done"
                    : status === "current"
                      ? "Current"
                      : status === "failed"
                        ? "Stopped"
                        : ""}
                </span>
              </li>
            );
          })}
        </ol>

        {isFailure ? (
          <div className="export-dialog-actions">
            {state.retryable ? (
              <button
                ref={primaryActionRef}
                className="export-primary-button"
                type="button"
                onClick={onRetry}
              >
                Try again
              </button>
            ) : null}
            <button
              ref={state.retryable ? undefined : primaryActionRef}
              className="export-secondary-button"
              type="button"
              onClick={onClose}
            >
              Return to resume
            </button>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}

"use client";

import { useEffect, useRef, type SyntheticEvent } from "react";

import { EXPORT_STAGE_ORDER, type ExportStage } from "@/lib/export/protocol";

import {
  getCurrentExportStage,
  isExportRunning,
  type ExportState,
} from "./export-state";
import { TesseraProgressMark } from "./tessera-progress-mark";

const STAGE_LABELS: Record<ExportStage, string> = {
  preparing: "Preparing",
  generating: "Generating",
  verifying: "Verifying",
  packaging: "Packaging",
  "download-started": "Download started",
};

const STAGE_MESSAGES: Record<ExportStage, string> = {
  preparing: "Preparing your portfolio.",
  generating: "Generating project files.",
  verifying: "Verifying the project.",
  packaging: "Packaging the archive.",
  "download-started": "The ZIP download has started.",
};

type ExportProgressDialogProps = {
  state: ExportState;
  onClose: () => void;
  onRetry: () => void;
};

export function ExportProgressDialog({
  state,
  onClose,
  onRetry,
}: ExportProgressDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const isOpen = state.status !== "idle";
  const isRunning = isExportRunning(state.status);
  const isSuccess = state.status === "download-started";
  const isFailure = state.status === "failed";
  const currentStage = getCurrentExportStage(state);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (isOpen && !dialog.open) {
      dialog.showModal();
      dialog.focus();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isSuccess || isFailure) {
      primaryActionRef.current?.focus();
    }
  }, [isFailure, isSuccess]);

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (!isRunning) {
      onClose();
    }
  };

  const title = isSuccess
    ? "Your portfolio is ready"
    : isFailure
      ? "Export couldn't finish"
      : "Preparing your portfolio";
  const description = isFailure
    ? state.failureMessage
    : currentStage
      ? STAGE_MESSAGES[currentStage]
      : STAGE_MESSAGES.preparing;

  return (
    <dialog
      ref={dialogRef}
      className="export-dialog"
      aria-labelledby="export-dialog-title"
      aria-describedby="export-dialog-description"
      aria-modal="true"
      onCancel={handleCancel}
      tabIndex={-1}
    >
      <div className="export-dialog-content">
        <TesseraProgressMark
          completedStages={state.completedStages}
          currentStage={currentStage}
          failed={isFailure}
        />

        <div className="export-dialog-copy">
          <h2 id="export-dialog-title">{title}</h2>
          <p
            id="export-dialog-description"
            aria-live={isFailure ? undefined : "polite"}
            role={isFailure ? "alert" : undefined}
          >
            {description}
          </p>
        </div>

        <ol className="export-stage-list" aria-label="Export stages">
          {EXPORT_STAGE_ORDER.map((stage, index) => {
            const isComplete = state.completedStages.includes(stage);
            const isCurrent = currentStage === stage && !isComplete;
            return (
              <li
                data-status={
                  isComplete
                    ? "complete"
                    : isCurrent
                      ? isFailure
                        ? "failed"
                        : "current"
                      : "upcoming"
                }
                aria-current={isCurrent && !isFailure ? "step" : undefined}
                key={stage}
              >
                <span className="export-stage-index" aria-hidden="true">
                  {index + 1}
                </span>
                <span>{STAGE_LABELS[stage]}</span>
                <span className="export-stage-status">
                  {isComplete
                    ? "Done"
                    : isCurrent
                      ? isFailure
                        ? "Stopped"
                        : "Current"
                      : ""}
                </span>
              </li>
            );
          })}
        </ol>

        {isSuccess ? (
          <div className="export-dialog-actions">
            <button
              ref={primaryActionRef}
              className="export-primary-button"
              type="button"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        ) : null}

        {isFailure ? (
          <div className="export-dialog-actions">
            <button
              ref={primaryActionRef}
              className="export-primary-button"
              type="button"
              onClick={onRetry}
            >
              Try again
            </button>
            <button
              className="export-secondary-button"
              type="button"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}

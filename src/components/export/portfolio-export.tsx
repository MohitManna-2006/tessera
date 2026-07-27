"use client";

import { useEffect, useRef } from "react";

import type { Portfolio } from "@/lib/portfolio";
import type { PortfolioValidationIssue } from "@/lib/portfolio-validation";

import { ExportProgressDialog } from "./export-progress-dialog";
import { usePortfolioExport } from "./use-portfolio-export";

type PortfolioExportProps = {
  portfolio: Portfolio;
  onInvalid: (issue: PortfolioValidationIssue) => void;
};

export function PortfolioExport({
  portfolio,
  onInvalid,
}: PortfolioExportProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreFocusRef = useRef(false);
  const { state, isRunning, start, close } = usePortfolioExport({
    onInvalid,
  });

  useEffect(() => {
    if (state.status === "idle" && shouldRestoreFocusRef.current) {
      shouldRestoreFocusRef.current = false;
      triggerRef.current?.focus();
    }
  }, [state.status]);

  const handleClose = () => {
    shouldRestoreFocusRef.current = true;
    close();
  };

  return (
    <>
      <button
        ref={triggerRef}
        className="download-code-button"
        type="button"
        disabled={isRunning}
        onClick={() => void start(portfolio)}
      >
        Download code
      </button>
      <ExportProgressDialog
        state={state}
        onClose={handleClose}
        onRetry={() => void start(portfolio)}
      />
    </>
  );
}

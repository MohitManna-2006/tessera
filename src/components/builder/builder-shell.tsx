/* eslint-disable react-hooks/set-state-in-effect -- one-time hydration notice after reading sessionStorage is intentional */
"use client";

import Link from "next/link";
import { useEffect, useState, type KeyboardEvent } from "react";

import {
  createPortfolioDraft,
  PORTFOLIO_SECTION_ORDER,
  type Portfolio,
  type PortfolioSectionId,
} from "@/lib/portfolio";
import type { PortfolioValidationIssue } from "@/lib/portfolio-validation";
import {
  clearBuilderDraft,
  isDirty,
  readBuilderDraft,
  writeBuilderDraft,
} from "@/lib/builder/persistence";
import { readResumeTransferState } from "@/lib/resume-review/transfer-store";
import { mapResumeDraftToPortfolio } from "@/lib/resume-review/mapper";

import { PortfolioExport } from "../export/portfolio-export";
import { PortfolioEditor } from "./portfolio-editor";
import { PortfolioPreview } from "./portfolio-preview";
import { ResetConfirmationDialog } from "./reset-confirmation-dialog";

type BuilderView = "edit" | "preview";

function useCompactLayout() {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const query = window.matchMedia("(max-width: 1024px)");
    const update = () => setIsCompact(query.matches);
    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  return isCompact;
}

export function BuilderShell() {
  const [draft, setDraft] = useState<Portfolio>(() => {
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("source") === "resume") {
          const envelope = readResumeTransferState(window.sessionStorage);
          if (envelope) {
            return mapResumeDraftToPortfolio(envelope.draft);
          }
        }
        const stored = readBuilderDraft(window.sessionStorage);
        if (stored) return stored;
      } catch {
        // fallback to fixture
      }
    }
    return createPortfolioDraft();
  });
  const [openSections, setOpenSections] = useState<
    ReadonlySet<PortfolioSectionId>
  >(() => new Set([PORTFOLIO_SECTION_ORDER[0]]));
  const [activeView, setActiveView] = useState<BuilderView>("edit");
  const [exportValidationMessage, setExportValidationMessage] = useState("");
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [hydrateNotice, setHydrateNotice] = useState<string | null>(null);
  const isCompact = useCompactLayout();

  // Handle resume draft hydration via ?source=resume
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") !== "resume") return;
    try {
      const envelope = readResumeTransferState(window.sessionStorage);
      if (envelope) {
        setHydrateNotice(
          `Builder hydrated from resume "${envelope.draft.source.filename}" — review and edit before exporting.`,
        );
        // Clean the query so refresh keeps builder edits, not re-hydrates
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete("source");
        window.history.replaceState(null, "", nextUrl.toString());
      } else {
        setHydrateNotice(
          "No resume draft found in this tab. Upload a resume to hydrate the builder.",
        );
      }
    } catch {
      setHydrateNotice("Could not read the resume draft for this tab.");
    }
  }, []);

  // Persist draft to sessionStorage on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      writeBuilderDraft(window.sessionStorage, draft);
    } catch {
      // best-effort persistence
    }
  }, [draft]);

  // Warn on unsaved changes when navigating away / refreshing
  useEffect(() => {
    const fixture = createPortfolioDraft();
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty(draft, fixture)) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [draft]);

  const handleSectionToggle = (section: PortfolioSectionId) => {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleReset = () => {
    setIsResetDialogOpen(true);
  };

  const confirmReset = () => {
    const next = createPortfolioDraft();
    setDraft(next);
    if (typeof window !== "undefined") {
      try {
        clearBuilderDraft(window.sessionStorage);
        writeBuilderDraft(window.sessionStorage, next);
      } catch {
        // best-effort
      }
    }
    setExportValidationMessage("");
    setActiveView("edit");
    setIsResetDialogOpen(false);
  };

  const cancelReset = () => {
    setIsResetDialogOpen(false);
  };

  const handleDraftChange = (portfolio: Portfolio) => {
    setExportValidationMessage("");
    setDraft(portfolio);
  };

  const handleInvalidExport = (issue: PortfolioValidationIssue) => {
    setExportValidationMessage(issue.message);

    queueMicrotask(() => {
      const field = issue.fieldId
        ? document.getElementById(issue.fieldId)
        : null;
      if (field && !field.closest("[hidden]")) {
        field.focus();
        return;
      }
      if (issue.section) {
        document.getElementById(`${issue.section}-button`)?.focus();
      }
    });
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentView: BuilderView,
  ) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const nextView =
      event.key === "Home"
        ? "edit"
        : event.key === "End"
          ? "preview"
          : currentView === "edit"
            ? "preview"
            : "edit";
    setActiveView(nextView);
    document.getElementById(`${nextView}-tab`)?.focus();
  };

  return (
    <div className="builder-shell" data-active-view={activeView}>
      <header className="builder-header">
        <div className="builder-brand">
          <Link className="builder-wordmark wordmark" href="/">
            Tessera
          </Link>
          <span className="builder-label">Portfolio builder</span>
        </div>
        <div className="builder-actions">
          <button className="reset-button" type="button" onClick={handleReset}>
            Reset draft
          </button>
          <PortfolioExport portfolio={draft} onInvalid={handleInvalidExport} />
        </div>
      </header>

      <div className="mobile-tabs" role="tablist" aria-label="Builder views">
        <button
          id="edit-tab"
          type="button"
          role="tab"
          aria-selected={activeView === "edit"}
          aria-controls="edit-panel"
          tabIndex={activeView === "edit" ? 0 : -1}
          onClick={() => setActiveView("edit")}
          onKeyDown={(event) => handleTabKeyDown(event, "edit")}
        >
          Edit
        </button>
        <button
          id="preview-tab"
          type="button"
          role="tab"
          aria-selected={activeView === "preview"}
          aria-controls="preview-panel"
          tabIndex={activeView === "preview" ? 0 : -1}
          onClick={() => setActiveView("preview")}
          onKeyDown={(event) => handleTabKeyDown(event, "preview")}
        >
          Preview
        </button>
      </div>

      {hydrateNotice ? (
        <div
          className="builder-hydrate-notice"
          role="status"
          aria-live="polite"
        >
          {hydrateNotice}
        </div>
      ) : null}
      <main className="builder-workspace">
        <section
          id="edit-panel"
          className="editor-pane"
          role={isCompact ? "tabpanel" : undefined}
          aria-labelledby={isCompact ? "edit-tab" : undefined}
          hidden={isCompact && activeView !== "edit"}
        >
          <div className="editor-heading">
            <p className="editor-kicker">Draft</p>
            <h1>Edit portfolio</h1>
            <p>Update the content shown in your preview.</p>
            {exportValidationMessage ? (
              <p className="export-validation-message" role="alert">
                {exportValidationMessage}
              </p>
            ) : null}
          </div>
          <PortfolioEditor
            portfolio={draft}
            openSections={openSections}
            onToggleSection={handleSectionToggle}
            onChange={handleDraftChange}
          />
        </section>

        <section
          id="preview-panel"
          className="preview-pane"
          role={isCompact ? "tabpanel" : undefined}
          aria-labelledby={isCompact ? "preview-tab" : undefined}
          hidden={isCompact && activeView !== "preview"}
        >
          <PortfolioPreview portfolio={draft} isPrimaryHeading={isCompact} />
        </section>
      </main>
      <ResetConfirmationDialog
        open={isResetDialogOpen}
        onConfirm={confirmReset}
        onCancel={cancelReset}
      />
    </div>
  );
}

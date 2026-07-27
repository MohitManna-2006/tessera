"use client";

import { useEffect, useState, type KeyboardEvent } from "react";

import {
  createPortfolioDraft,
  PORTFOLIO_SECTION_ORDER,
  type Portfolio,
  type PortfolioSectionId,
} from "@/lib/portfolio";
import type { PortfolioValidationIssue } from "@/lib/portfolio-validation";

import { PortfolioExport } from "../export/portfolio-export";
import { PortfolioEditor } from "./portfolio-editor";
import { PortfolioPreview } from "./portfolio-preview";

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
  const [draft, setDraft] = useState<Portfolio>(() => createPortfolioDraft());
  const [openSections, setOpenSections] = useState<
    ReadonlySet<PortfolioSectionId>
  >(() => new Set([PORTFOLIO_SECTION_ORDER[0]]));
  const [activeView, setActiveView] = useState<BuilderView>("edit");
  const [exportValidationMessage, setExportValidationMessage] = useState("");
  const isCompact = useCompactLayout();

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
    if (
      !window.confirm(
        "Reset every field to the original portfolio fixture? Your edits will be replaced.",
      )
    ) {
      return;
    }

    setDraft(createPortfolioDraft());
    setExportValidationMessage("");
    setActiveView("edit");
  };

  const handleDraftChange = (portfolio: Portfolio) => {
    setExportValidationMessage("");
    setDraft(portfolio);
  };

  const handleInvalidExport = (issue: PortfolioValidationIssue) => {
    setExportValidationMessage(
      "Correct the highlighted email or URL fields before downloading.",
    );

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
          <span className="wordmark">Tessera</span>
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
    </div>
  );
}

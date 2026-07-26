"use client";

import type { ReactNode } from "react";

type EditorSectionProps = {
  id: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function EditorSection({
  id,
  title,
  isOpen,
  onToggle,
  children,
}: EditorSectionProps) {
  const panelId = `${id}-panel`;
  const buttonId = `${id}-button`;
  const titleId = `${id}-title`;

  return (
    <section className="editor-section" data-editor-section={id}>
      <h2>
        <button
          id={buttonId}
          className="section-trigger"
          type="button"
          aria-label={`${isOpen ? "Collapse" : "Expand"} ${title} section`}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span id={titleId}>{title}</span>
          <span className="section-chevron" aria-hidden="true">
            {isOpen ? "−" : "+"}
          </span>
        </button>
      </h2>
      <div
        id={panelId}
        className="section-content"
        role="region"
        aria-labelledby={titleId}
        hidden={!isOpen}
      >
        {children}
      </div>
    </section>
  );
}

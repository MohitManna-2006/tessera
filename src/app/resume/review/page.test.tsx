import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { normalizeProviderResumeDraft } from "@/lib/resume-draft/normalization";
import {
  createResumeTransferEnvelope,
  readResumeTransferState,
  writeResumeTransferState,
} from "@/lib/resume-review/transfer-store";
import {
  experiencedEngineerResumeText,
  providerOutputFixtures,
  validProviderResumeDraft,
} from "../../../../tests/fixtures/resume-ai/fixtures";
import ReviewPage from "./page";

function envelope(providerOutput: unknown = validProviderResumeDraft) {
  const draft = normalizeProviderResumeDraft({
    providerOutput,
    sourceText: experiencedEngineerResumeText,
    source: { filename: "synthetic-resume.pdf", pageCount: 1 },
    now: () => new Date("2026-07-27T12:00:00.000Z"),
  });
  return createResumeTransferEnvelope({
    extractedText: experiencedEngineerResumeText,
    draft,
    now: Date.now(),
  });
}

function sectionButton(name: string) {
  return screen.getByRole("button", {
    name: new RegExp(`^${name}`, "iu"),
  });
}

async function renderWithDraft(
  providerOutput: unknown = validProviderResumeDraft,
) {
  writeResumeTransferState(sessionStorage, envelope(providerOutput));
  render(<ReviewPage />);
  await screen.findByRole("heading", {
    level: 1,
    name: "Your portfolio draft is ready.",
  });
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("resume guided review", () => {
  it("recovers valid tab state without exposing a builder handoff", async () => {
    await renderWithDraft();

    expect(
      screen.getByText(/1 experience, 1 project, 3 skills, 1 education entry/i),
    ).toBeVisible();
    expect(screen.getByText("0 of 5 sections reviewed")).toBeVisible();
    expect(sectionButton("Profile")).toHaveAttribute("aria-current", "page");
    expect(
      screen.queryByRole("link", { name: /builder/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(sectionButton("Experience"));
    expect(
      screen.getByRole("heading", { level: 2, name: "Experience" }),
    ).toBeVisible();
    expect(sectionButton("Experience")).toHaveAttribute("aria-current", "page");
  });

  it("shows a calm recoverable state for direct, invalid, or expired entry", async () => {
    render(<ReviewPage />);

    expect(
      screen.getByRole("heading", { name: "Opening your private draft…" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("heading", {
        name: "A resume draft isn’t available.",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Return to resume" }),
    ).toHaveAttribute("href", "/resume");
    expect(screen.queryByText(/schema|sessionStorage|JSON/iu)).toBeNull();
  });

  it("edits with cancel and save semantics, then resets explicit approval", async () => {
    const user = userEvent.setup();
    await renderWithDraft();

    await user.click(screen.getByRole("button", { name: "Looks right" }));
    expect(screen.getByText("1 of 5 sections reviewed")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    const name = screen.getByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.type(name, "Changed Name");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("heading", { level: 3, name: "Alex Rivera" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    const nextName = screen.getByRole("textbox", { name: "Name" });
    await user.clear(nextName);
    await user.type(nextName, "Changed Name");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      screen.getByRole("heading", { level: 3, name: "Changed Name" }),
    ).toBeVisible();
    expect(screen.getByText("0 of 5 sections reviewed")).toBeVisible();
    await waitFor(() =>
      expect(
        readResumeTransferState(sessionStorage)?.draft.draft.profile.name,
      ).toBe("Changed Name"),
    );
    expect(
      readResumeTransferState(sessionStorage)?.draft.evidence.at(-1),
    ).toMatchObject({ support: "user_edited" });
  });

  it("filters warnings, shows contextual evidence, and resolves a value explicitly", async () => {
    const user = userEvent.setup();
    await renderWithDraft(
      providerOutputFixtures.evidence_mismatch_provider_output,
    );

    const filter = screen.getByRole("button", { name: "Needs review · 1" });
    await user.click(filter);
    expect(filter).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/could not verify the name/i)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Review source" }));
    const dialog = await screen.findByRole("dialog", { name: "Name" });
    expect(
      within(dialog).getByText("A completely absent excerpt"),
    ).toBeVisible();
    expect(within(dialog).getByText(/Needs confirmation/i)).toBeVisible();
    expect(within(dialog).queryByText(/confidence|provider|JSON/iu)).toBeNull();

    await user.click(
      within(dialog).getByRole("button", { name: "Edit value" }),
    );
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Review source" }));
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm this value" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Needs review · 0" }));
    expect(
      await screen.findByRole("heading", { name: "Everything is clear." }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Return to all sections" }),
    ).toBeEnabled();
  });

  it("adds and removes a skill with stable user-entered provenance", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await renderWithDraft();
    await user.click(sectionButton("Skills"));

    await user.click(screen.getByRole("button", { name: "Add skill" }));
    await user.type(screen.getByRole("textbox", { name: "Skill" }), "GraphQL");
    await user.click(screen.getByRole("button", { name: "Add entry" }));
    expect(screen.getByText("GraphQL")).toBeVisible();
    await waitFor(() =>
      expect(
        readResumeTransferState(sessionStorage)?.draft.evidence.at(-1),
      ).toMatchObject({ support: "user_entered" }),
    );

    await user.click(screen.getByRole("button", { name: "Remove GraphQL" }));
    expect(screen.queryByText("GraphQL")).not.toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledOnce();
  });

  it("renders the full extracted text as inert selectable plain text", async () => {
    const user = userEvent.setup();
    await renderWithDraft();

    await user.click(
      screen.getByRole("button", { name: "View full resume text" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Full resume text",
    });
    expect(within(dialog).getByText(/Alex Rivera/iu)).toBeVisible();
    expect(document.querySelector("script")).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(
      screen.getByRole("button", { name: "View full resume text" }),
    ).toHaveFocus();
  });

  it("requires all sections, acknowledges remaining details, and persists confirmation", async () => {
    const user = userEvent.setup();
    await renderWithDraft(
      providerOutputFixtures.evidence_mismatch_provider_output,
    );

    for (const section of [
      "Profile",
      "Experience",
      "Projects",
      "Skills",
      "Education",
    ]) {
      await user.click(sectionButton(section));
      await user.click(screen.getByRole("button", { name: "Looks right" }));
    }
    expect(screen.getByText("5 of 5 sections reviewed")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Confirm portfolio draft" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Confirm with details to revisit?",
    });
    expect(within(dialog).getByText(/1 detail remains/i)).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", {
        name: "Continue with current values",
      }),
    );

    expect(
      screen.getByText(/Private portfolio draft confirmed/i),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Draft confirmed" }),
    ).toBeVisible();
    expect(
      readResumeTransferState(sessionStorage)?.review.confirmedAt,
    ).not.toBeNull();
    expect(
      readResumeTransferState(sessionStorage)?.review.acknowledgedWarningIds,
    ).toHaveLength(1);
  });
});

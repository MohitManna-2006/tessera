import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PORTFOLIO_SECTION_ORDER,
  type PortfolioSectionId,
} from "@/lib/portfolio";

import Home from "./page";

const SECTION_TITLES: Record<PortfolioSectionId, string> = {
  profile: "Profile",
  links: "Links",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  education: "Education",
};

function useCompactViewport() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 1024px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function getSectionButton(action: "Collapse" | "Expand", title: string) {
  return screen.getByRole("button", {
    name: `${action} ${title} section`,
  });
}

function getRenderedSectionOrder(attribute: string) {
  return Array.from(document.querySelectorAll(`[${attribute}]`), (element) =>
    element.getAttribute(attribute),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Tessera portfolio builder", () => {
  it("renders the fixture and keeps editor and preview sections in canonical order", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Edit portfolio" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("Avery Morgan");
    expect(
      screen.getByRole("heading", { level: 2, name: "Avery Morgan" }),
    ).toBeInTheDocument();

    expect(getRenderedSectionOrder("data-editor-section")).toEqual([
      ...PORTFOLIO_SECTION_ORDER,
    ]);
    expect(getRenderedSectionOrder("data-portfolio-section")).toEqual([
      ...PORTFOLIO_SECTION_ORDER,
    ]);

    const experienceSection = document.querySelector(
      '[data-portfolio-section="experience"]',
    );
    const projectsSection = document.querySelector(
      '[data-portfolio-section="projects"]',
    );
    const skillsSection = document.querySelector(
      '[data-portfolio-section="skills"]',
    );
    const educationSection = document.querySelector(
      '[data-portfolio-section="education"]',
    );

    expect(experienceSection).toBeInstanceOf(HTMLElement);
    expect(projectsSection).toBeInstanceOf(HTMLElement);
    expect(skillsSection).toBeInstanceOf(HTMLElement);
    expect(educationSection).toBeInstanceOf(HTMLElement);
    expect(
      within(experienceSection as HTMLElement).getByRole("heading", {
        name: "Northstar Systems",
      }),
    ).toBeInTheDocument();
    expect(
      within(projectsSection as HTMLElement).getByRole("heading", {
        name: "Patchwork",
      }),
    ).toBeInTheDocument();
    expect(
      within(skillsSection as HTMLElement).getByRole("heading", {
        name: "Languages",
      }),
    ).toBeInTheDocument();
    expect(
      within(educationSection as HTMLElement).getByRole("heading", {
        name: "Oregon State University",
      }),
    ).toBeInTheDocument();
  });

  it("collapses and reopens Profile without losing draft data or exposing hidden fields to Tab", async () => {
    const user = userEvent.setup();
    render(<Home />);

    const nameInput = screen.getByLabelText("Full name");
    await user.clear(nameInput);
    await user.type(nameInput, "Jordan Lee");
    expect(
      screen.getByRole("heading", { level: 2, name: "Jordan Lee" }),
    ).toBeInTheDocument();

    const collapseProfile = getSectionButton("Collapse", "Profile");
    expect(collapseProfile).toHaveAttribute("aria-expanded", "true");
    expect(collapseProfile).toHaveAttribute("aria-controls", "profile-panel");
    collapseProfile.focus();
    await user.keyboard("{Enter}");

    const expandProfile = getSectionButton("Expand", "Profile");
    expect(expandProfile).toHaveAttribute("aria-expanded", "false");
    expect(nameInput).not.toBeVisible();
    expect(screen.getByText("Profile")).toBeVisible();

    expandProfile.focus();
    await user.tab();
    expect(getSectionButton("Expand", "Links")).toHaveFocus();

    expandProfile.focus();
    await user.keyboard(" ");
    expect(nameInput).toBeVisible();
    expect(nameInput).toHaveValue("Jordan Lee");
    expect(
      screen.getByRole("heading", { level: 2, name: "Jordan Lee" }),
    ).toBeInTheDocument();
  });

  it("supports multiple open sections and a valid all-sections-collapsed state", async () => {
    const user = userEvent.setup();
    render(<Home />);

    for (const section of PORTFOLIO_SECTION_ORDER.slice(1)) {
      await user.click(getSectionButton("Expand", SECTION_TITLES[section]));
    }

    for (const section of PORTFOLIO_SECTION_ORDER) {
      expect(
        getSectionButton("Collapse", SECTION_TITLES[section]),
      ).toHaveAttribute("aria-expanded", "true");
    }

    await user.click(getSectionButton("Collapse", "Profile"));
    for (const section of PORTFOLIO_SECTION_ORDER.slice(1)) {
      expect(
        getSectionButton("Collapse", SECTION_TITLES[section]),
      ).toHaveAttribute("aria-expanded", "true");
    }

    for (const section of PORTFOLIO_SECTION_ORDER.slice(1)) {
      await user.click(getSectionButton("Collapse", SECTION_TITLES[section]));
    }

    for (const section of PORTFOLIO_SECTION_ORDER) {
      const button = getSectionButton("Expand", SECTION_TITLES[section]);
      expect(button).toBeVisible();
      expect(button).toHaveAttribute("aria-expanded", "false");
    }
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);

    await user.click(getSectionButton("Expand", "Education"));
    expect(screen.getByLabelText("Institution")).toBeVisible();
    for (const section of PORTFOLIO_SECTION_ORDER.slice(0, -1)) {
      expect(
        getSectionButton("Expand", SECTION_TITLES[section]),
      ).toHaveAttribute("aria-expanded", "false");
    }
    await user.click(getSectionButton("Collapse", "Education"));
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("preserves invalid values and validation while their section is collapsed", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(getSectionButton("Expand", "Links"));
    const emailInput = screen.getByLabelText("Email");
    await user.clear(emailInput);
    await user.type(emailInput, "avery@");

    const emailError = screen.getByText("Enter a complete email address.");
    expect(emailError).toBeVisible();
    expect(screen.getByText("avery@", { selector: "span" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "avery@" })).toBeNull();

    await user.click(getSectionButton("Collapse", "Links"));
    expect(emailInput).not.toBeVisible();
    expect(emailError).not.toBeVisible();
    expect(getSectionButton("Collapse", "Profile")).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await user.click(getSectionButton("Expand", "Links"));
    expect(emailInput).toBeVisible();
    expect(emailInput).toHaveValue("avery@");
    expect(emailError).toBeVisible();

    const githubInput = screen.getByLabelText("GitHub URL");
    await user.clear(githubInput);
    await user.type(githubInput, "github dot com");
    expect(
      screen.getByText("github dot com", { selector: "span" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "github dot com" })).toBeNull();
    expect(githubInput).toHaveAccessibleDescription(
      "Enter a full URL beginning with http:// or https://.",
    );
  });

  it("updates the preview immediately as representative fields change", async () => {
    const user = userEvent.setup();
    render(<Home />);

    const headlineInput = screen.getByLabelText("Professional headline");
    await user.clear(headlineInput);
    await user.type(headlineInput, "Frontend engineer for public data tools");
    expect(
      screen.getByText("Frontend engineer for public data tools"),
    ).toBeInTheDocument();

    await user.click(getSectionButton("Expand", "Experience"));
    const roleInputs = screen.getAllByLabelText("Role");
    await user.clear(roleInputs[0]);
    await user.type(roleInputs[0], "Product Engineering Intern");
    expect(screen.getByText("Product Engineering Intern")).toBeInTheDocument();
  });

  it("restores the exact fixture without rewriting disclosure preferences", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Home />);

    await user.click(getSectionButton("Collapse", "Profile"));
    await user.click(getSectionButton("Expand", "Links"));
    const emailInput = screen.getByLabelText("Email");
    await user.clear(emailInput);
    await user.type(emailInput, "invalid");

    await user.click(screen.getByRole("button", { name: "Reset draft" }));

    expect(screen.getByLabelText("Full name")).toHaveValue("Avery Morgan");
    expect(emailInput).toHaveValue("avery.morgan@example.com");
    expect(getSectionButton("Expand", "Profile")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(getSectionButton("Collapse", "Links")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.queryByText("Enter a complete email address.")).toBeNull();
  });

  it("preserves disclosure state across keyboard-operated compact tabs", async () => {
    useCompactViewport();
    const user = userEvent.setup();
    render(<Home />);

    await waitFor(() =>
      expect(screen.getByRole("tabpanel", { name: "Edit" })).toBeVisible(),
    );
    await user.click(getSectionButton("Collapse", "Profile"));
    await user.click(getSectionButton("Expand", "Links"));

    const editTab = screen.getByRole("tab", { name: "Edit" });
    const previewTab = screen.getByRole("tab", { name: "Preview" });
    editTab.focus();
    fireEvent.keyDown(editTab, { key: "ArrowRight" });

    expect(previewTab).toHaveAttribute("aria-selected", "true");
    expect(previewTab).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "Preview" })).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 1, name: "Avery Morgan" }),
    ).toBeVisible();

    await user.click(editTab);
    expect(getSectionButton("Expand", "Profile")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(getSectionButton("Collapse", "Links")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByLabelText("Email")).toBeVisible();
  });
});

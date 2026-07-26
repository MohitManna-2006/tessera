import { expect, test, type Page } from "@playwright/test";

import {
  PORTFOLIO_SECTION_ORDER,
  type PortfolioSectionId,
} from "../../src/lib/portfolio";

const SECTION_TITLES: Record<PortfolioSectionId, string> = {
  profile: "Profile",
  links: "Links",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  education: "Education",
};

function watchBrowserIssues(page: Page) {
  const issues: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      issues.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    issues.push(`pageerror: ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    issues.push(
      `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`,
    );
  });

  return issues;
}

test("edits the portfolio, validates links, and resets the fixture", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Edit portfolio" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Avery Morgan" }),
  ).toBeVisible();

  await page.getByLabel("Full name").fill("Jordan Lee");
  await expect(
    page.getByRole("heading", { level: 2, name: "Jordan Lee" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Expand Links section" }).click();
  await page.getByLabel("Email").fill("jordan@");
  await expect(page.getByText("Enter a complete email address.")).toBeVisible();
  await expect(page.getByRole("link", { name: "jordan@" })).toHaveCount(0);

  await page.getByLabel("GitHub URL").fill("not a url");
  await expect(
    page.getByText("Enter a full URL beginning with http:// or https://."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "not a url" })).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Reset draft" }).click();
  await expect(page.getByLabel("Email")).toHaveValue("jordan@");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset draft" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Avery Morgan");
  await expect(
    page.getByRole("button", { name: "Collapse Profile section" }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("button", { name: "Collapse Links section" }),
  ).toHaveAttribute("aria-expanded", "true");
});

test("supports independent disclosures, zero open sections, and canonical order", async ({
  page,
}) => {
  const browserIssues = watchBrowserIssues(page);
  await page.goto("/");

  const collapseProfile = page.getByRole("button", {
    name: "Collapse Profile section",
  });
  await collapseProfile.click();
  await expect(page.getByLabel("Full name")).toBeHidden();
  const expandProfile = page.getByRole("button", {
    name: "Expand Profile section",
  });
  await expect(expandProfile).toHaveAttribute("aria-expanded", "false");

  await expandProfile.focus();
  await page.keyboard.press("Enter");
  const collapseProfileWithKeyboard = page.getByRole("button", {
    name: "Collapse Profile section",
  });
  await expect(collapseProfileWithKeyboard).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await collapseProfileWithKeyboard.focus();
  await page.keyboard.press("Space");
  await expect(expandProfile).toHaveAttribute("aria-expanded", "false");

  await expandProfile.click();
  await page.getByLabel("Full name").fill("Casey Chen");
  for (const section of PORTFOLIO_SECTION_ORDER.slice(1)) {
    await page
      .getByRole("button", {
        name: `Expand ${SECTION_TITLES[section]} section`,
      })
      .click();
  }

  await page.getByRole("button", { name: "Collapse Profile section" }).click();
  for (const section of PORTFOLIO_SECTION_ORDER.slice(1)) {
    await expect(
      page.getByRole("button", {
        name: `Collapse ${SECTION_TITLES[section]} section`,
      }),
    ).toHaveAttribute("aria-expanded", "true");
  }
  await expect(
    page.getByRole("heading", { level: 2, name: "Casey Chen" }),
  ).toBeVisible();

  for (const section of PORTFOLIO_SECTION_ORDER.slice(1)) {
    await page
      .getByRole("button", {
        name: `Collapse ${SECTION_TITLES[section]} section`,
      })
      .click();
  }

  for (const section of PORTFOLIO_SECTION_ORDER) {
    await expect(
      page.getByRole("button", {
        name: `Expand ${SECTION_TITLES[section]} section`,
      }),
    ).toBeVisible();
  }
  await expect(page.getByRole("textbox")).toHaveCount(0);

  await page.getByRole("button", { name: "Expand Profile section" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Casey Chen");
  await page.getByRole("button", { name: "Collapse Profile section" }).click();

  const sectionOrder = await page.evaluate(() => ({
    editor: Array.from(
      document.querySelectorAll("[data-editor-section]"),
      (element) => element.getAttribute("data-editor-section"),
    ),
    preview: Array.from(
      document.querySelectorAll("[data-portfolio-section]"),
      (element) => element.getAttribute("data-portfolio-section"),
    ),
  }));
  expect(sectionOrder.editor).toEqual([...PORTFOLIO_SECTION_ORDER]);
  expect(sectionOrder.preview).toEqual([...PORTFOLIO_SECTION_ORDER]);
  expect(browserIssues).toEqual([]);
});

test("keeps disclosure and Edit/Preview behavior stable on mobile", async ({
  page,
}) => {
  const browserIssues = watchBrowserIssues(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const editTab = page.getByRole("tab", { name: "Edit" });
  const previewTab = page.getByRole("tab", { name: "Preview" });

  await expect(editTab).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Collapse Profile section" }).click();

  for (const section of PORTFOLIO_SECTION_ORDER) {
    await expect(
      page.getByRole("button", {
        name: `Expand ${SECTION_TITLES[section]} section`,
      }),
    ).toBeVisible();
  }

  await page.getByRole("button", { name: "Expand Skills section" }).click();
  await expect(page.getByLabel("Group name")).toHaveCount(3);

  await editTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(previewTab).toBeFocused();
  await expect(previewTab).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { level: 1, name: "Avery Morgan" }),
  ).toBeVisible();

  await editTab.click();
  await expect(
    page.getByRole("button", { name: "Collapse Skills section" }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("button", { name: "Expand Profile section" }),
  ).toHaveAttribute("aria-expanded", "false");

  await page.getByRole("button", { name: "Collapse Skills section" }).click();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  expect(browserIssues).toEqual([]);
});

test("does not overflow horizontally at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");

  await page.getByRole("button", { name: "Collapse Profile section" }).click();
  const editWidth = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(editWidth.document).toBeLessThanOrEqual(editWidth.viewport);

  await page.getByRole("tab", { name: "Preview" }).click();
  const previewWidth = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(previewWidth.document).toBeLessThanOrEqual(previewWidth.viewport);
});

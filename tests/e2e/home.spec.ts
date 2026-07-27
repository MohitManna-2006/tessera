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

test("downloads one edited standalone ZIP and restores focus on desktop", async ({
  page,
}) => {
  const browserIssues = watchBrowserIssues(page);
  let exportRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/export")) {
      exportRequests += 1;
    }
  });
  await page.goto("/");

  const wordmark = page.getByText("Tessera", { exact: true });
  const originalWordmark = await wordmark.evaluate(
    (element) => element.outerHTML,
  );
  await page.getByLabel("Full name").fill("Downloaded Person");

  const downloadButton = page.getByRole("button", {
    name: "Download code",
  });
  const downloadPromise = page.waitForEvent("download");
  await downloadButton.evaluate((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Download control is not a button.");
    }
    button.click();
    button.click();
  });

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();
  await expect(page.getByText("UI preview mode")).toHaveCount(0);
  const stageList = page.getByRole("list", { name: "Export stages" });
  for (const label of ["Preparing", "Generating", "Verifying", "Packaging"]) {
    await expect(
      stageList.getByRole("listitem").filter({ hasText: label }),
    ).toHaveAttribute("data-status", "current");
  }

  const download = await downloadPromise;
  await expect(
    page.getByRole("heading", { name: "Your portfolio is ready" }),
  ).toBeVisible();
  await expect(page.getByText("The ZIP download has started.")).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Export progress: 5 of 5 stages complete",
    }),
  ).toBeVisible();
  await expect(
    stageList.getByRole("listitem").filter({ hasText: "Download started" }),
  ).toHaveAttribute("data-status", "complete");
  await expect(page.getByRole("button", { name: "Done" })).toBeFocused();
  expect(download.suggestedFilename()).toBe("tessera-portfolio.zip");
  expect(exportRequests).toBe(1);
  await expect(page.getByLabel("Full name")).toHaveValue("Downloaded Person");
  await expect(
    page.getByRole("heading", { level: 2, name: "Downloaded Person" }),
  ).toBeVisible();
  expect(await wordmark.evaluate((element) => element.outerHTML)).toBe(
    originalWordmark,
  );

  await page.getByRole("button", { name: "Done" }).click();
  await expect(downloadButton).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(browserIssues).toEqual([]);
  await download.delete();
});

test("blocks invalid export before the request boundary", async ({ page }) => {
  let exportRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/export")) {
      exportRequests += 1;
    }
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Expand Links section" }).click();
  const email = page.getByLabel("Email");
  await email.fill("invalid@");
  await page.getByRole("button", { name: "Download code" }).click();

  await expect(
    page.getByText(
      "Correct the highlighted email or URL fields before downloading.",
    ),
  ).toBeVisible();
  await expect(email).toBeFocused();
  await expect(email).toHaveValue("invalid@");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(exportRequests).toBe(0);
});

test("preserves the draft through controlled failure, close, and retry", async ({
  page,
}) => {
  const browserIssues = watchBrowserIssues(page);
  let failuresRemaining = 2;
  let exportRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/export")) {
      exportRequests += 1;
    }
  });
  await page.route("**/api/export", async (route) => {
    if (failuresRemaining > 0) {
      failuresRemaining -= 1;
      await route.fulfill({
        status: 200,
        contentType: "application/x-ndjson",
        body: [
          JSON.stringify({
            type: "stage",
            completed: "preparing",
            current: "generating",
          }),
          JSON.stringify({
            type: "stage",
            completed: "generating",
            current: "verifying",
          }),
          JSON.stringify({
            type: "failure",
            stage: "verifying",
            message: "We couldn't package your portfolio. Your draft is safe.",
          }),
          "",
        ].join("\n"),
      });
      return;
    }
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  await page.goto("/");

  const nameInput = page.getByLabel("Full name");
  const downloadButton = page.getByRole("button", {
    name: "Download code",
  });
  await nameInput.fill("Failure Safe");
  await downloadButton.click();

  await expect(
    page.getByRole("heading", { name: "Export couldn't finish" }),
  ).toBeVisible();
  await expect(
    page.getByText("We couldn't package your portfolio. Your draft is safe."),
  ).toBeVisible();
  await expect(page.getByText("Stopped")).toBeVisible();
  await expect(page.getByText("Done")).toHaveCount(2);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(downloadButton).toBeFocused();
  await expect(nameInput).toHaveValue("Failure Safe");

  await downloadButton.click();
  await expect(
    page.getByRole("heading", { name: "Export couldn't finish" }),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Try again" }).click();
  const download = await downloadPromise;
  await expect(
    page.getByRole("heading", { name: "Your portfolio is ready" }),
  ).toBeVisible();
  expect(exportRequests).toBe(3);
  expect(download.suggestedFilename()).toBe("tessera-portfolio.zip");
  await expect(nameInput).toHaveValue("Failure Safe");
  await expect(
    page.getByRole("heading", { level: 2, name: "Failure Safe" }),
  ).toBeVisible();
  expect(browserIssues).toEqual([]);
  await download.delete();
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

test("downloads successfully from the centered mobile dialog", async ({
  page,
}) => {
  const browserIssues = watchBrowserIssues(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download code" }).click();
  const dialog = page.getByRole("dialog");

  await expect(dialog).toBeVisible();
  const preparingStage = page
    .getByRole("list", { name: "Export stages" })
    .getByRole("listitem")
    .filter({ hasText: "Preparing" });
  await expect(preparingStage).toHaveAttribute("data-status", "current");
  expect(
    await dialog
      .locator(".progress-tile")
      .first()
      .evaluate((tile) => {
        return window.getComputedStyle(tile).transitionDuration;
      }),
  ).toBe("0s");
  await expect(
    page
      .getByRole("list", { name: "Export stages" })
      .getByRole("listitem")
      .filter({ hasText: "Generating" }),
  ).toHaveAttribute("data-status", "current");

  const download = await downloadPromise;
  await expect(
    page.getByRole("heading", { name: "Your portfolio is ready" }),
  ).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox?.width).toBeLessThanOrEqual(366);
  expect(dialogBox?.x).toBeGreaterThanOrEqual(0);
  expect(download.suggestedFilename()).toBe("tessera-portfolio.zip");

  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Avery Morgan" }),
  ).toBeVisible();
  expect(browserIssues).toEqual([]);
  await download.delete();
});

test("keeps the export dialog centered at the tablet breakpoint", async ({
  page,
}) => {
  const browserIssues = watchBrowserIssues(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download code" }).click();
  const dialog = page.getByRole("dialog");

  await expect(dialog).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Export stages" })
      .getByRole("listitem")
      .filter({ hasText: "Preparing" }),
  ).toHaveAttribute("data-status", "current");

  const download = await downloadPromise;
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox?.width).toBeLessThanOrEqual(420);
  expect(dialogBox?.x).toBeGreaterThanOrEqual(0);
  expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeLessThanOrEqual(
    1024,
  );
  const pageWidth = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(pageWidth.document).toBeLessThanOrEqual(pageWidth.viewport);
  expect(download.suggestedFilename()).toBe("tessera-portfolio.zip");
  expect(browserIssues).toEqual([]);
  await download.delete();
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

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download code" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox?.width).toBeLessThanOrEqual(296);
  expect(dialogBox?.x).toBeGreaterThanOrEqual(0);
  expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeLessThanOrEqual(
    320,
  );

  const download = await downloadPromise;
  await expect(
    page.getByRole("heading", { name: "Your portfolio is ready" }),
  ).toBeVisible();
  expect(download.suggestedFilename()).toBe("tessera-portfolio.zip");
  await download.delete();
});

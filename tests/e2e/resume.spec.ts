import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

import { ResumeExtractionRequestV1Schema } from "../../src/lib/resume-draft/contracts";
import { normalizeProviderResumeDraft } from "../../src/lib/resume-draft/normalization";
import type { ProviderResumeDraftV1 } from "../../src/lib/resume-draft/provider-contract";
import {
  experiencedEngineerResumeText,
  providerOutputFixtures,
  validProviderResumeDraft,
} from "../fixtures/resume-ai/fixtures";

const fixture = (name: string) =>
  join(process.cwd(), "tests", "fixtures", "resume", name);

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

async function mockSuccessfulTextExtraction(page: Page) {
  await page.route("**/api/resume/extract", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: "success",
        data: {
          filename: "valid-resume.pdf",
          pageCount: 1,
          characterCount: experiencedEngineerResumeText.length,
          text: experiencedEngineerResumeText,
          warnings: [],
        },
      }),
    });
  });
}

function normalizeMockedDraft(
  requestBody: unknown,
  providerOutput: unknown = validProviderResumeDraft,
) {
  const input = ResumeExtractionRequestV1Schema.parse(requestBody);
  return normalizeProviderResumeDraft({
    providerOutput,
    sourceText: input.text,
    source: input.source,
  });
}

test("processes a real PDF once and renders trustworthy plain-text metadata", async ({
  page,
}) => {
  const browserIssues = watchBrowserIssues(page);
  let extractionRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/resume/extract")) {
      extractionRequests += 1;
    }
  });
  await page.route("**/api/resume/extract", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 180));
    await route.continue();
  });
  await page.goto("/resume");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Extract your resume text.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/raw file is not permanently stored/i),
  ).toBeVisible();
  await expect(page.getByText(/no AI service is called/i)).toBeVisible();
  await expect(page.getByLabel("Resume PDF")).toHaveAttribute(
    "accept",
    ".pdf,application/pdf",
  );

  await page
    .getByLabel("Resume PDF")
    .setInputFiles(fixture("valid-resume.pdf"));
  await expect(
    page.getByRole("region", { name: "Selected resume" }),
  ).toContainText("valid-resume.pdf");

  const submit = page.getByRole("button", { name: "Extract resume text" });
  await submit.evaluate((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Extraction action is not a button.");
    }
    button.click();
    button.click();
  });

  await expect(
    page.getByRole("button", { name: "Processing resume…" }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Replace" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Remove" })).toBeDisabled();
  await expect(page.getByText("Extracting resume text")).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "Resume text extracted" }),
  ).toBeVisible();
  await expect(page.getByLabel("Extracted plain text")).toContainText(
    "FICTIONAL RESUME",
  );
  await expect(page.getByLabel("Extracted plain text")).toContainText(
    "Experience: Created reliable tools and documented repeatable workflows.",
  );
  const result = page.locator(".resume-result");
  await expect(result.getByText("valid-resume.pdf")).toBeVisible();
  await expect(result.locator("dd").filter({ hasText: "1" })).toBeVisible();
  await expect(
    page.getByText(/No AI analysis or structured portfolio extraction/i),
  ).toBeVisible();
  expect(extractionRequests).toBe(1);

  const replacementChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose another PDF" }).click();
  const replacementChooser = await replacementChooserPromise;
  await replacementChooser.setFiles(fixture("multi-page-resume.pdf"));
  await expect(
    page.getByRole("region", { name: "Selected resume" }),
  ).toContainText("multi-page-resume.pdf");
  await expect(
    page.getByRole("heading", { name: "Resume text extracted" }),
  ).toHaveCount(0);
  expect(browserIssues).toEqual([]);
});

test("creates one evidence-backed draft from extracted text through a mocked AI boundary", async ({
  page,
}) => {
  const browserIssues = watchBrowserIssues(page);
  const draftRequests: unknown[] = [];

  await page.route("**/api/resume/draft", async (route) => {
    const requestBody = route.request().postDataJSON();
    draftRequests.push(requestBody);
    const input = ResumeExtractionRequestV1Schema.parse(requestBody);
    const draft = normalizeProviderResumeDraft({
      providerOutput: structuredClone(validProviderResumeDraft),
      sourceText: input.text,
      source: input.source,
    });

    await new Promise((resolve) => setTimeout(resolve, 180));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: draft }),
    });
  });

  await page.goto("/resume");
  await page
    .getByLabel("Resume PDF")
    .setInputFiles(fixture("valid-resume.pdf"));
  await page.getByRole("button", { name: "Extract resume text" }).click();
  await expect(
    page.getByRole("heading", { name: "Resume text extracted" }),
  ).toBeVisible();
  expect(draftRequests).toHaveLength(0);

  const createDraft = page.getByRole("button", {
    name: "Create my portfolio draft",
  });
  await expect(createDraft).toBeVisible();
  await createDraft.evaluate((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Draft creation action is not a button.");
    }
    button.click();
    button.click();
  });

  await expect(
    page.getByRole("dialog", { name: "Creating your portfolio draft" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Creating portfolio draft…" }),
  ).toBeDisabled();
  await page.waitForURL("**/resume/review");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Your portfolio draft is ready.",
    }),
  ).toBeVisible();
  await expect(page.getByText("0 of 5 sections reviewed")).toBeVisible();
  await expect(page.getByText("Alex Rivera", { exact: true })).toBeVisible();

  expect(draftRequests).toHaveLength(1);
  const request = ResumeExtractionRequestV1Schema.parse(draftRequests[0]);
  expect(
    Object.keys(draftRequests[0] as Record<string, unknown>).sort(),
  ).toEqual(["operation", "source", "text"]);
  expect(request.operation).toBe("extract_resume");
  expect(request.text).toContain("FICTIONAL RESUME");
  expect(request.source).toMatchObject({
    filename: "valid-resume.pdf",
    pageCount: 1,
    characterCount: request.text.length,
  });
  expect(
    await page.evaluate(() => {
      const stored = window.sessionStorage.getItem("tessera.resume-review.v1");
      return stored ? JSON.parse(stored).draft.operation : null;
    }),
  ).toBe("extract_resume");
  expect(browserIssues).toEqual([]);
});

test("supports the full guided review, recovery, validation, and private confirmation flow", async ({
  page,
}) => {
  const browserIssues = watchBrowserIssues(page);
  const providerOutput: ProviderResumeDraftV1 = {
    ...structuredClone(
      providerOutputFixtures.evidence_mismatch_provider_output,
    ),
    warnings: [
      {
        section: "education",
        field: null,
        entryIndex: null,
        itemIndex: null,
        severity: "review",
        category: "ambiguous_source",
        message: "Confirm the education details before using this draft.",
      },
    ],
  };

  await mockSuccessfulTextExtraction(page);
  await page.route("**/api/resume/draft", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: normalizeMockedDraft(
          route.request().postDataJSON(),
          providerOutput,
        ),
      }),
    });
  });

  await page.goto("/resume");
  await page
    .getByLabel("Resume PDF")
    .setInputFiles(fixture("valid-resume.pdf"));
  await page.getByRole("button", { name: "Extract resume text" }).click();

  const disclosure = page.getByText("What gets sent?", { exact: true });
  await disclosure.click();
  await expect(
    page.getByText(/extracted plain text is sent to the AI provider/i),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create my portfolio draft" }).click();
  await page.waitForURL("**/resume/review");

  await expect(
    page.getByText(/1 experience, 1 project, 3 skills, 1 education entry/i),
  ).toBeVisible();
  const profileSection = page.getByRole("button", { name: /^Profile/ });
  await expect(profileSection).toHaveAttribute("aria-current", "page");
  const needsReview = page.getByRole("button", { name: "Needs review · 2" });
  await needsReview.click();
  await expect(needsReview).toHaveAttribute("aria-pressed", "true");

  const reviewSource = page.getByRole("button", { name: "Review source" });
  await reviewSource.click();
  const evidence = page.getByRole("dialog", { name: "Name" });
  await expect(evidence).toContainText("A completely absent excerpt");
  await evidence.getByRole("button", { name: "Close" }).click();
  await expect(reviewSource).toBeFocused();

  await needsReview.click();
  await reviewSource.click();
  await evidence.getByRole("button", { name: "Edit value" }).click();
  const name = page.getByRole("textbox", { name: "Name" });
  await expect(name).toBeFocused();
  await name.fill("Alex R. Rivera");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("button", { name: "Needs review · 1" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Looks right" }).click();

  await page.getByRole("button", { name: /^Skills/ }).click();
  await page.getByRole("button", { name: "Add skill" }).click();
  await page.getByRole("textbox", { name: "Skill" }).fill("GraphQL");
  await page.getByRole("button", { name: "Add entry" }).click();
  await expect(page.getByText("GraphQL", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove GraphQL" }).click();
  await expect(page.getByText("GraphQL", { exact: true })).toHaveCount(0);

  const fullSourceTrigger = page.getByRole("button", {
    name: "View full resume text",
  });
  await fullSourceTrigger.click();
  const fullSource = page.getByRole("dialog", { name: "Full resume text" });
  await expect(fullSource).toContainText("Alex Rivera");
  await fullSource.getByRole("button", { name: "Close" }).click();
  await expect(fullSourceTrigger).toBeFocused();

  await page.reload();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Your portfolio draft is ready.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Alex R. Rivera", { exact: true })).toBeVisible();

  for (const section of [
    "Profile",
    "Experience",
    "Projects",
    "Skills",
    "Education",
  ]) {
    await page.getByRole("button", { name: new RegExp(`^${section}`) }).click();
    const approval = page.getByRole("button", {
      name: /^(Looks right|Section reviewed)$/,
    });
    if (await approval.isEnabled()) {
      await approval.click();
    }
  }
  await expect(page.getByText("5 of 5 sections reviewed")).toBeVisible();

  await page.evaluate(() => {
    const key = "tessera.resume-review.v1";
    const serialized = window.sessionStorage.getItem(key);
    if (!serialized) throw new Error("Expected a temporary review draft.");
    const envelope = JSON.parse(serialized);
    envelope.draft.draft.projects[0].name = null;
    window.sessionStorage.setItem(key, JSON.stringify(envelope));
  });
  await page.reload();
  await page.getByRole("button", { name: "Confirm portfolio draft" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Projects" }),
  ).toBeFocused();
  await expect(page.getByRole("status")).toContainText(
    "Each project needs a name.",
  );

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Project name" })
    .fill("Trace Garden");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Looks right" }).click();

  await page.getByRole("button", { name: "Confirm portfolio draft" }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Confirm with details to revisit?",
  });
  await expect(confirmation).toContainText("1 detail remains");
  await confirmation.getByRole("button", { name: "Keep reviewing" }).click();
  await expect(confirmation).not.toBeVisible();

  await page.getByRole("button", { name: "Confirm portfolio draft" }).click();
  await confirmation
    .getByRole("button", { name: "Continue with current values" })
    .click();
  await expect(
    page.getByText(/Private portfolio draft confirmed/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Draft confirmed" }),
  ).toBeDisabled();
  expect(page.url()).toContain("/resume/review");
  expect(page.url()).not.toContain("/builder");
  expect(browserIssues).toEqual([]);
});

test("preserves extracted text through a generation failure and explicit retry", async ({
  page,
}) => {
  await mockSuccessfulTextExtraction(page);
  let attempts = 0;
  await page.route("**/api/resume/draft", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: {
            code: "PROVIDER_UNAVAILABLE",
            message:
              "Portfolio drafting is temporarily unavailable. Try again.",
            retryable: true,
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: normalizeMockedDraft(route.request().postDataJSON()),
      }),
    });
  });

  await page.goto("/resume");
  await page
    .getByLabel("Resume PDF")
    .setInputFiles(fixture("valid-resume.pdf"));
  await page.getByRole("button", { name: "Extract resume text" }).click();
  await page.getByRole("button", { name: "Create my portfolio draft" }).click();

  const errorDialog = page.getByRole("dialog", {
    name: "Draft creation couldn’t finish",
  });
  await expect(errorDialog).toContainText(
    "Portfolio drafting is temporarily unavailable.",
  );
  await expect(page.getByLabel("Extracted plain text")).toContainText(
    "Alex Rivera",
  );
  await errorDialog.getByRole("button", { name: "Try again" }).click();
  await page.waitForURL("**/resume/review");
  expect(attempts).toBe(2);
});

test("shows recoverable direct-entry state without mobile overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/resume/review");
  await expect(
    page.getByRole("heading", { name: "A resume draft isn’t available." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Return to resume" }),
  ).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
});

test("supports keyboard-only native file selection and replacement", async ({
  page,
}) => {
  await page.goto("/resume");

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Tessera", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Open builder", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  const choose = page.getByRole("button", { name: "Choose PDF" });
  await expect(choose).toBeFocused();

  const chooserPromise = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  const chooser = await chooserPromise;
  expect(chooser.isMultiple()).toBe(false);
  await chooser.setFiles(fixture("valid-resume.pdf"));
  const selected = page.getByRole("region", { name: "Selected resume" });
  await expect(selected).toContainText("valid-resume.pdf");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Replace" })).toBeFocused();
  await page.keyboard.press("Tab");
  const remove = page.getByRole("button", { name: "Remove" });
  await expect(remove).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(selected).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Extract resume text" }),
  ).toBeDisabled();
});

test("routes a DataTransfer PDF drop through the real selection handler", async ({
  page,
}) => {
  await page.goto("/resume");
  const bytes = await readFile(fixture("valid-resume.pdf"));

  await page.locator(".resume-drop-zone").evaluate(
    (dropZone, file) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File(
          [Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0))],
          file.name,
          {
            type: "application/pdf",
          },
        ),
      );
      dropZone.dispatchEvent(
        new DragEvent("dragenter", {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      );
      dropZone.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      );
    },
    {
      base64: bytes.toString("base64"),
      name: "dropped-fictional-resume.pdf",
    },
  );

  await expect(
    page.getByRole("region", { name: "Selected resume" }),
  ).toContainText("dropped-fictional-resume.pdf");
  await expect(page.locator(".resume-drop-zone")).toHaveAttribute(
    "data-drag-active",
    "false",
  );
});

test("rejects invalid local selections and every major unreadable PDF category", async ({
  page,
}) => {
  await page.goto("/resume");
  const input = page.getByLabel("Resume PDF");

  await input.setInputFiles({
    name: "not-a-pdf.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("plain text"),
  });
  await expect(page.locator(".resume-error")).toContainText(
    "Choose a PDF file",
  );
  await expect(input).toHaveAttribute("aria-invalid", "true");

  await input.setInputFiles(fixture("empty-resume.pdf"));
  await expect(page.locator(".resume-error")).toContainText(
    "Choose a non-empty PDF",
  );

  for (const [name, message] of [
    ["renamed-text.pdf", "Renamed or unsupported files"],
    ["corrupted-resume.pdf", "appears corrupted or incomplete"],
    ["encrypted-resume.pdf", "password-protected or encrypted"],
    ["image-only-resume.pdf", "Scanned or image-only PDFs need OCR"],
    ["blank-resume.pdf", "no readable page content"],
    ["symbols-only-resume.pdf", "Usable resume text could not be extracted"],
  ] as const) {
    await input.setInputFiles(fixture(name));
    await page.getByRole("button", { name: "Extract resume text" }).click();
    await expect(page.locator(".resume-error")).toContainText(message);
    await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Replace" })).toBeEnabled();
  }
});

test("keeps long filenames and extracted review contained on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/resume");
  await page.getByLabel("Resume PDF").setInputFiles({
    name: `${"fictional-".repeat(18)}resume.pdf`,
    mimeType: "application/pdf",
    buffer: await readFile(fixture("valid-resume.pdf")),
  });

  const selected = page.getByRole("region", { name: "Selected resume" });
  await expect(selected).toBeVisible();
  const selectedBox = await selected.boundingBox();
  expect(selectedBox).not.toBeNull();
  expect(selectedBox?.x).toBeGreaterThanOrEqual(0);
  expect((selectedBox?.x ?? 0) + (selectedBox?.width ?? 0)).toBeLessThanOrEqual(
    390,
  );

  await page.getByRole("button", { name: "Extract resume text" }).click();
  const review = page.getByLabel("Extracted plain text");
  await expect(review).toBeVisible();
  const reviewBox = await review.boundingBox();
  expect(reviewBox).not.toBeNull();
  expect(reviewBox?.height).toBeLessThanOrEqual(520);

  const width = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(width.document).toBeLessThanOrEqual(width.viewport);
});

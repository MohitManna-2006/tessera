import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

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

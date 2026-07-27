import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ResumeExtractionResult } from "@/lib/resume/contracts";
import ResumePage from "./page";

const extractedText =
  "<script>alert('not markup')</script>\n" +
  "FICTIONAL RESUME\nTest Persona builds reliable tools and documents accessible workflows.";
const successResult: ResumeExtractionResult = {
  ok: true,
  status: "success",
  data: {
    filename: "fictional-resume.pdf",
    pageCount: 2,
    characterCount: extractedText.length,
    text: extractedText,
    warnings: [
      {
        code: "plain_text_layout",
        message:
          "PDF layout was converted to plain text; review line breaks and spacing.",
      },
    ],
  },
};

function pdfFile(
  name = "fictional-resume.pdf",
  options: { size?: number; type?: string } = {},
) {
  return new File([new Uint8Array(options.size ?? 1200)], name, {
    type: options.type ?? "application/pdf",
  });
}

function jsonResponse(result: ResumeExtractionResult, status = 200) {
  return new Response(JSON.stringify(result), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getFileInput() {
  return screen.getByLabelText("Resume PDF") as HTMLInputElement;
}

function getDropZone() {
  const heading = screen.getByRole("heading", {
    level: 2,
    name: "Drop your resume here",
  });
  const dropZone = heading.closest(".resume-drop-zone");
  if (!(dropZone instanceof HTMLDivElement)) {
    throw new Error("Drop zone was not rendered.");
  }
  return dropZone;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("resume upload page", () => {
  it("renders an accessible upload boundary and accurate privacy guidance", () => {
    render(<ResumePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Extract your resume text.",
      }),
    ).toBeInTheDocument();
    expect(getFileInput()).toHaveAttribute("accept", ".pdf,application/pdf");
    expect(getFileInput()).toHaveAccessibleDescription(
      "One text-based PDF, up to 5.0 MB.",
    );
    expect(
      screen.getByText(/raw file is not permanently stored/i),
    ).toBeVisible();
    expect(screen.getByText(/no AI service is called/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Extract resume text" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Back to Tessera" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", {
        name: "Open builder without a resume",
      }),
    ).toHaveAttribute("href", "/builder");
  });

  it("uses one validation path for picker files and reports accessible errors", () => {
    render(<ResumePage />);

    fireEvent.change(getFileInput(), {
      target: { files: [pdfFile("resume.txt")] },
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveFocus();
    expect(within(alert).getByText(/choose a PDF file/i)).toBeVisible();
    expect(getFileInput()).toHaveAttribute("aria-invalid", "true");
    expect(getFileInput()).toHaveAccessibleDescription(
      /One text-based PDF.*Choose a PDF file/iu,
    );

    fireEvent.change(getFileInput(), {
      target: {
        files: [pdfFile("empty.pdf", { size: 0 })],
      },
    });
    expect(
      within(screen.getByRole("alert")).getByText(
        "Choose a non-empty PDF resume.",
      ),
    ).toBeVisible();

    fireEvent.change(getFileInput(), {
      target: {
        files: [
          pdfFile("oversized.pdf", {
            size: 5 * 1024 * 1024 + 1,
          }),
        ],
      },
    });
    expect(
      within(screen.getByRole("alert")).getByText(/no larger than 5.0 MB/i),
    ).toBeVisible();
  });

  it("shows drag-active state and rejects a multi-file drop without choosing one", () => {
    render(<ResumePage />);
    const dropZone = getDropZone();
    const first = pdfFile("first.pdf");
    const second = pdfFile("second.pdf");

    fireEvent.dragEnter(dropZone, {
      dataTransfer: { files: [first] },
    });
    expect(dropZone).toHaveAttribute("data-drag-active", "true");

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [first, second] },
    });
    expect(dropZone).toHaveAttribute("data-drag-active", "false");
    expect(
      within(screen.getByRole("alert")).getByText(
        "Choose exactly one PDF resume and try again.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("first.pdf")).not.toBeInTheDocument();
  });

  it("shows selected file metadata and supports remove and same-file reselection", async () => {
    const user = userEvent.setup();
    render(<ResumePage />);
    const input = getFileInput();
    const selected = pdfFile("FICTIONAL-RESUME.PDF", { size: 1536 });

    await user.upload(input, selected);
    const summary = screen.getByRole("region", {
      name: "Selected resume",
    });
    expect(within(summary).getByText("FICTIONAL-RESUME.PDF")).toBeVisible();
    expect(within(summary).getByText("1.5 KB")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Extract resume text" }),
    ).toBeEnabled();

    await user.click(within(summary).getByRole("button", { name: "Remove" }));
    expect(
      screen.queryByRole("region", { name: "Selected resume" }),
    ).not.toBeInTheDocument();

    await user.upload(input, selected);
    expect(
      screen.getByRole("region", { name: "Selected resume" }),
    ).toBeVisible();
  });

  it("supports keyboard activation of the native picker action", async () => {
    const user = userEvent.setup();
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(<ResumePage />);

    const chooseButton = screen.getByRole("button", { name: "Choose PDF" });
    chooseButton.focus();
    await user.keyboard("{Enter}");

    expect(chooseButton).toHaveFocus();
    expect(inputClick).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate submissions and exposes a stable processing state", async () => {
    const user = userEvent.setup();
    let resolveRequest: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<ResumePage />);

    await user.upload(getFileInput(), pdfFile());
    const submit = screen.getByRole("button", {
      name: "Extract resume text",
    });
    const form = submit.closest("form");
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Upload form was not rendered.");
    }
    await user.click(submit);
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("button", { name: "Processing resume…" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Replace" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
    expect(screen.getByText("Extracting resume text")).toBeVisible();

    resolveRequest?.(jsonResponse(successResult));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Resume text extracted" }),
      ).toBeVisible(),
    );
    expect(form).toHaveAttribute("aria-busy", "false");
  });

  it("renders successful extraction as inert plain text with exact metadata", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(successResult)),
    );
    render(<ResumePage />);

    await user.upload(getFileInput(), pdfFile());
    await user.click(
      screen.getByRole("button", { name: "Extract resume text" }),
    );

    const review = await screen.findByLabelText("Extracted plain text");
    const resultSection = screen
      .getByRole("heading", { name: "Resume text extracted" })
      .closest(".resume-result");
    if (!(resultSection instanceof HTMLElement)) {
      throw new Error("Extraction result was not rendered.");
    }
    expect(review).toHaveValue(extractedText);
    expect(document.querySelector("script")).toBeNull();
    expect(
      within(resultSection).getByText("fictional-resume.pdf"),
    ).toBeVisible();
    expect(
      within(resultSection).getByText("2", { selector: "dd" }),
    ).toBeVisible();
    expect(
      within(resultSection).getByText(extractedText.length.toString(), {
        selector: "dd",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/No AI analysis or structured portfolio extraction/i),
    ).toBeVisible();
    expect(screen.getByText(/review line breaks and spacing/i)).toBeVisible();
  });

  it("renders typed server errors and retries the same selected file", async () => {
    const user = userEvent.setup();
    const failure: ResumeExtractionResult = {
      ok: false,
      status: "unsupported_pdf",
      error: {
        code: "encrypted_pdf",
        message:
          "This PDF is password-protected or encrypted. Upload an unlocked copy.",
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(failure, 422))
      .mockResolvedValueOnce(jsonResponse(successResult));
    vi.stubGlobal("fetch", fetchMock);
    render(<ResumePage />);

    await user.upload(getFileInput(), pdfFile("locked.pdf"));
    await user.click(
      screen.getByRole("button", { name: "Extract resume text" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveFocus();
    expect(
      within(alert).getByText(/password-protected or encrypted/i),
    ).toBeVisible();
    expect(screen.getByText("locked.pdf")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Resume text extracted" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recovers from invalid or failed network responses without getting stuck", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>route failure</html>", {
          status: 500,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );
    render(<ResumePage />);

    await user.upload(getFileInput(), pdfFile());
    await user.click(
      screen.getByRole("button", { name: "Extract resume text" }),
    );

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText(/processing request could not be completed/i),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Replace" })).toBeEnabled();
  });
});

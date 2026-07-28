import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

import type {
  ResumeExtractionResult,
  ResumeExtractionSuccess,
} from "@/lib/resume/contracts";
import { normalizeProviderResumeDraft } from "@/lib/resume-draft/normalization";
import { readResumeTransferState } from "@/lib/resume-review/transfer-store";
import { validProviderResumeDraft } from "../../../tests/fixtures/resume-ai/fixtures";
import ResumePage from "./page";

const extractedText =
  "<script>alert('not markup')</script>\n" +
  "FICTIONAL RESUME\nTest Persona builds reliable tools and documents accessible workflows.";
const successResult: ResumeExtractionSuccess = {
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

function generatedDraft() {
  return normalizeProviderResumeDraft({
    providerOutput: structuredClone(validProviderResumeDraft),
    sourceText: extractedText,
    source: {
      filename: successResult.data.filename,
      pageCount: successResult.data.pageCount,
    },
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  navigation.push.mockReset();
  sessionStorage.clear();
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

  it("completes extraction after the development effect replay", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResult));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <StrictMode>
        <ResumePage />
      </StrictMode>,
    );

    await user.upload(getFileInput(), pdfFile());
    await user.click(
      screen.getByRole("button", { name: "Extract resume text" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Resume text extracted" }),
      ).toBeVisible(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: "Processing resume…" }),
    ).not.toBeInTheDocument();
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

  it("aborts a stalled extraction and returns to a retryable error state", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          requestSignal = init?.signal ?? undefined;
          requestSignal?.addEventListener(
            "abort",
            () => {
              reject(
                new DOMException("The request was aborted.", "AbortError"),
              );
            },
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<ResumePage />);

    fireEvent.change(getFileInput(), {
      target: { files: [pdfFile()] },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Extract resume text" }),
    );
    expect(screen.getByText("Extracting resume text")).toBeVisible();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestSignal?.aborted).toBe(true);
    expect(
      within(screen.getByRole("alert")).getByText(
        /Resume extraction took too long/i,
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Replace" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Processing resume…" }),
    ).not.toBeInTheDocument();
  });

  it("creates a draft only after explicit approval and transfers validated tab state", async () => {
    const user = userEvent.setup();
    vi.stubEnv("AI_RESUME_EXTRACTION_ENABLED", "true");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_RESUME_MODEL", "configured-model");
    let resolveDraft: ((response: Response) => void) | undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(successResult))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveDraft = resolve;
          }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<ResumePage />);

    await user.upload(getFileInput(), pdfFile());
    await user.click(
      screen.getByRole("button", { name: "Extract resume text" }),
    );
    const createDraftButton = await screen.findByRole("button", {
      name: "Create my portfolio draft",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(
      screen.getByText(/extracted text—not the original PDF/i),
    ).toBeVisible();

    await user.click(
      screen.getByText("What gets sent?", { selector: "summary" }),
    );
    expect(
      screen.getByText(/contact details present in the text may be included/i),
    ).toBeVisible();

    await user.click(createDraftButton);
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("Creating structured draft", { selector: "p" }),
    ).toBeVisible();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, requestInit] = fetchMock.mock.calls[1]!;
    const body = JSON.parse(String(requestInit?.body)) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({
      operation: "extract_resume",
      text: extractedText,
      source: {
        filename: "fictional-resume.pdf",
        pageCount: 2,
        characterCount: extractedText.length,
      },
    });
    expect(requestInit?.body).not.toBeInstanceOf(FormData);

    resolveDraft?.(
      new Response(JSON.stringify({ ok: true, data: generatedDraft() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith("/resume/review"),
    );
    expect(readResumeTransferState(sessionStorage)).toMatchObject({
      storageVersion: 1,
      extractedText,
      draft: { operation: "extract_resume" },
    });
  });

  it("keeps extracted text on an AI error and supports an explicit retry", async () => {
    const user = userEvent.setup();
    vi.stubEnv("AI_RESUME_EXTRACTION_ENABLED", "true");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_RESUME_MODEL", "configured-model");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(successResult))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "PROVIDER_RATE_LIMITED",
              message:
                "Resume drafting is busy right now. Try again in a moment.",
              retryable: true,
            },
          }),
          { status: 429 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, data: generatedDraft() }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<ResumePage />);

    await user.upload(getFileInput(), pdfFile());
    await user.click(
      screen.getByRole("button", { name: "Extract resume text" }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Create my portfolio draft",
      }),
    );

    expect(
      await screen.findByText(/Resume drafting is busy right now/i),
    ).toBeVisible();
    expect(screen.getByLabelText("Extracted plain text")).toHaveValue(
      extractedText,
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith("/resume/review"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

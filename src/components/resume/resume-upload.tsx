"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";

import {
  CLIENT_MAX_RESUME_FILE_BYTES,
  DEFAULT_RESUME_PROCESSING_LIMITS,
  isResumeExtractionResult,
  RESUME_UPLOAD_FIELD,
  type ResumeExtractionFailure,
  type ResumeExtractionSuccess,
} from "@/lib/resume/contracts";
import {
  RESUME_DRAFT_OPERATION,
  ResumeExtractionResponseV1Schema,
} from "@/lib/resume-draft/contracts";
import { createResumeExtractionFailure } from "@/lib/resume/errors";
import {
  clearResumeTransferState,
  createResumeTransferEnvelope,
  writeResumeTransferState,
} from "@/lib/resume-review/transfer-store";
import {
  formatFileSize,
  validateResumeFileSelection,
} from "@/lib/resume/selection";

import {
  ResumeGenerationDialog,
  type ResumeGenerationState,
} from "./resume-generation-dialog";

const NETWORK_FAILURE: ResumeExtractionFailure = {
  ok: false,
  status: "extraction_failure",
  error: {
    code: "internal_extraction_failure",
    message:
      "The processing request could not be completed. Check your connection and try again.",
  },
};

const EXTRACTION_REQUEST_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_FAILURE: ResumeExtractionFailure = {
  ok: false,
  status: "extraction_failure",
  error: {
    code: "internal_extraction_failure",
    message:
      "Resume extraction took too long. Try again or upload a smaller PDF.",
  },
};

function localFailure(
  code: ResumeExtractionFailure["error"]["code"],
): ResumeExtractionFailure {
  return createResumeExtractionFailure(code, DEFAULT_RESUME_PROCESSING_LIMITS);
}

export function ResumeUpload({ aiAvailable }: { aiAvailable: boolean }) {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [success, setSuccess] = useState<ResumeExtractionSuccess | null>(null);
  const [failure, setFailure] = useState<ResumeExtractionFailure | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [generation, setGeneration] = useState<ResumeGenerationState>({
    status: "idle",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createDraftButtonRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const generationInFlightRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const generationSequenceRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const generationAbortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const isGenerating =
    generation.status === "preparing" ||
    generation.status === "creating" ||
    generation.status === "validating";

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      generationAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (failure) {
      errorRef.current?.focus();
    }
  }, [failure]);

  const clearInputValue = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const selectFiles = (files: ArrayLike<File>) => {
    if (inFlightRef.current || generationInFlightRef.current) {
      return;
    }

    clearResumeTransferState(window.sessionStorage);
    requestSequenceRef.current += 1;
    setSuccess(null);
    setFailure(null);

    const selection = validateResumeFileSelection(files);
    if (!selection.ok) {
      setSelectedFile(null);
      setFailure(localFailure(selection.code));
      clearInputValue();
      return;
    }

    setSelectedFile(selection.file);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files;
    if (files) {
      selectFiles(files);
    }
    event.currentTarget.value = "";
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!inFlightRef.current && !generationInFlightRef.current) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }
    setIsDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (inFlightRef.current || generationInFlightRef.current) {
      return;
    }
    selectFiles(event.dataTransfer.files);
  };

  const openFilePicker = () => {
    if (inFlightRef.current || generationInFlightRef.current) {
      return;
    }
    clearInputValue();
    fileInputRef.current?.click();
  };

  const removeFile = () => {
    if (inFlightRef.current || generationInFlightRef.current) {
      return;
    }
    clearResumeTransferState(window.sessionStorage);
    requestSequenceRef.current += 1;
    setSelectedFile(null);
    setSuccess(null);
    setFailure(null);
    setIsDragActive(false);
    clearInputValue();
  };

  const replaceFile = () => {
    if (inFlightRef.current || generationInFlightRef.current) {
      return;
    }
    clearResumeTransferState(window.sessionStorage);
    setSuccess(null);
    setFailure(null);
    openFilePicker();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlightRef.current) {
      return;
    }
    if (!selectedFile) {
      setFailure(localFailure("missing_file"));
      return;
    }

    inFlightRef.current = true;
    setIsProcessing(true);
    setFailure(null);
    setSuccess(null);

    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      abortController.abort();
    }, EXTRACTION_REQUEST_TIMEOUT_MS);
    const formData = new FormData();
    formData.append(RESUME_UPLOAD_FIELD, selectedFile, selectedFile.name);

    const ownsRequest = () =>
      mountedRef.current &&
      requestSequenceRef.current === requestSequence &&
      abortControllerRef.current === abortController;
    const isCurrentRequest = () =>
      ownsRequest() && !abortController.signal.aborted;

    try {
      const response = await fetch("/api/resume/extract", {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      });
      const payload: unknown = await response.json();
      if (!isResumeExtractionResult(payload)) {
        throw new Error("Invalid resume extraction response.");
      }
      if (!isCurrentRequest()) {
        return;
      }

      if (payload.ok) {
        if (!response.ok) {
          throw new Error("Unexpected extraction response status.");
        }
        clearResumeTransferState(window.sessionStorage);
        setSuccess(payload);
      } else {
        setFailure(payload);
      }
    } catch (error) {
      if (ownsRequest()) {
        if (didTimeout) {
          setFailure(REQUEST_TIMEOUT_FAILURE);
        } else if (!(
          error instanceof DOMException && error.name === "AbortError"
        )) {
          setFailure(NETWORK_FAILURE);
        }
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (ownsRequest()) {
        setIsProcessing(false);
        abortControllerRef.current = null;
      }
      inFlightRef.current = false;
    }
  };

  const createDraft = useCallback(async () => {
    if (
      !success ||
      !aiAvailable ||
      generationInFlightRef.current ||
      inFlightRef.current
    ) {
      return;
    }

    generationInFlightRef.current = true;
    const sequence = generationSequenceRef.current + 1;
    generationSequenceRef.current = sequence;
    const abortController = new AbortController();
    generationAbortControllerRef.current = abortController;
    const isCurrentRequest = () =>
      mountedRef.current &&
      !abortController.signal.aborted &&
      generationSequenceRef.current === sequence &&
      generationAbortControllerRef.current === abortController;

    setGeneration({ status: "preparing" });

    try {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });
      if (!isCurrentRequest()) return;

      setGeneration({ status: "creating" });
      const response = await fetch("/api/resume/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: RESUME_DRAFT_OPERATION,
          text: success.data.text,
          source: {
            filename: success.data.filename,
            pageCount: success.data.pageCount,
            characterCount: success.data.characterCount,
          },
        }),
        signal: abortController.signal,
      });
      if (!isCurrentRequest()) return;

      setGeneration({ status: "validating" });
      const payload: unknown = await response.json();
      const parsed = ResumeExtractionResponseV1Schema.safeParse(payload);
      if (!parsed.success || (parsed.data.ok && !response.ok)) {
        setGeneration({
          status: "failed",
          failedStage: "validating",
          errorMessage:
            "The resume draft response could not be verified. Try again.",
          retryable: true,
        });
        return;
      }
      if (!parsed.data.ok) {
        setGeneration({
          status: "failed",
          failedStage: "creating",
          errorMessage: parsed.data.error.message,
          retryable: parsed.data.error.retryable,
        });
        return;
      }

      const envelope = createResumeTransferEnvelope({
        extractedText: success.data.text,
        draft: parsed.data.data,
      });
      if (!writeResumeTransferState(window.sessionStorage, envelope)) {
        setGeneration({
          status: "failed",
          failedStage: "validating",
          errorMessage:
            "The draft could not be saved in this browser tab. Return to the resume and try again.",
          retryable: false,
        });
        return;
      }

      router.push("/resume/review");
    } catch (error) {
      if (
        isCurrentRequest() &&
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        setGeneration({
          status: "failed",
          failedStage: "creating",
          errorMessage:
            "The drafting request could not be completed. Check your connection and try again.",
          retryable: true,
        });
      }
    } finally {
      if (isCurrentRequest()) {
        generationAbortControllerRef.current = null;
      }
      generationInFlightRef.current = false;
    }
  }, [aiAvailable, router, success]);

  const closeGenerationDialog = () => {
    setGeneration({ status: "idle" });
    window.setTimeout(() => createDraftButtonRef.current?.focus(), 0);
  };

  const statusMessage = isProcessing
    ? "Uploading resume. Validating the PDF and extracting text."
    : success
      ? `Resume text extracted from ${success.data.filename}.`
      : failure
        ? "Resume processing stopped. Review the error message."
        : selectedFile
          ? `${selectedFile.name} is ready for text extraction.`
          : "Choose one PDF resume to begin.";

  return (
    <main className="resume-main">
      <div className="resume-container">
        <section
          className="resume-page-intro"
          aria-labelledby="resume-page-title"
        >
          <p className="onboarding-eyebrow">Resume import</p>
          <h1 id="resume-page-title">Extract your resume text.</h1>
          <p>
            Upload a text-based PDF to validate it and review the exact plain
            text Tessera can read. You decide whether to turn it into a
            structured draft.
          </p>
        </section>

        <div className="resume-workspace">
          <form
            className="resume-upload-panel"
            aria-busy={isProcessing}
            onSubmit={handleSubmit}
          >
            <div
              className="resume-drop-zone"
              data-drag-active={isDragActive}
              data-disabled={isProcessing || isGenerating}
              onDragEnter={handleDragOver}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                id="resume-file"
                className="visually-hidden resume-native-input"
                type="file"
                accept=".pdf,application/pdf"
                tabIndex={-1}
                aria-label="Resume PDF"
                aria-describedby={`resume-file-guidance${failure ? " resume-upload-error" : ""}`}
                aria-invalid={failure ? "true" : undefined}
                disabled={isProcessing || isGenerating}
                onChange={handleFileChange}
              />
              <span className="resume-file-mark" aria-hidden="true">
                PDF
              </span>
              <div className="resume-drop-copy">
                <h2>
                  {isDragActive
                    ? "Release to select this PDF"
                    : "Drop your resume here"}
                </h2>
                <p id="resume-file-guidance">
                  One text-based PDF, up to{" "}
                  {formatFileSize(CLIENT_MAX_RESUME_FILE_BYTES)}.
                </p>
              </div>
              <button
                className="resume-select-button"
                type="button"
                disabled={isProcessing || isGenerating}
                onClick={openFilePicker}
              >
                Choose PDF
              </button>
            </div>

            {selectedFile ? (
              <section
                className="resume-selected-file"
                aria-label="Selected resume"
              >
                <div className="resume-selected-copy">
                  <span className="resume-selected-label">Selected PDF</span>
                  <strong>{selectedFile.name}</strong>
                  <span>{formatFileSize(selectedFile.size)}</span>
                </div>
                <div className="resume-selected-actions">
                  <button
                    type="button"
                    disabled={isProcessing || isGenerating}
                    onClick={replaceFile}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing || isGenerating}
                    onClick={removeFile}
                  >
                    Remove
                  </button>
                </div>
              </section>
            ) : null}

            {failure ? (
              <div
                ref={errorRef}
                id="resume-upload-error"
                className="resume-error"
                role="alert"
                tabIndex={-1}
              >
                <strong>Resume could not be processed</strong>
                <p>{failure.error.message}</p>
              </div>
            ) : null}

            {isProcessing ? (
              <div className="resume-processing-status">
                <span className="resume-processing-mark" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span>
                  <strong>Extracting resume text</strong>
                  <span>
                    Uploading, validating, and reading the PDF securely.
                  </span>
                </span>
              </div>
            ) : null}

            <div className="resume-form-actions">
              <button
                className="resume-primary-button"
                type="submit"
                disabled={!selectedFile || isProcessing}
              >
                {isProcessing
                  ? "Processing resume…"
                  : failure && selectedFile
                    ? "Try again"
                    : "Extract resume text"}
              </button>
            </div>

            <p className="visually-hidden" role="status" aria-live="polite">
              {statusMessage}
            </p>
          </form>

          <aside
            className="resume-privacy-panel"
            aria-labelledby="privacy-title"
          >
            <p className="resume-aside-index">01 / Private processing</p>
            <h2 id="privacy-title">Temporary by design.</h2>
            <p>
              Your PDF is processed temporarily on the Tessera server. The raw
              file is not permanently stored. No AI service is called while
              Tessera extracts the text.
            </p>
            <p>
              Avoid uploading information you do not want this application to
              process.
            </p>
          </aside>
        </div>

        {success ? (
          <section
            className="resume-result"
            aria-labelledby="resume-result-title"
          >
            <div className="resume-result-heading">
              <div>
                <p className="resume-success-label">Extraction complete</p>
                <h2 id="resume-result-title">Resume text extracted</h2>
                <p>
                  This is plain source text only. No AI analysis or structured
                  portfolio extraction has happened yet.
                </p>
              </div>
              <button
                className="resume-secondary-button"
                type="button"
                onClick={replaceFile}
              >
                Choose another PDF
              </button>
            </div>

            <dl className="resume-result-metadata">
              <div>
                <dt>File</dt>
                <dd>{success.data.filename}</dd>
              </div>
              <div>
                <dt>Pages</dt>
                <dd>{success.data.pageCount}</dd>
              </div>
              <div>
                <dt>Characters</dt>
                <dd>{success.data.characterCount.toLocaleString("en-US")}</dd>
              </div>
            </dl>

            {success.data.warnings.map((warning) => (
              <p className="resume-result-warning" key={warning.code}>
                {warning.message}
              </p>
            ))}

            <div className="resume-draft-action">
              {aiAvailable ? (
                <>
                  <button
                    ref={createDraftButtonRef}
                    className="resume-primary-button"
                    type="button"
                    disabled={isGenerating}
                    onClick={createDraft}
                  >
                    {isGenerating
                      ? "Creating portfolio draft…"
                      : "Create my portfolio draft"}
                  </button>
                  <p>
                    Tessera sends the extracted text—not the original PDF—to
                    organize portfolio information. Nothing is published until
                    you review and approve it.
                  </p>
                  <details className="resume-sent-disclosure">
                    <summary>What gets sent?</summary>
                    <p>
                      The extracted plain text is sent to the AI provider. The
                      original PDF is not sent. Contact details present in the
                      text may be included, but phone numbers and sensitive
                      address information are not public by default. The
                      temporary review draft expires from this tab after 30
                      minutes.
                    </p>
                  </details>
                </>
              ) : (
                <div className="resume-ai-unavailable" role="status">
                  <strong>Portfolio drafting isn’t available right now.</strong>
                  <p>
                    You can still review the extracted text or continue with the
                    builder without importing it.
                  </p>
                </div>
              )}
            </div>

            <label className="resume-text-label" htmlFor="resume-text-review">
              Extracted plain text
            </label>
            <textarea
              id="resume-text-review"
              className="resume-text-review"
              value={success.data.text}
              readOnly
              rows={18}
              spellCheck={false}
            />
          </section>
        ) : null}

        <nav className="resume-page-navigation" aria-label="Resume page">
          <Link href="/">Back to Tessera</Link>
          <Link href="/builder">Open builder without a resume</Link>
        </nav>
      </div>
      <ResumeGenerationDialog
        state={generation}
        onClose={closeGenerationDialog}
        onRetry={createDraft}
      />
    </main>
  );
}

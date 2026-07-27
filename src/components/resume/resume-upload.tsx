"use client";

import Link from "next/link";
import {
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
import { createResumeExtractionFailure } from "@/lib/resume/errors";
import {
  formatFileSize,
  validateResumeFileSelection,
} from "@/lib/resume/selection";

const NETWORK_FAILURE: ResumeExtractionFailure = {
  ok: false,
  status: "extraction_failure",
  error: {
    code: "internal_extraction_failure",
    message:
      "The processing request could not be completed. Check your connection and try again.",
  },
};

function localFailure(
  code: ResumeExtractionFailure["error"]["code"],
): ResumeExtractionFailure {
  return createResumeExtractionFailure(code, DEFAULT_RESUME_PROCESSING_LIMITS);
}

export function ResumeUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [success, setSuccess] = useState<ResumeExtractionSuccess | null>(null);
  const [failure, setFailure] = useState<ResumeExtractionFailure | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
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
    if (inFlightRef.current) {
      return;
    }

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
    if (!inFlightRef.current) {
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
    if (inFlightRef.current) {
      return;
    }
    selectFiles(event.dataTransfer.files);
  };

  const openFilePicker = () => {
    if (inFlightRef.current) {
      return;
    }
    clearInputValue();
    fileInputRef.current?.click();
  };

  const removeFile = () => {
    if (inFlightRef.current) {
      return;
    }
    requestSequenceRef.current += 1;
    setSelectedFile(null);
    setSuccess(null);
    setFailure(null);
    setIsDragActive(false);
    clearInputValue();
  };

  const replaceFile = () => {
    if (inFlightRef.current) {
      return;
    }
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
    const formData = new FormData();
    formData.append(RESUME_UPLOAD_FIELD, selectedFile, selectedFile.name);

    const isCurrentRequest = () =>
      mountedRef.current &&
      !abortController.signal.aborted &&
      requestSequenceRef.current === requestSequence &&
      abortControllerRef.current === abortController;

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
        setSuccess(payload);
      } else {
        setFailure(payload);
      }
    } catch (error) {
      if (
        isCurrentRequest() &&
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        setFailure(NETWORK_FAILURE);
      }
    } finally {
      if (isCurrentRequest()) {
        setIsProcessing(false);
        abortControllerRef.current = null;
      }
      inFlightRef.current = false;
    }
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
            text Tessera can read. Structured portfolio extraction comes later.
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
              data-disabled={isProcessing}
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
                disabled={isProcessing}
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
                disabled={isProcessing}
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
                    disabled={isProcessing}
                    onClick={replaceFile}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
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
              file is not permanently stored, and no AI service is called in
              this phase.
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
                  portfolio extraction has happened.
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
    </main>
  );
}

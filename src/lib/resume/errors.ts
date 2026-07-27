import type {
  ResumeExtractionErrorCode,
  ResumeExtractionFailure,
  ResumeExtractionFailureStatus,
  ResumeProcessingLimits,
} from "./contracts";
import { formatFileSize } from "./selection";

const HTTP_STATUS_BY_CODE = {
  missing_file: 400,
  empty_file: 400,
  unsupported_file_type: 415,
  file_too_large: 413,
  invalid_upload: 400,
  empty_pdf: 422,
  page_limit_exceeded: 422,
  text_limit_exceeded: 422,
  encrypted_pdf: 422,
  corrupted_pdf: 422,
  unreadable_pdf: 422,
  image_only_pdf: 422,
  no_meaningful_text: 422,
  internal_extraction_failure: 500,
} as const satisfies Record<ResumeExtractionErrorCode, number>;

const FAILURE_STATUS_BY_CODE = {
  missing_file: "validation_rejection",
  empty_file: "validation_rejection",
  unsupported_file_type: "validation_rejection",
  file_too_large: "validation_rejection",
  invalid_upload: "validation_rejection",
  empty_pdf: "unsupported_pdf",
  page_limit_exceeded: "validation_rejection",
  text_limit_exceeded: "validation_rejection",
  encrypted_pdf: "unsupported_pdf",
  corrupted_pdf: "unsupported_pdf",
  unreadable_pdf: "unsupported_pdf",
  image_only_pdf: "no_meaningful_text",
  no_meaningful_text: "no_meaningful_text",
  internal_extraction_failure: "extraction_failure",
} as const satisfies Record<
  ResumeExtractionErrorCode,
  ResumeExtractionFailureStatus
>;

export class ResumeProcessingError extends Error {
  readonly code: ResumeExtractionErrorCode;

  constructor(code: ResumeExtractionErrorCode) {
    super(code);
    this.name = "ResumeProcessingError";
    this.code = code;
  }
}

export function getResumeErrorHttpStatus(
  code: ResumeExtractionErrorCode,
): number {
  return HTTP_STATUS_BY_CODE[code];
}

function getResumeErrorMessage(
  code: ResumeExtractionErrorCode,
  limits: ResumeProcessingLimits,
): string {
  switch (code) {
    case "missing_file":
      return "Choose one PDF resume to continue.";
    case "empty_file":
      return "Choose a non-empty PDF resume.";
    case "unsupported_file_type":
      return "Choose a PDF file. Renamed or unsupported files cannot be processed.";
    case "file_too_large":
      return `Choose a PDF no larger than ${formatFileSize(limits.maxUploadBytes)}.`;
    case "invalid_upload":
      return "Choose exactly one PDF resume and try again.";
    case "empty_pdf":
      return "This PDF has no readable page content. Export a fresh text-based PDF and try again.";
    case "page_limit_exceeded":
      return `Choose a resume with no more than ${limits.maxPages} pages.`;
    case "text_limit_exceeded":
      return `The extracted text exceeds the ${limits.maxTextCharacters.toLocaleString("en-US")} character limit. Choose a shorter resume.`;
    case "encrypted_pdf":
      return "This PDF is password-protected or encrypted. Upload an unlocked copy.";
    case "corrupted_pdf":
      return "This PDF appears corrupted or incomplete. Export or download a fresh copy and try again.";
    case "unreadable_pdf":
      return "This PDF structure is not supported or could not be read. Export a fresh text-based PDF and try again.";
    case "image_only_pdf":
      return "No selectable text was found. Scanned or image-only PDFs need OCR, which is not available in this phase.";
    case "no_meaningful_text":
      return "Usable resume text could not be extracted. Upload a text-based PDF with selectable text.";
    case "internal_extraction_failure":
      return "Resume processing could not be completed. Try again with the same file or a fresh PDF.";
  }
}

export function createResumeExtractionFailure(
  code: ResumeExtractionErrorCode,
  limits: ResumeProcessingLimits,
): ResumeExtractionFailure {
  return {
    ok: false,
    status: FAILURE_STATUS_BY_CODE[code],
    error: {
      code,
      message: getResumeErrorMessage(code, limits),
    },
  };
}

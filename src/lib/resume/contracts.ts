export const RESUME_UPLOAD_FIELD = "resume";
export const CLIENT_MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024;

export const RESUME_EXTRACTION_ERROR_CODES = [
  "missing_file",
  "empty_file",
  "unsupported_file_type",
  "file_too_large",
  "invalid_upload",
  "empty_pdf",
  "page_limit_exceeded",
  "text_limit_exceeded",
  "encrypted_pdf",
  "corrupted_pdf",
  "unreadable_pdf",
  "image_only_pdf",
  "no_meaningful_text",
  "internal_extraction_failure",
] as const;

export type ResumeExtractionErrorCode =
  (typeof RESUME_EXTRACTION_ERROR_CODES)[number];

export type ResumeExtractionFailureStatus =
  | "validation_rejection"
  | "unsupported_pdf"
  | "no_meaningful_text"
  | "extraction_failure";

export type ResumeExtractionWarning = {
  code: "plain_text_layout";
  message: string;
};

export type ResumeExtractionSuccess = {
  ok: true;
  status: "success";
  data: {
    filename: string;
    pageCount: number;
    characterCount: number;
    text: string;
    warnings: ResumeExtractionWarning[];
  };
};

export type ResumeExtractionFailure = {
  ok: false;
  status: ResumeExtractionFailureStatus;
  error: {
    code: ResumeExtractionErrorCode;
    message: string;
  };
};

export type ResumeExtractionResult =
  ResumeExtractionSuccess | ResumeExtractionFailure;

export type ResumeProcessingLimits = {
  maxUploadBytes: number;
  maxPages: number;
  maxTextCharacters: number;
  minMeaningfulAlphanumericCharacters: number;
};

export const DEFAULT_RESUME_PROCESSING_LIMITS: ResumeProcessingLimits =
  Object.freeze({
    maxUploadBytes: CLIENT_MAX_RESUME_FILE_BYTES,
    maxPages: 20,
    maxTextCharacters: 200_000,
    minMeaningfulAlphanumericCharacters: 40,
  });

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isErrorCode(value: unknown): value is ResumeExtractionErrorCode {
  return (
    typeof value === "string" &&
    RESUME_EXTRACTION_ERROR_CODES.some((code) => code === value)
  );
}

function isFailureStatus(
  value: unknown,
): value is ResumeExtractionFailureStatus {
  return (
    value === "validation_rejection" ||
    value === "unsupported_pdf" ||
    value === "no_meaningful_text" ||
    value === "extraction_failure"
  );
}

function isWarning(value: unknown): value is ResumeExtractionWarning {
  return (
    isRecord(value) &&
    value.code === "plain_text_layout" &&
    typeof value.message === "string"
  );
}

export function isResumeExtractionResult(
  value: unknown,
): value is ResumeExtractionResult {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return false;
  }

  if (value.ok) {
    if (value.status !== "success" || !isRecord(value.data)) {
      return false;
    }

    return (
      typeof value.data.filename === "string" &&
      Number.isInteger(value.data.pageCount) &&
      (value.data.pageCount as number) > 0 &&
      Number.isInteger(value.data.characterCount) &&
      (value.data.characterCount as number) >= 0 &&
      typeof value.data.text === "string" &&
      value.data.characterCount === value.data.text.length &&
      Array.isArray(value.data.warnings) &&
      value.data.warnings.every(isWarning)
    );
  }

  return (
    isFailureStatus(value.status) &&
    isRecord(value.error) &&
    isErrorCode(value.error.code) &&
    typeof value.error.message === "string"
  );
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled resume extraction state: ${String(value)}`);
}

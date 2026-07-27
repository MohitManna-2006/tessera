import {
  CLIENT_MAX_RESUME_FILE_BYTES,
  type ResumeExtractionErrorCode,
} from "./contracts";

const SUPPORTED_PDF_MIME_TYPES = new Set(["application/pdf"]);
const PDF_HEADER = new TextEncoder().encode("%PDF-");

export type ResumeFileSelectionResult =
  { ok: true; file: File } | { ok: false; code: ResumeExtractionErrorCode };

export function hasPdfExtension(filename: string): boolean {
  return /\.pdf$/iu.test(filename.trim());
}

export function hasSupportedPdfMimeType(mimeType: string): boolean {
  return mimeType === "" || SUPPORTED_PDF_MIME_TYPES.has(mimeType);
}

export function hasPdfFileSignature(data: Uint8Array): boolean {
  const searchLength = Math.min(1024, data.length - PDF_HEADER.length + 1);
  for (let index = 0; index < searchLength; index += 1) {
    let matches = true;
    for (let offset = 0; offset < PDF_HEADER.length; offset += 1) {
      if (data[index + offset] !== PDF_HEADER[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return true;
    }
  }
  return false;
}

export function validateResumeFileSelection(
  files: ArrayLike<File>,
  maxUploadBytes = CLIENT_MAX_RESUME_FILE_BYTES,
): ResumeFileSelectionResult {
  if (files.length === 0) {
    return { ok: false, code: "missing_file" };
  }
  if (files.length !== 1) {
    return { ok: false, code: "invalid_upload" };
  }

  const file = files[0];
  if (!file) {
    return { ok: false, code: "missing_file" };
  }
  if (file.size === 0) {
    return { ok: false, code: "empty_file" };
  }
  if (file.size > maxUploadBytes) {
    return { ok: false, code: "file_too_large" };
  }
  if (!hasPdfExtension(file.name) || !hasSupportedPdfMimeType(file.type)) {
    return { ok: false, code: "unsupported_file_type" };
  }

  return { ok: true, file };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  }

  const units = ["KB", "MB", "GB"] as const;
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

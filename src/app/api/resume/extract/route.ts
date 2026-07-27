import type {
  ResumeExtractionErrorCode,
  ResumeExtractionFailure,
  ResumeProcessingLimits,
} from "@/lib/resume/contracts";
import { RESUME_UPLOAD_FIELD } from "@/lib/resume/contracts";
import {
  createResumeExtractionFailure,
  getResumeErrorHttpStatus,
} from "@/lib/resume/errors";
import { extractResumeText } from "@/lib/resume/extract.server";
import { getResumeProcessingLimits } from "@/lib/resume/server-config";
import {
  hasPdfExtension,
  hasPdfFileSignature,
  hasSupportedPdfMimeType,
} from "@/lib/resume/selection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MULTIPART_OVERHEAD_ALLOWANCE = 64 * 1024;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;

function failureResponse(
  code: ResumeExtractionErrorCode,
  limits: ResumeProcessingLimits,
) {
  const failure = createResumeExtractionFailure(code, limits);
  return Response.json(failure, {
    status: getResumeErrorHttpStatus(code),
    headers: NO_STORE_HEADERS,
  });
}

function isFile(value: FormDataEntryValue): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function" &&
    "name" in value &&
    typeof value.name === "string" &&
    "size" in value &&
    typeof value.size === "number" &&
    "type" in value &&
    typeof value.type === "string"
  );
}

function readSingleResumeFile(
  formData: FormData,
  limits: ResumeProcessingLimits,
): { ok: true; file: File } | { ok: false; failure: ResumeExtractionFailure } {
  const entries = Array.from(formData.entries());
  if (entries.length === 0) {
    return {
      ok: false,
      failure: createResumeExtractionFailure("missing_file", limits),
    };
  }
  if (
    entries.length !== 1 ||
    entries[0]?.[0] !== RESUME_UPLOAD_FIELD ||
    !isFile(entries[0][1])
  ) {
    return {
      ok: false,
      failure: createResumeExtractionFailure("invalid_upload", limits),
    };
  }
  return { ok: true, file: entries[0][1] };
}

export async function POST(request: Request) {
  const limits = getResumeProcessingLimits();
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return failureResponse("invalid_upload", limits);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > limits.maxUploadBytes + MULTIPART_OVERHEAD_ALLOWANCE
  ) {
    return failureResponse("file_too_large", limits);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failureResponse("invalid_upload", limits);
  }

  const upload = readSingleResumeFile(formData, limits);
  if (!upload.ok) {
    return Response.json(upload.failure, {
      status: getResumeErrorHttpStatus(upload.failure.error.code),
      headers: NO_STORE_HEADERS,
    });
  }
  const { file } = upload;
  if (file.size === 0) {
    return failureResponse("empty_file", limits);
  }
  if (file.size > limits.maxUploadBytes) {
    return failureResponse("file_too_large", limits);
  }
  if (!hasPdfExtension(file.name) || !hasSupportedPdfMimeType(file.type)) {
    return failureResponse("unsupported_file_type", limits);
  }

  let data: Uint8Array;
  try {
    data = new Uint8Array(await file.arrayBuffer());
  } catch {
    return failureResponse("invalid_upload", limits);
  }
  if (!hasPdfFileSignature(data)) {
    return failureResponse("unsupported_file_type", limits);
  }

  const result = await extractResumeText({
    data,
    filename: file.name,
    limits,
  });
  if (!result.ok) {
    return Response.json(result, {
      status: getResumeErrorHttpStatus(result.error.code),
      headers: NO_STORE_HEADERS,
    });
  }

  return Response.json(result, {
    status: 200,
    headers: NO_STORE_HEADERS,
  });
}

import {
  ResumeAiErrorCodeSchema,
  ResumeExtractionRequestV1Schema,
} from "@/lib/resume-draft/contracts";
import { getResumeAiConfig } from "@/lib/resume-ai/config.server";
import { OpenAiResumeProvider } from "@/lib/resume-ai/openai-provider.server";
import {
  createResumeAiFailure,
  generateResumeDraft,
  getResumeAiErrorHttpStatus,
} from "@/lib/resume-ai/service.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_JSON_REQUEST_BYTES = 70_000;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;

function responseForFailure(failure: ReturnType<typeof createResumeAiFailure>) {
  if (failure.ok) {
    return Response.json(createResumeAiFailure("UNKNOWN_ERROR"), {
      status: 500,
      headers: NO_STORE_HEADERS,
    });
  }
  const code = ResumeAiErrorCodeSchema.parse(failure.error.code);
  return Response.json(failure, {
    status: getResumeAiErrorHttpStatus(code),
    headers: NO_STORE_HEADERS,
  });
}

export async function POST(request: Request) {
  const contentType =
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() ?? "";
  if (contentType !== "application/json") {
    return responseForFailure(createResumeAiFailure("INVALID_INPUT"));
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_JSON_REQUEST_BYTES
  ) {
    return responseForFailure(createResumeAiFailure("INPUT_TOO_LARGE"));
  }

  let body: unknown;
  try {
    const serialized = await request.text();
    if (
      new TextEncoder().encode(serialized).byteLength > MAX_JSON_REQUEST_BYTES
    ) {
      return responseForFailure(createResumeAiFailure("INPUT_TOO_LARGE"));
    }
    body = JSON.parse(serialized);
  } catch {
    return responseForFailure(createResumeAiFailure("INVALID_INPUT"));
  }

  const parsed = ResumeExtractionRequestV1Schema.safeParse(body);
  if (!parsed.success) {
    const text =
      typeof body === "object" &&
      body !== null &&
      "text" in body &&
      typeof body.text === "string"
        ? body.text
        : null;
    if (text !== null && text.length > 60_000) {
      return responseForFailure(createResumeAiFailure("INPUT_TOO_LARGE"));
    }
    if (text !== null && text.trim().length < 80) {
      return responseForFailure(createResumeAiFailure("INPUT_TOO_SHORT"));
    }
    return responseForFailure(createResumeAiFailure("INVALID_INPUT"));
  }

  const config = getResumeAiConfig();
  const provider =
    config.apiKey !== null && config.model !== null
      ? new OpenAiResumeProvider({
          apiKey: config.apiKey,
          model: config.model,
        })
      : {
          extractResume: async () => {
            throw new Error("Provider is not configured.");
          },
        };
  const result = await generateResumeDraft({
    input: parsed.data,
    config,
    provider,
    clientSignal: request.signal,
  });

  if (!result.ok) {
    return responseForFailure(result);
  }
  return Response.json(result, {
    status: 200,
    headers: NO_STORE_HEADERS,
  });
}

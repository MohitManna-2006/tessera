import "server-only";

import { ZodError } from "zod";

import {
  RESUME_DRAFT_LIMITS,
  ResumeExtractionRequestV1Schema,
  type ResumeAiErrorCode,
  type ResumeExtractionRequestV1,
  type ResumeExtractionResponseV1,
} from "@/lib/resume-draft/contracts";
import {
  normalizeProviderResumeDraft,
  type TrustedIdFactory,
} from "@/lib/resume-draft/normalization";
import { analyzeMeaningfulResumeText } from "@/lib/resume/normalization";

import type { ResumeAiConfig } from "./config.server";
import {
  ResumeAiProviderError,
  type ResumeAiProvider,
} from "./provider.server";

const ERROR_DETAILS: Record<
  ResumeAiErrorCode,
  { message: string; retryable: boolean; status: number }
> = {
  FEATURE_DISABLED: {
    message: "AI resume drafting is not available.",
    retryable: false,
    status: 404,
  },
  INVALID_INPUT: {
    message: "The extracted resume data is invalid.",
    retryable: false,
    status: 400,
  },
  INPUT_TOO_SHORT: {
    message: "The extracted resume text is too short to structure reliably.",
    retryable: false,
    status: 422,
  },
  INPUT_TOO_LARGE: {
    message: "The extracted resume text is too long to process.",
    retryable: false,
    status: 413,
  },
  PROVIDER_TIMEOUT: {
    message: "Resume drafting took too long. Try again.",
    retryable: true,
    status: 504,
  },
  PROVIDER_UNAVAILABLE: {
    message: "Resume drafting is temporarily unavailable. Try again later.",
    retryable: true,
    status: 503,
  },
  PROVIDER_RATE_LIMITED: {
    message: "Resume drafting is busy right now. Try again in a moment.",
    retryable: true,
    status: 429,
  },
  INVALID_PROVIDER_OUTPUT: {
    message: "The resume draft could not be verified. Try again.",
    retryable: true,
    status: 502,
  },
  EVIDENCE_VALIDATION_FAILED: {
    message: "The resume evidence could not be verified. Try again.",
    retryable: true,
    status: 502,
  },
  CLIENT_ABORTED: {
    message: "Resume drafting was canceled.",
    retryable: true,
    status: 408,
  },
  UNKNOWN_ERROR: {
    message: "Resume drafting could not be completed. Try again.",
    retryable: true,
    status: 500,
  },
};

export function createResumeAiFailure(
  code: ResumeAiErrorCode,
): ResumeExtractionResponseV1 {
  const detail = ERROR_DETAILS[code];
  return {
    ok: false,
    error: {
      code,
      message: detail.message,
      retryable: detail.retryable,
    },
  };
}

export function getResumeAiErrorHttpStatus(code: ResumeAiErrorCode): number {
  return ERROR_DETAILS[code].status;
}

function classifyProviderFailure(
  error: unknown,
  timedOut: boolean,
  clientAborted: boolean,
): ResumeAiErrorCode {
  if (clientAborted) {
    return "CLIENT_ABORTED";
  }
  if (timedOut) {
    return "PROVIDER_TIMEOUT";
  }
  if (!(error instanceof ResumeAiProviderError)) {
    return "UNKNOWN_ERROR";
  }
  switch (error.kind) {
    case "rate_limit":
      return "PROVIDER_RATE_LIMITED";
    case "transient":
    case "unavailable":
      return "PROVIDER_UNAVAILABLE";
    case "invalid_output":
      return "INVALID_PROVIDER_OUTPUT";
  }
}

export type GenerateResumeDraftOptions = Readonly<{
  input: ResumeExtractionRequestV1;
  config: ResumeAiConfig;
  provider: ResumeAiProvider;
  clientSignal?: AbortSignal;
  now?: () => Date;
  createId?: TrustedIdFactory;
}>;

export async function generateResumeDraft({
  input,
  config,
  provider,
  clientSignal,
  now,
  createId,
}: GenerateResumeDraftOptions): Promise<ResumeExtractionResponseV1> {
  if (!config.enabled) {
    return createResumeAiFailure("FEATURE_DISABLED");
  }
  if (config.apiKey === null || config.model === null) {
    return createResumeAiFailure("PROVIDER_UNAVAILABLE");
  }

  const parsedInput = ResumeExtractionRequestV1Schema.safeParse(input);
  if (!parsedInput.success) {
    const text =
      typeof input === "object" &&
      input !== null &&
      "text" in input &&
      typeof input.text === "string"
        ? input.text
        : null;
    if (
      text !== null &&
      text.trim().length < RESUME_DRAFT_LIMITS.minInputCharacters
    ) {
      return createResumeAiFailure("INPUT_TOO_SHORT");
    }
    if (text !== null && text.length > RESUME_DRAFT_LIMITS.maxInputCharacters) {
      return createResumeAiFailure("INPUT_TOO_LARGE");
    }
    return createResumeAiFailure("INVALID_INPUT");
  }
  if (parsedInput.data.source.characterCount !== parsedInput.data.text.length) {
    return createResumeAiFailure("INVALID_INPUT");
  }
  if (
    !analyzeMeaningfulResumeText(
      parsedInput.data.text,
      RESUME_DRAFT_LIMITS.minInputCharacters,
    ).meaningful
  ) {
    return createResumeAiFailure("INPUT_TOO_SHORT");
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortForClient = () => controller.abort();
  if (clientSignal?.aborted) {
    return createResumeAiFailure("CLIENT_ABORTED");
  }
  clientSignal?.addEventListener("abort", abortForClient, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);

  try {
    let providerOutput;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        providerOutput = await provider.extractResume({
          text: parsedInput.data.text,
          signal: controller.signal,
        });
        break;
      } catch (error) {
        const clientAborted = clientSignal?.aborted === true;
        if (
          attempt === 0 &&
          error instanceof ResumeAiProviderError &&
          error.kind === "transient" &&
          !timedOut &&
          !clientAborted
        ) {
          continue;
        }
        return createResumeAiFailure(
          classifyProviderFailure(error, timedOut, clientAborted),
        );
      }
    }

    if (providerOutput === undefined) {
      return createResumeAiFailure("UNKNOWN_ERROR");
    }

    try {
      const draft = normalizeProviderResumeDraft({
        providerOutput,
        sourceText: parsedInput.data.text,
        source: {
          filename: parsedInput.data.source.filename,
          pageCount: parsedInput.data.source.pageCount,
        },
        now,
        createId,
      });
      return { ok: true, data: draft };
    } catch (error) {
      if (error instanceof ZodError) {
        return createResumeAiFailure("INVALID_PROVIDER_OUTPUT");
      }
      return createResumeAiFailure("UNKNOWN_ERROR");
    }
  } finally {
    clearTimeout(timeout);
    clientSignal?.removeEventListener("abort", abortForClient);
  }
}

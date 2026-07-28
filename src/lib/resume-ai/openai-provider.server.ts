import "server-only";

import { z } from "zod";

import {
  ProviderResumeDraftV1Schema,
  type ProviderResumeDraftV1,
} from "@/lib/resume-draft/provider-contract";

import {
  createResumeAiUserPrompt,
  RESUME_AI_SYSTEM_PROMPT,
} from "./prompt.server";
import {
  ResumeAiProviderError,
  type ResumeAiProvider,
  type ResumeAiProviderRequest,
} from "./provider.server";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

type FetchLike = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractOutputText(response: unknown): string {
  if (!isRecord(response)) {
    throw new ResumeAiProviderError("invalid_output");
  }
  if (response.status !== "completed") {
    throw new ResumeAiProviderError("invalid_output");
  }

  if (typeof response.output_text === "string") {
    return response.output_text;
  }
  if (!Array.isArray(response.output)) {
    throw new ResumeAiProviderError("invalid_output");
  }

  for (const output of response.output) {
    if (!isRecord(output) || !Array.isArray(output.content)) {
      continue;
    }
    for (const content of output.content) {
      if (!isRecord(content)) {
        continue;
      }
      if (content.type === "refusal") {
        throw new ResumeAiProviderError("invalid_output");
      }
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  throw new ResumeAiProviderError("invalid_output");
}

function classifyHttpFailure(status: number): ResumeAiProviderError {
  if (status === 429) {
    return new ResumeAiProviderError("rate_limit");
  }
  if (status >= 500) {
    return new ResumeAiProviderError("transient");
  }
  return new ResumeAiProviderError("unavailable");
}

export class OpenAiResumeProvider implements ResumeAiProvider {
  readonly #apiKey: string;
  readonly #model: string;
  readonly #fetch: FetchLike;

  constructor({
    apiKey,
    model,
    fetchImpl = fetch,
  }: {
    apiKey: string;
    model: string;
    fetchImpl?: FetchLike;
  }) {
    this.#apiKey = apiKey;
    this.#model = model;
    this.#fetch = fetchImpl;
  }

  async extractResume({
    text,
    signal,
  }: ResumeAiProviderRequest): Promise<ProviderResumeDraftV1> {
    let response: Response;
    try {
      response = await this.#fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.#model,
          store: false,
          input: [
            { role: "system", content: RESUME_AI_SYSTEM_PROMPT },
            { role: "user", content: createResumeAiUserPrompt(text) },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "tessera_resume_draft_v1",
              schema: z.toJSONSchema(ProviderResumeDraftV1Schema),
              strict: true,
            },
          },
          max_output_tokens: 12_000,
        }),
        signal,
      });
    } catch (error) {
      if (error instanceof ResumeAiProviderError) {
        throw error;
      }
      throw new ResumeAiProviderError("transient");
    }

    if (!response.ok) {
      throw classifyHttpFailure(response.status);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ResumeAiProviderError("invalid_output");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractOutputText(payload));
    } catch (error) {
      if (error instanceof ResumeAiProviderError) {
        throw error;
      }
      throw new ResumeAiProviderError("invalid_output");
    }

    const result = ProviderResumeDraftV1Schema.safeParse(parsed);
    if (!result.success) {
      throw new ResumeAiProviderError("invalid_output");
    }
    return result.data;
  }
}

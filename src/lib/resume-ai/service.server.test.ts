// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ResumeExtractionRequestV1 } from "@/lib/resume-draft/contracts";
import {
  experiencedEngineerResumeText,
  validProviderResumeDraft,
} from "../../../tests/fixtures/resume-ai/fixtures";
import type { ResumeAiConfig } from "./config.server";
import {
  ResumeAiProviderError,
  type ResumeAiProvider,
} from "./provider.server";
import { generateResumeDraft } from "./service.server";

const input: ResumeExtractionRequestV1 = {
  operation: "extract_resume",
  text: experiencedEngineerResumeText,
  source: {
    filename: "synthetic-resume.pdf",
    pageCount: 1,
    characterCount: experiencedEngineerResumeText.length,
  },
};

const config: ResumeAiConfig = {
  enabled: true,
  apiKey: "test-key",
  model: "configured-model",
  timeoutMs: 1_000,
};

function providerFrom(
  extractResume: ResumeAiProvider["extractResume"],
): ResumeAiProvider {
  return { extractResume };
}

describe("resume AI service", () => {
  it("normalizes a valid provider draft into trusted application IDs", async () => {
    const extractResume = vi.fn(async () =>
      structuredClone(validProviderResumeDraft),
    );
    const result = await generateResumeDraft({
      input,
      config,
      provider: providerFrom(extractResume),
      now: () => new Date("2026-07-27T12:00:00.000Z"),
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        schemaVersion: 1,
        operation: "extract_resume",
        source: { filename: "synthetic-resume.pdf" },
        generatedAt: "2026-07-27T12:00:00.000Z",
      },
    });
    expect(extractResume).toHaveBeenCalledOnce();
    if (result.ok) {
      expect(result.data.draftId).toMatch(/^draft_/u);
      expect(result.data.evidence[0]?.id).toMatch(/^evidence_/u);
    }
  });

  it("retries one transient failure inside the same request", async () => {
    const extractResume = vi
      .fn()
      .mockRejectedValueOnce(new ResumeAiProviderError("transient"))
      .mockResolvedValueOnce(structuredClone(validProviderResumeDraft));

    const result = await generateResumeDraft({
      input,
      config,
      provider: providerFrom(extractResume),
    });

    expect(result.ok).toBe(true);
    expect(extractResume).toHaveBeenCalledTimes(2);
  });

  it("stops after the second transient failure", async () => {
    const extractResume = vi.fn(async () => {
      throw new ResumeAiProviderError("transient");
    });

    const result = await generateResumeDraft({
      input,
      config,
      provider: providerFrom(extractResume),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "PROVIDER_UNAVAILABLE", retryable: true },
    });
    expect(extractResume).toHaveBeenCalledTimes(2);
  });

  it("does not retry a rate limit, invalid input, or disabled feature", async () => {
    const rateLimited = vi.fn(async () => {
      throw new ResumeAiProviderError("rate_limit");
    });
    const rateResult = await generateResumeDraft({
      input,
      config,
      provider: providerFrom(rateLimited),
    });
    expect(rateResult).toMatchObject({
      ok: false,
      error: { code: "PROVIDER_RATE_LIMITED" },
    });
    expect(rateLimited).toHaveBeenCalledOnce();

    const neverCalled = vi.fn(async () =>
      structuredClone(validProviderResumeDraft),
    );
    const invalidResult = await generateResumeDraft({
      input: { ...input, text: "Too short" },
      config,
      provider: providerFrom(neverCalled),
    });
    const disabledResult = await generateResumeDraft({
      input,
      config: { ...config, enabled: false },
      provider: providerFrom(neverCalled),
    });
    expect(invalidResult).toMatchObject({
      ok: false,
      error: { code: "INPUT_TOO_SHORT", retryable: false },
    });
    expect(disabledResult).toMatchObject({
      ok: false,
      error: { code: "FEATURE_DISABLED", retryable: false },
    });
    expect(neverCalled).not.toHaveBeenCalled();
  });

  it("enforces one total timeout and aborts provider work", async () => {
    const extractResume = vi.fn(
      ({ signal }: Parameters<ResumeAiProvider["extractResume"]>[0]) =>
        new Promise<never>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new ResumeAiProviderError("transient")),
            { once: true },
          );
        }),
    );

    const result = await generateResumeDraft({
      input,
      config: { ...config, timeoutMs: 5 },
      provider: providerFrom(extractResume),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "PROVIDER_TIMEOUT", retryable: true },
    });
    expect(extractResume).toHaveBeenCalledOnce();
  });

  it("sanitizes provider errors without echoing resume text", async () => {
    const extractResume = vi.fn(async () => {
      throw new Error(`private provider failure: ${input.text}`);
    });
    const result = await generateResumeDraft({
      input,
      config,
      provider: providerFrom(extractResume),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "UNKNOWN_ERROR" },
    });
    expect(JSON.stringify(result)).not.toContain(input.text);
  });
});

// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DEFAULT_RESUME_AI_TIMEOUT_MS,
  isResumeAiAvailable,
  parseResumeAiConfig,
} from "./config.server";

describe("resume AI configuration", () => {
  it("defaults to disabled without guessing secrets or a model", () => {
    const config = parseResumeAiConfig({});

    expect(config).toEqual({
      enabled: false,
      apiKey: null,
      model: null,
      timeoutMs: DEFAULT_RESUME_AI_TIMEOUT_MS,
    });
    expect(isResumeAiAvailable(config)).toBe(false);
  });

  it("is available only when explicitly enabled and fully configured", () => {
    const config = parseResumeAiConfig({
      AI_RESUME_EXTRACTION_ENABLED: "true",
      OPENAI_API_KEY: " project-key ",
      OPENAI_RESUME_MODEL: " configured-model ",
    });

    expect(config).toMatchObject({
      enabled: true,
      apiKey: "project-key",
      model: "configured-model",
    });
    expect(isResumeAiAvailable(config)).toBe(true);
  });

  it.each(["TRUE", "1", "yes", "false"])(
    "does not enable the feature for %s",
    (value) => {
      expect(
        parseResumeAiConfig({
          AI_RESUME_EXTRACTION_ENABLED: value,
          OPENAI_API_KEY: "key",
          OPENAI_RESUME_MODEL: "model",
        }).enabled,
      ).toBe(false);
    },
  );
});

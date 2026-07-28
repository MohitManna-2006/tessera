// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  config: {
    enabled: false,
    apiKey: null as string | null,
    model: null as string | null,
    timeoutMs: 1_000,
  },
  extractResume: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/resume-ai/config.server", () => ({
  getResumeAiConfig: () => ({ ...mocks.config }),
}));
vi.mock("@/lib/resume-ai/openai-provider.server", () => ({
  OpenAiResumeProvider: class {
    extractResume = mocks.extractResume;
  },
}));

import {
  experiencedEngineerResumeText,
  validProviderResumeDraft,
} from "../../../../../tests/fixtures/resume-ai/fixtures";
import { POST } from "./route";

function request(body: unknown, contentType = "application/json") {
  return new Request("http://localhost/api/resume/draft", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: JSON.stringify(body),
  });
}

const validRequest = {
  operation: "extract_resume",
  text: experiencedEngineerResumeText,
  source: {
    filename: "synthetic-resume.pdf",
    pageCount: 1,
    characterCount: experiencedEngineerResumeText.length,
  },
};

afterEach(() => {
  mocks.config.enabled = false;
  mocks.config.apiKey = null;
  mocks.config.model = null;
  mocks.extractResume.mockReset();
});

describe("resume draft route", () => {
  it("is unavailable by default with no-store response headers", async () => {
    const response = await POST(request(validRequest));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(body).toMatchObject({
      ok: false,
      error: { code: "FEATURE_DISABLED", retryable: false },
    });
    expect(mocks.extractResume).not.toHaveBeenCalled();
  });

  it("rejects arbitrary operations, unknown keys, and non-JSON bodies", async () => {
    const arbitrary = await POST(
      request({ ...validRequest, operation: "write_code" }),
    );
    const unknown = await POST(request({ ...validRequest, model: "client" }));
    const nonJson = await POST(request(validRequest, "text/plain"));
    const jsonPatch = await POST(
      request(validRequest, "application/json-patch+json"),
    );

    for (const response of [arbitrary, unknown, nonJson, jsonPatch]) {
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        ok: false,
        error: { code: "INVALID_INPUT" },
      });
    }
    expect(mocks.extractResume).not.toHaveBeenCalled();
  });

  it("returns only the validated normalized draft when configured", async () => {
    mocks.config.enabled = true;
    mocks.config.apiKey = "test-key";
    mocks.config.model = "configured-model";
    mocks.extractResume.mockResolvedValue(
      structuredClone(validProviderResumeDraft),
    );

    const response = await POST(request(validRequest));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      data: {
        schemaVersion: 1,
        operation: "extract_resume",
        source: { filename: "synthetic-resume.pdf" },
      },
    });
    expect(JSON.stringify(body)).not.toContain("test-key");
    expect(JSON.stringify(body)).not.toContain("configured-model");
    expect(mocks.extractResume).toHaveBeenCalledOnce();
  });

  it("rejects short and oversized inputs before provider invocation", async () => {
    const short = await POST(
      request({
        ...validRequest,
        text: "Too short",
        source: { ...validRequest.source, characterCount: 9 },
      }),
    );
    const overLimitText = "A".repeat(60_001);
    const oversized = await POST(
      request({
        ...validRequest,
        text: overLimitText,
        source: {
          ...validRequest.source,
          characterCount: overLimitText.length,
        },
      }),
    );

    expect(short.status).toBe(422);
    expect(await short.json()).toMatchObject({
      error: { code: "INPUT_TOO_SHORT" },
    });
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toMatchObject({
      error: { code: "INPUT_TOO_LARGE" },
    });
    expect(mocks.extractResume).not.toHaveBeenCalled();
  });

  it("enforces the total serialized request bound without trusting content-length", async () => {
    const response = await POST(
      request({
        ...validRequest,
        unexpectedPadding: "A".repeat(70_001),
      }),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: "INPUT_TOO_LARGE" },
    });
    expect(mocks.extractResume).not.toHaveBeenCalled();
  });
});

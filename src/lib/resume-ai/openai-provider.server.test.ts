// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  experiencedEngineerResumeText,
  validProviderResumeDraft,
} from "../../../tests/fixtures/resume-ai/fixtures";
import { OpenAiResumeProvider } from "./openai-provider.server";
function completedResponse(output: unknown = validProviderResumeDraft) {
  return new Response(
    JSON.stringify({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify(output),
            },
          ],
        },
      ],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

describe("OpenAI resume provider", () => {
  it("uses the Responses API strict schema without exposing client controls", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValue(completedResponse());
    const provider = new OpenAiResumeProvider({
      apiKey: "test-project-key",
      model: "configured-model",
      fetchImpl,
    });

    const result = await provider.extractResume({
      text: experiencedEngineerResumeText,
      signal: new AbortController().signal,
    });

    expect(result.profile.name.value).toBe("Alex Rivera");
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-project-key",
      "Content-Type": "application/json",
    });
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "configured-model",
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "tessera_resume_draft_v1",
          strict: true,
        },
      },
      max_output_tokens: 12_000,
    });
    expect(body).not.toHaveProperty("tools");
    expect(body.input).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining(experiencedEngineerResumeText),
        }),
      ]),
    );
    expect(JSON.stringify(body)).not.toContain("synthetic-resume.pdf");
  });

  it.each([
    { status: 429, kind: "rate_limit" },
    { status: 500, kind: "transient" },
    { status: 401, kind: "unavailable" },
  ] as const)("classifies provider HTTP $status", async ({ status, kind }) => {
    const provider = new OpenAiResumeProvider({
      apiKey: "key",
      model: "model",
      fetchImpl: vi.fn(async () => new Response("private body", { status })),
    });

    await expect(
      provider.extractResume({
        text: experiencedEngineerResumeText,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ kind });
  });

  it("rejects refusals and schema-invalid successful output", async () => {
    const refusal = new OpenAiResumeProvider({
      apiKey: "key",
      model: "model",
      fetchImpl: vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: "completed",
              output: [
                {
                  content: [{ type: "refusal", refusal: "Cannot comply." }],
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    });
    const malformed = new OpenAiResumeProvider({
      apiKey: "key",
      model: "model",
      fetchImpl: vi.fn(async () => completedResponse({ profile: {} })),
    });

    for (const provider of [refusal, malformed]) {
      await expect(
        provider.extractResume({
          text: experiencedEngineerResumeText,
          signal: new AbortController().signal,
        }),
      ).rejects.toMatchObject({ kind: "invalid_output" });
    }
  });
});

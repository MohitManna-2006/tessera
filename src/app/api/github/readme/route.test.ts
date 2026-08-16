import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import { clearGitHubCache } from "@/lib/github/client.server";
import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/github/readme", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/github/readme", () => {
  beforeEach(() => {
    clearGitHubCache();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns 400 for invalid body", async () => {
    const res = await POST(jsonRequest({ username: "octocat" }));
    expect(res.status).toBe(400);
  });

  it("returns readme for repo with content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("hello readme", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );
    const res = await POST(jsonRequest({ username: "octocat", repo: "hello" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { readme: { content: string } };
    expect(json.readme.content).toBe("hello readme");
  });

  it("returns empty readme for 404 (no readme)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 404 })),
    );
    const res = await POST(
      jsonRequest({ username: "octocat", repo: "no-readme" }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { readme: { content: string } };
    expect(json.readme.content).toBe("");
  });

  it("truncates large readme", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("a".repeat(200_000), {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );
    // Mock limit 100k by default — should truncate
    const res = await POST(jsonRequest({ username: "octocat", repo: "big" }));
    const json = (await res.json()) as {
      readme: { truncated: boolean; content: string };
    };
    expect(json.readme.truncated).toBe(true);
    expect(json.readme.content.length).toBe(100_000);
  });

  it("returns 429 for rate_limited", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("rate", {
          status: 429,
          headers: { "retry-after": "5" },
        }),
      ),
    );
    const res = await POST(jsonRequest({ username: "octocat", repo: "hello" }));
    expect(res.status).toBe(429);
  });
});

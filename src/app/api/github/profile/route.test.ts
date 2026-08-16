import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import { clearGitHubCache } from "@/lib/github/client.server";
import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/github/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/github/profile", () => {
  beforeEach(() => {
    clearGitHubCache();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns 415 for wrong content-type", async () => {
    const res = await POST(
      new Request("http://localhost/api/github/profile", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ username: "octocat" }),
      }),
    );
    expect(res.status).toBe(415);
  });

  it("returns 400 for invalid username", async () => {
    const res = await POST(jsonRequest({ username: "-bad" }));
    expect(res.status).toBe(400);
  });

  it("returns profile on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            login: "octocat",
            name: "Octocat",
            avatar_url: "https://github.com/octocat.png",
            bio: "bio",
            html_url: "https://github.com/octocat",
            public_repos: 5,
            followers: 10,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const res = await POST(jsonRequest({ username: "octocat" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    const json = (await res.json()) as { profile: { login: string } };
    expect(json.profile.login).toBe("octocat");
  });

  it("returns 404 for not_found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not found", { status: 404 })),
    );
    const res = await POST(jsonRequest({ username: "missinguser123" }));
    expect(res.status).toBe(404);
  });

  it("returns 429 for rate_limited", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("rate", {
          status: 429,
          headers: { "retry-after": "10" },
        }),
      ),
    );
    const res = await POST(jsonRequest({ username: "octocat" }));
    expect(res.status).toBe(429);
    const json = (await res.json()) as { retryAfterMs: number };
    expect(json.retryAfterMs).toBe(10000);
  });
});

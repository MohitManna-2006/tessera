import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import { clearGitHubCache } from "@/lib/github/client.server";
import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/github/repos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const repoFixture = {
  id: 1,
  name: "hello",
  full_name: "octocat/hello",
  description: "desc",
  html_url: "https://github.com/octocat/hello",
  stargazers_count: 5,
  forks_count: 1,
  language: "TypeScript",
  topics: ["nextjs"],
  updated_at: "2024-01-01T00:00:00Z",
  fork: false,
  archived: false,
};

describe("POST /api/github/repos", () => {
  beforeEach(() => {
    clearGitHubCache();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns 400 for invalid username", async () => {
    const res = await POST(jsonRequest({ username: "" }));
    expect(res.status).toBe(400);
  });

  it("returns repos on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([repoFixture]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const res = await POST(jsonRequest({ username: "octocat" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { repos: unknown[] };
    expect(json.repos.length).toBe(1);
  });

  it("clamps perPage to max", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(jsonRequest({ username: "octocat", perPage: 200 }));
    expect(res.status).toBe(200);
    // fetch should have been called with clamped per_page=100 in URL
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain("per_page=100");
  });

  it("returns 404 for not_found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 404 })),
    );
    const res = await POST(jsonRequest({ username: "missing" }));
    expect(res.status).toBe(404);
  });
});

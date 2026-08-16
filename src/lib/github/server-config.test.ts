import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DEFAULT_GITHUB_LIMITS,
  getGitHubToken,
  parseGitHubLimits,
} from "./server-config";

describe("parseGitHubLimits", () => {
  it("returns defaults when env is empty", () => {
    expect(parseGitHubLimits({})).toEqual(DEFAULT_GITHUB_LIMITS);
  });

  it("parses valid bounded integers", () => {
    expect(
      parseGitHubLimits({
        GITHUB_MAX_SELECTED_REPOS: "3",
        GITHUB_MAX_REPOS: "50",
        GITHUB_MAX_README_BYTES: "50000",
        GITHUB_REQUEST_TIMEOUT_MS: "5000",
      }),
    ).toEqual({
      maxSelectedRepos: 3,
      maxRepos: 50,
      maxReadmeBytes: 50000,
      requestTimeoutMs: 5000,
      cacheTtlMs: 60_000,
    });
  });

  it("falls back on invalid, zero, negative, non-integer, out-of-range", () => {
    expect(
      parseGitHubLimits({
        GITHUB_MAX_SELECTED_REPOS: "0",
        GITHUB_MAX_REPOS: "-1",
        GITHUB_MAX_README_BYTES: "abc",
        GITHUB_REQUEST_TIMEOUT_MS: "999999",
      }),
    ).toEqual(DEFAULT_GITHUB_LIMITS);

    expect(
      parseGitHubLimits({
        GITHUB_MAX_SELECTED_REPOS: "11",
        GITHUB_MAX_REPOS: "101",
        GITHUB_MAX_README_BYTES: "500",
        GITHUB_REQUEST_TIMEOUT_MS: "0",
      }),
    ).toEqual(DEFAULT_GITHUB_LIMITS);
  });
});

describe("getGitHubToken", () => {
  it("returns null when missing or blank", () => {
    expect(getGitHubToken({})).toBeNull();
    expect(getGitHubToken({ GITHUB_TOKEN: "   " })).toBeNull();
  });

  it("returns trimmed token when valid", () => {
    expect(
      getGitHubToken({ GITHUB_TOKEN: "ghp_12345678901234567890abcdef" }),
    ).toBe("ghp_12345678901234567890abcdef");
  });

  it("rejects token with whitespace or too short", () => {
    expect(getGitHubToken({ GITHUB_TOKEN: "short" })).toBeNull();
    expect(getGitHubToken({ GITHUB_TOKEN: "ghp abc def" })).toBeNull();
  });
});

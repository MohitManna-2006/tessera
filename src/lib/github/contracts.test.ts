import { describe, expect, it } from "vitest";

import {
  GitHubProfileV1Schema,
  GitHubRepoV1Schema,
  GitHubUsernameSchema,
} from "./contracts";

describe("GitHubUsernameSchema", () => {
  it("accepts valid usernames", () => {
    expect(GitHubUsernameSchema.safeParse("octocat").success).toBe(true);
    expect(GitHubUsernameSchema.safeParse("a").success).toBe(true);
    expect(GitHubUsernameSchema.safeParse("my-user-123").success).toBe(true);
  });

  it("rejects invalid usernames", () => {
    expect(GitHubUsernameSchema.safeParse("").success).toBe(false);
    expect(GitHubUsernameSchema.safeParse("-start").success).toBe(false);
    expect(GitHubUsernameSchema.safeParse("end-").success).toBe(false);
    expect(GitHubUsernameSchema.safeParse("a".repeat(40)).success).toBe(false);
    expect(GitHubUsernameSchema.safeParse("has space").success).toBe(false);
  });
});

describe("GitHubProfileV1Schema", () => {
  it("validates profile", () => {
    expect(
      GitHubProfileV1Schema.safeParse({
        login: "octocat",
        name: "Octo",
        avatarUrl: "https://example.com/avatar.png",
        bio: "bio",
        htmlUrl: "https://github.com/octocat",
        publicRepos: 5,
        followers: 100,
      }).success,
    ).toBe(true);
  });
});

describe("GitHubRepoV1Schema", () => {
  it("validates repo", () => {
    expect(
      GitHubRepoV1Schema.safeParse({
        id: "123",
        name: "my-repo",
        fullName: "octocat/my-repo",
        description: "desc",
        htmlUrl: "https://github.com/octocat/my-repo",
        stargazersCount: 10,
        forksCount: 2,
        primaryLanguage: "TypeScript",
        topics: ["nextjs"],
        updatedAt: new Date().toISOString(),
        isFork: false,
        isArchived: false,
      }).success,
    ).toBe(true);
  });

  it("rejects too many topics", () => {
    expect(
      GitHubRepoV1Schema.safeParse({
        id: "1",
        name: "a",
        fullName: "a/b",
        description: null,
        htmlUrl: "https://github.com/a/b",
        stargazersCount: 0,
        forksCount: 0,
        primaryLanguage: null,
        topics: Array.from({ length: 33 }, (_, i) => `t${i}`),
        updatedAt: new Date().toISOString(),
        isFork: false,
        isArchived: false,
      }).success,
    ).toBe(false);
  });
});

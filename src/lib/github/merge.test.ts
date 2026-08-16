import { describe, expect, it } from "vitest";

import { createPortfolioDraft } from "@/lib/portfolio";
import { createGitHubEnvelope } from "./persistence";
import { mergeGitHubIntoPortfolio } from "./merge";

function makeRepo(id: string, name: string, desc: string) {
  return {
    id,
    name,
    fullName: `octocat/${name}`,
    description: desc,
    htmlUrl: `https://github.com/octocat/${name}`,
    stargazersCount: 10,
    forksCount: 2,
    primaryLanguage: "TypeScript",
    topics: ["nextjs", "react"],
    updatedAt: new Date().toISOString(),
    isFork: false,
    isArchived: false,
  };
}

describe("mergeGitHubIntoPortfolio", () => {
  it("returns base when no envelope", () => {
    const base = createPortfolioDraft();
    expect(mergeGitHubIntoPortfolio(base, null)).toEqual(base);
  });

  it("merges selected repos into projects", () => {
    const base = createPortfolioDraft();
    const envelope = createGitHubEnvelope({
      username: "octocat",
      profile: {
        login: "octocat",
        name: "Octo",
        avatarUrl: null,
        bio: null,
        htmlUrl: "https://github.com/octocat",
        publicRepos: 5,
        followers: 10,
      },
      repos: [
        makeRepo("1", "alpha", "Alpha desc. Second sentence."),
        makeRepo("2", "beta", "Beta desc"),
      ],
      selectedRepoIds: ["1", "2"],
      readmes: {},
    });

    const merged = mergeGitHubIntoPortfolio(base, envelope);
    expect(merged.projects[0]?.name).toBe("alpha");
    expect(merged.projects[1]?.name).toBe("beta");
    expect(merged.projects[0]?.repositoryUrl).toBe(
      "https://github.com/octocat/alpha",
    );
    expect(merged.links.githubUrl).toBe("https://github.com/octocat");
  });

  it("keeps base projects when selection empty", () => {
    const base = createPortfolioDraft();
    const envelope = createGitHubEnvelope({
      username: "octocat",
      profile: null,
      repos: [makeRepo("1", "alpha", "desc")],
      selectedRepoIds: [],
      readmes: {},
    });
    expect(mergeGitHubIntoPortfolio(base, envelope)).toEqual(base);
  });

  it("fills only selected slots, rest fallback", () => {
    const base = createPortfolioDraft();
    const envelope = createGitHubEnvelope({
      username: "octocat",
      profile: null,
      repos: [makeRepo("1", "solo", "solo desc")],
      selectedRepoIds: ["1"],
      readmes: {},
    });
    const merged = mergeGitHubIntoPortfolio(base, envelope);
    expect(merged.projects[0]?.name).toBe("solo");
    expect(merged.projects[1]?.name).toBe(base.projects[1]?.name);
  });
});

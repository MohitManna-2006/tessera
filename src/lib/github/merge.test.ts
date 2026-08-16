import { describe, expect, it } from "vitest";

import { createPortfolioDraft } from "@/lib/portfolio";
import { createGitHubEnvelope } from "./persistence";
import { mergeGitHubIntoPortfolio } from "./merge";

function makeRepo(
  id: string,
  name: string,
  desc: string | null,
  overrides: Partial<ReturnType<typeof createRepoBase>> = {},
) {
  return { ...createRepoBase(id, name, desc), ...overrides };
}

function createRepoBase(id: string, name: string, desc: string | null) {
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

  it("suppresses duplicate description and uses README for Chess-Project case", () => {
    const base = createPortfolioDraft();
    const repo = makeRepo("99", "Chess-Project", "Chess Project", {
      primaryLanguage: "C++",
      topics: ["chess", "engine"],
    });
    const envelope = createGitHubEnvelope({
      username: "octocat",
      profile: null,
      repos: [repo],
      selectedRepoIds: ["99"],
      readmes: {
        "99": {
          repo: "Chess-Project",
          size: 2000,
          truncated: false,
          content:
            "# Chess-Project\n\nChess Project\n\nA C++ chess engine that provides move generation and board evaluation with minimax. It is built for learning openings and experimenting with search.\n\n## Features\n\n- Move generation for all pieces\n- Board evaluation with minimax search\n\n## Installation\n\nnpm install",
        },
      },
    });
    const merged = mergeGitHubIntoPortfolio(base, envelope);
    // Summary must be editorial from README, not duplicate "Chess Project"
    expect(merged.projects[0]?.summary).not.toBe("Chess Project");
    expect(merged.projects[0]?.summary.toLowerCase()).toContain("chess engine");
    expect(merged.projects[0]?.summary).not.toContain("npm install");
    // Highlights should be from Features bullets, not duplicate
    expect(merged.projects[0]?.highlights[0].toLowerCase()).toContain(
      "move generation",
    );
    expect(merged.projects[0]?.highlights[1].toLowerCase()).toContain(
      "board evaluation",
    );
    expect(merged.projects[0]?.highlights[0]).not.toBe("Chess Project");
  });

  it("synthesizes fallback when no description or README", () => {
    const base = createPortfolioDraft();
    const repo = makeRepo("100", "algo-tool", null, {
      primaryLanguage: "Python",
      topics: ["algorithms"],
    });
    const envelope = createGitHubEnvelope({
      username: "octocat",
      profile: null,
      repos: [repo],
      selectedRepoIds: ["100"],
      readmes: {},
    });
    const merged = mergeGitHubIntoPortfolio(base, envelope);
    expect(merged.projects[0]?.summary.toLowerCase()).toContain("python");
    expect(merged.projects[0]?.highlights.length).toBe(2);
  });

  it("highlights stay exactly 2 (optimal, 3 only if needed is handled via content richness)", () => {
    const base = createPortfolioDraft();
    const repo = makeRepo("101", "rich-project", "A rich description.", {
      topics: ["a", "b", "c", "d"],
      stargazersCount: 300,
    });
    const envelope = createGitHubEnvelope({
      username: "octocat",
      profile: null,
      repos: [repo],
      selectedRepoIds: ["101"],
      readmes: {
        "101": {
          repo: "rich-project",
          size: 5000,
          truncated: false,
          content:
            "## Features\n\n- One detailed bullet with enough length\n- Two detailed bullet with enough length\n- Three detailed bullet with enough length\n- Four detailed bullet with enough length\n\nAnd a paragraph that is designed to provide overview.",
        },
      },
    });
    const merged = mergeGitHubIntoPortfolio(base, envelope);
    expect(merged.projects[0]?.highlights.length).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import {
  computeWorth,
  isDescriptionDuplicateOfName,
  synthesizeHighlights,
  synthesizeSummary,
} from "./synthesis";

function makeRepo(overrides: Partial<Parameters<typeof synthesizeSummary>[0]> = {}) {
  return {
    id: "1",
    name: "Chess-Project",
    fullName: "octocat/Chess-Project",
    description: "Chess Project",
    htmlUrl: "https://github.com/octocat/Chess-Project",
    stargazersCount: 10,
    forksCount: 2,
    primaryLanguage: "C++",
    topics: ["chess", "engine"],
    updatedAt: new Date().toISOString(),
    isFork: false,
    isArchived: false,
    ...overrides,
  } as Parameters<typeof synthesizeSummary>[0];
}

describe("isDescriptionDuplicateOfName", () => {
  it("detects dup with dash/space variants", () => {
    expect(isDescriptionDuplicateOfName("Chess Project", "Chess-Project")).toBe(true);
    expect(isDescriptionDuplicateOfName("chess-project", "Chess Project")).toBe(true);
    expect(isDescriptionDuplicateOfName("A chess engine", "Chess-Project")).toBe(false);
  });
});

describe("synthesizeSummary", () => {
  it("suppresses duplicate description and uses README paragraph", () => {
    const repo = makeRepo({ description: "Chess Project" });
    const readme = `# Chess-Project\n\nChess Project\n\nThis is a C++ chess engine that allows players to practice openings and evaluate positions with minimax. It is designed for learning and experimentation.\n\n## Installation\n\nnpm install`;
    const summary = synthesizeSummary(repo, readme);
    expect(summary).not.toBe("Chess Project");
    expect(summary.toLowerCase()).toContain("chess engine");
    expect(summary).not.toContain("npm install");
  });

  it("uses good description when better than README", () => {
    const repo = makeRepo({ description: "A practical C++ chess engine for learning openings and endgames." });
    const summary = synthesizeSummary(repo, null);
    expect(summary).toContain("chess engine");
  });

  it("synthesizes fallback when no readme/description worthy", () => {
    const repo = makeRepo({ description: null, primaryLanguage: "C++", topics: [] });
    const summary = synthesizeSummary(repo, null);
    expect(summary.toLowerCase()).toContain("c++");
    expect(summary.endsWith(".")).toBe(true);
  });

  it("dynamic budget: worth tier increases budget", async () => {
    const { summaryBudget } = await import("./synthesis");
    expect(summaryBudget(3)).toBeGreaterThan(summaryBudget(0));
    expect(summaryBudget(2)).toBeGreaterThan(summaryBudget(0));
  });

  it("worth scoring", () => {
    // High worth: stars 300 + topics 3 + desc rich + readme rich = 2+1+1 = 4 -> tier 3
    expect(
      computeWorth(
        makeRepo({
          stargazersCount: 300,
          topics: ["a", "b", "c"],
          description: "A detailed description that exceeds sixty characters for richness scoring purposes here.",
        }),
        "x".repeat(3000),
      ),
    ).toBe(3);
    expect(computeWorth(makeRepo({ stargazersCount: 0, topics: [] }), null)).toBe(0);
  });
});

describe("synthesizeHighlights", () => {
  it("prefers feature bullets from README", () => {
    const repo = makeRepo({});
    const readme = `## Features\n\n- Move generation for chess\n- Board evaluation with minimax\n\nIntro paragraph that is a chess engine that allows practice.`;
    const [h1, h2] = synthesizeHighlights(repo, readme);
    expect(h1.toLowerCase()).toContain("move generation");
    expect(h2.toLowerCase()).toContain("board evaluation");
  });

  it("falls back to topics/language when no README", () => {
    const repo = makeRepo({ description: null });
    const [h1] = synthesizeHighlights(repo, null);
    expect(h1.toLowerCase()).toContain("c++");
  });

  it("never returns duplicate highlights for Chess Project", () => {
    const repo = makeRepo({ description: "Chess Project" });
    const readme = `Chess Project\n\nA C++ chess engine that provides move generation. It helps players learn openings.`;
    const [h1, h2] = synthesizeHighlights(repo, readme);
    expect(h1).not.toBe("Chess Project");
    expect(h2).not.toBe("Chess Project");
    expect(h1).not.toBe(h2);
  });

  it("returns exactly 2 highlights", () => {
    const repo = makeRepo({});
    const h = synthesizeHighlights(repo, "## Features\n\n- One\n- Two\n- Three\n- Four");
    expect(h.length).toBe(2);
  });
});

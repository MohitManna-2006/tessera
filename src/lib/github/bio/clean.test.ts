import { describe, expect, it } from "vitest";
import { cleanReadmeContent, extractFeatureBullets, extractParagraphs } from "./clean";

describe("cleanReadmeContent", () => {
  it("strips badges and code fences", () => {
    const raw = `# Chess-Project\n\n![build](https://img.shields.io/badge/build-passing-green)\n\n\`\`\`ts\ncode()\n\`\`\`\n\nReal paragraph about chess.\n\n## Installation\n\nnpm install chess\n`;
    const cleaned = cleanReadmeContent(raw);
    expect(cleaned).not.toContain("build");
    expect(cleaned).not.toContain("code()");
    expect(cleaned).not.toContain("npm install");
    expect(cleaned).toContain("Real paragraph");
  });

  it("cuts at installation heading", () => {
    const raw = "Intro.\n\n## Getting Started\n\nDo stuff";
    expect(cleanReadmeContent(raw)).not.toContain("Do stuff");
  });
});

describe("extractFeatureBullets", () => {
  it("extracts bullets under Features", () => {
    const cleaned = `# Repo\n\n## Features\n\n- Move generation for chess engine\n- Board evaluation with minimax search\n- Fancy UI with animations\n\n## Installation\n\nnpm i`;
    const bullets = extractFeatureBullets(cleaned);
    expect(bullets.length).toBe(3);
    expect(bullets[0]).toContain("Move generation");
  });
});

describe("extractParagraphs", () => {
  it("filters short dup paragraphs", () => {
    const cleaned = `Chess Project\n\nThis is a chess engine that allows players to practice openings and analyze games.`;
    const paras = extractParagraphs(cleaned);
    expect(paras.length).toBe(1);
    expect(paras[0]).toContain("chess engine");
  });
});

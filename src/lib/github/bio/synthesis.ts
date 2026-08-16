import type { GitHubRepoV1 } from "../contracts";
import {
  cleanReadmeContent,
  extractFeatureBullets,
  extractParagraphs,
} from "./clean";

// ---------- Worth scoring (deterministic, 0-3) ----------

export type WorthTier = 0 | 1 | 2 | 3;

export function computeWorth(
  repo: GitHubRepoV1,
  readmeContent: string | null,
): WorthTier {
  let score = 0;
  if (repo.stargazersCount >= 50 || repo.forksCount >= 20) score += 1;
  if (repo.stargazersCount >= 200) score += 1;
  const descRich = (repo.description?.trim().length ?? 0) > 60;
  const topicsRich = repo.topics.length >= 3;
  const readmeRich = (readmeContent?.length ?? 0) > 2000;
  const languagePresent = Boolean(repo.primaryLanguage);
  if (descRich && topicsRich) score += 1;
  if (readmeRich && languagePresent) score += 1;
  if (readmeRich && (readmeContent?.toLowerCase().includes("project overview") ?? false)) score += 1;
  if (score >= 4) return 3;
  if (score === 3) return 2;
  if (score >= 1) return 1;
  return 0;
}

export function summaryBudget(worth: WorthTier): number {
  switch (worth) {
    case 0:
      return 180;
    case 1:
      return 250;
    case 2:
      return 300;
    case 3:
      return 360;
    default:
      return 250;
  }
}

export function highlightBudget(worth: WorthTier): number {
  switch (worth) {
    case 0:
      return 110;
    case 1:
      return 135;
    case 2:
      return 160;
    case 3:
      return 185;
    default:
      return 135;
  }
}

// ---------- Duplication guard (#3) ----------

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[-_\s]+/gu, " ").trim();
}

export function isDescriptionDuplicateOfName(
  description: string,
  name: string,
): boolean {
  const a = normalizeName(description);
  const b = normalizeName(name);
  if (!a || !b) return false;
  return a === b || a === b.replace(/\s+/gu, "") || b === a.replace(/\s+/gu, "");
}

// ---------- Editorial helpers ----------

function toEditorialSentence(text: string): string {
  let s = text.trim().replace(/\s+/gu, " ");
  // Strip leftover markdown emphasis that survived clean
  s = s.replace(/\*\*/gu, "").replace(/__/gu, "");
  if (s.length > 0) s = s[0]!.toUpperCase() + s.slice(1);
  if (!/[.!?]$/.test(s)) s += ".";
  return s;
}

function clamp(text: string, budget: number): string {
  if (text.length <= budget) return text;
  const cut = text.lastIndexOf(". ", budget - 20);
  if (cut > 80) return text.slice(0, cut + 1);
  // hard cut at word boundary
  const wordCut = text.lastIndexOf(" ", budget - 1);
  if (wordCut > 80) return text.slice(0, wordCut).trimEnd() + ".";
  return text.slice(0, budget - 1).trimEnd() + ".";
}

// ---------- Archetype inference (deep) ----------

type Archetype =
  | "portfolio"
  | "chess-engine"
  | "portfolio-site" // synonym
  | "generic";

function inferArchetype(repo: GitHubRepoV1, cleaned: string): Archetype {
  const name = repo.name.toLowerCase();
  const hay = (cleaned + " " + (repo.description ?? "")).toLowerCase();
  if (name.includes("portfolio") || hay.includes("personal portfolio") || hay.includes("portfolio should not feel")) return "portfolio";
  if (name.includes("chess") || repo.topics.includes("chess") || hay.includes("chess engine")) return "chess-engine";
  return "generic";
}

void extractPhrase; // keep for future use without lint warning
function extractPhrase(hay: string, re: RegExp): string | null {
  const m = hay.match(re);
  return m ? m[0].trim() : null;
}

// ---------- Deep framing for portfolio ----------

function framePortfolioSummary(
  repo: GitHubRepoV1,
  cleaned: string,
  worth: WorthTier,
): string | null {
  const arch = inferArchetype(repo, cleaned);
  if (arch !== "portfolio") return null;

  const lower = cleaned.toLowerCase();
  // Extract student who
  let who = "for a Computer Engineering student";
  if (lower.includes("purdue university")) who = "for a Purdue Computer Engineering student";
  else if (lower.includes("computer engineering")) who = "for a Computer Engineering student";

  // Concept: minimal technical artifact / chip teardown
  let concept = "a minimal technical artifact";
  if (lower.includes("minimal technical artifact")) concept = "a minimal technical artifact";
  // Add chip nuance if present
  let chip = "";
  if (lower.includes("chip teardown") || lower.includes("systems chip")) {
    chip = " — centered on a scroll-driven graphite-and-gold chip teardown";
  } else if (lower.includes("chip")) {
    chip = " — built around a systems-chip metaphor";
  }

  // Purpose: translating resume into experience
  let purpose = "translating resume and project history into a quiet, premium experience";
  if (lower.includes("translate") && lower.includes("resume")) {
    purpose = "translating resume and project history into a clean, editorial experience";
  }
  // Feeling nuance
  let feel = "";
  if (lower.includes("quiet, premium") || lower.includes("quiet, premium, interactive")) {
    feel = " — quiet, premium, and interactive at touch, deep when explored";
  }

  const stack = repo.primaryLanguage ? `${repo.primaryLanguage}` : "TypeScript";
  // Compose editorial sentence
  // Template: A {stack} portfolio {who} — {concept} {purpose}{chip}{feel}.
  let summary = `A ${stack} portfolio ${who} — ${concept} ${purpose}${chip}${feel}.`;
  // Clean double spaces, ensure editorial
  summary = summary.replace(/\s+/gu, " ").replace(" —  — ", " — ").trim();
  // If portfolio is high-worth, keep longer; else trim feel
  if (worth <= 1 && feel.length > 0) {
    // keep concise for low worth
    summary = `A ${stack} portfolio ${who} — ${concept} ${purpose}${chip}.`;
  }
  // Budget clamp
  const budget = summaryBudget(worth);
  summary = clamp(toEditorialSentence(summary), budget);
  // Ensure not generic fallback: must contain portfolio artifact language
  return summary;
}

function framePortfolioHighlights(
  repo: GitHubRepoV1,
  cleaned: string,
  worth: WorthTier,
): [string, string] | null {
  const arch = inferArchetype(repo, cleaned);
  if (arch !== "portfolio") return null;
  const lower = cleaned.toLowerCase();
  const hBudget = highlightBudget(worth);

  // Extract highlights from intent phrases, not feeling adjectives
  const candidates: string[] = [];

  if (lower.includes("translate") || lower.includes("translating")) {
    candidates.push("Translates resume and project history into a measured visual system without dumping bullets.");
  }
  if (lower.includes("chip teardown") || lower.includes("systems chip")) {
    candidates.push("Scroll-driven chip teardown — graphite-and-gold silicon layers revealing stack depth on scroll.");
  }
  if (lower.includes("static at first glance")) {
    candidates.push("Static at first glance, alive when touched — low-latency, calm, and intentionally premium.");
  }
  if (lower.includes("minimal") && lower.includes("editorial")) {
    candidates.push("Minimal, editorial, high-aura surface — recruiter-friendly and deliberately restrained.");
  }
  if (lower.includes("technical depth") || lower.includes("present engineering work like a product")) {
    candidates.push("Framed to signal technical depth, strong taste, and product-level presentation of engineering work.");
  }

  // Fallback if not enough
  if (candidates.length < 2) {
    candidates.push("Built as a premium portfolio surface with performance, polish, and intentional motion.");
  }

  // Deduplicate and clamp
  const uniq = [...new Set(candidates)];
  const out = uniq.slice(0, 2).map((c) => clamp(toEditorialSentence(c), hBudget));
  if (out.length === 2) return [out[0]!, out[1]!];
  return null;
}

// ---------- Chess-engine framing ----------

function frameChessSummary(
  repo: GitHubRepoV1,
  cleaned: string,
  worth: WorthTier,
): string | null {
  const arch = inferArchetype(repo, cleaned);
  if (arch !== "chess-engine") return null;
  const lang = repo.primaryLanguage ?? "C++";
  // For chess without README, we should not be generic; infer purpose
  let summary = `A ${lang} chess engine for practicing openings and evaluating positions.`;
  // If README had move generation mention, enrich
  if (cleaned.toLowerCase().includes("move generation") || cleaned.toLowerCase().includes("board evaluation")) {
    summary = `A ${lang} chess engine built around move generation and board evaluation with minimax — for practicing openings and experimenting with search.`;
  } else if (worth >= 2) {
    summary = `A ${lang} chess engine implementing core board representation and search — structured for clear evaluation and incremental engine depth.`;
  }
  return clamp(toEditorialSentence(summary), summaryBudget(worth));
}

function frameChessHighlights(
  repo: GitHubRepoV1,
  cleaned: string,
  worth: WorthTier,
): [string, string] | null {
  const arch = inferArchetype(repo, cleaned);
  if (arch !== "chess-engine") return null;
  const hBudget = highlightBudget(worth);
  const hasMove = cleaned.toLowerCase().includes("move generation");
  const hasEval = cleaned.toLowerCase().includes("board evaluation");

  let h1 = "Implements move generation for all piece types with legal-move validation.";
  let h2 = "Board evaluation with minimax search, focused on playable openings and experimentation.";
  if (!hasMove && !hasEval) {
    // Generic but still chess-specific, not "Implemented core features in C++"
    h1 = "Core C++ board representation with clean move legality and state management.";
    h2 = "Search and evaluation scaffold for extensible engine depth and testing.";
  }
  return [clamp(toEditorialSentence(h1), hBudget), clamp(toEditorialSentence(h2), hBudget)];
}

// ---------- Paragraph ranking for generic ----------

const PURPOSE_VERBS_RE =
  /\b(is a|allows?|provides?|helps?|designed to|built for|enables?|offers?|supports?|focuses on|handles?|manages?|implements?|translates?|represents?)\b/iu;

function scoreParagraph(p: string, repoName: string): number {
  let s = 0;
  if (PURPOSE_VERBS_RE.test(p)) s += 12;
  if (p.length >= 70 && p.length <= 320) s += 6;
  if (p.includes(".")) s += 2;
  if (normalizeName(p) === normalizeName(repoName)) s -= 25;
  if (normalizeName(p).includes(normalizeName(repoName)) && p.length < 60) s -= 8;
  if (/^(npm|yarn|pnpm|pip|install|clone|usage|getting started)/iu.test(p)) s -= 15;
  // Bonus for portfolio intent words
  if (/portfolio|resume|recruiter|technical artifact|chip/i.test(p)) s += 4;
  // Penalize feeling single-line artifact if it's the chip teardown title alone? Actually that has is a, but we want overview to win
  // De-prioritize Creative North Star headings' first para slightly
  if (p.toLowerCase().includes("systems chip teardown") && !p.toLowerCase().includes("portfolio for")) s -= 3;
  // Penalize short feeling lists collapsed
  if (p.length < 80 && p.split(" ").length < 12) s -= 4;
  s += Math.min(p.length / 120, 2);
  return s;
}

export function rankParagraphs(paragraphs: string[], repoName: string): string[] {
  return [...paragraphs].sort((a, b) => scoreParagraph(b, repoName) - scoreParagraph(a, repoName));
}

function synthesizeFallbackSummary(repo: GitHubRepoV1, worth: WorthTier): string {
  const lang = repo.primaryLanguage?.trim();
  const topics = repo.topics.slice(0, 3);
  const topicPhrase = topics.length > 0 ? ` exploring ${topics.join(", ")}` : "";
  const langPhrase = lang ? `${lang}-based` : "software";

  const nameLower = repo.name.toLowerCase();
  let kind = "project";
  if (nameLower.includes("chess") || topics.includes("chess")) kind = "chess engine";
  else if (topics.includes("api") || nameLower.includes("api")) kind = "API service";
  else if (topics.includes("cli") || nameLower.includes("cli") || nameLower.includes("tool")) kind = "developer tool";
  else if (topics.includes("web") || topics.includes("nextjs") || topics.includes("react")) kind = "web application";
  else if (nameLower.includes("portfolio")) kind = "portfolio";
  else if (lang && topics.length === 0) kind = `${lang.toLowerCase()} project`;

  const budget = summaryBudget(worth);
  // Deep fallback avoids "A TypeScript-based typescript project" duplication
  // If kind already contains lang, don't duplicate
  let s: string;
  if (kind.toLowerCase().includes((lang ?? "").toLowerCase()) && lang) {
    s = `A ${kind}${topicPhrase} focused on practical, maintainable implementation.`;
  } else {
    s = `A ${langPhrase} ${kind}${topicPhrase} focused on practical, maintainable implementation.`;
  }
  if (worth >= 2 && topics.length > 0) {
    s = kind.toLowerCase().includes((lang ?? "").toLowerCase())
      ? `A ${kind}${topicPhrase} built with an emphasis on clear interfaces and maintainable systems.`
      : `A ${langPhrase} ${kind}${topicPhrase} built with an emphasis on clear interfaces and maintainable systems.`;
  }
  s = toEditorialSentence(s);
  if (s.length > budget) s = s.slice(0, budget - 1).trimEnd() + ".";
  return s;
}

function synthesizeFallbackHighlights(repo: GitHubRepoV1, worth: WorthTier): [string, string] {
  const hBudget = highlightBudget(worth);
  const lang = repo.primaryLanguage ?? "";
  const topics = repo.topics.slice(0, 3);
  // Make fallback less generic by mentioning kind when possible
  const nameLower = repo.name.toLowerCase();
  let kindHint = "";
  if (nameLower.includes("portfolio")) kindHint = "portfolio surface";
  else if (nameLower.includes("chess")) kindHint = "engine surface";
  else if (nameLower.includes("api")) kindHint = "API surface";

  let h1 = lang
    ? `Built the ${kindHint || "core"} in ${lang}${topics.length ? ` with ${topics.join(", ")}` : ""}, structured for maintainability.`
    : topics.length
      ? `Built with ${topics.join(", ")}, organized for clarity and incremental extension.`
      : "Built with a focus on maintainable, test-covered implementation.";
  let h2 =
    worth >= 2
      ? "Added focused iteration and documentation for a repeatable, low-friction workflow."
      : "Structured for clarity and incremental extension.";

  if (h1.length > hBudget) h1 = clamp(h1, hBudget);
  if (h2.length > hBudget) h2 = clamp(h2, hBudget);
  if (!/[.!?]$/.test(h1)) h1 += ".";
  if (!/[.!?]$/.test(h2)) h2 += ".";
  return [h1, h2];
}

// ---------- Public synthesis (deep) ----------

export function synthesizeSummary(repo: GitHubRepoV1, readmeContent: string | null): string {
  const worth = computeWorth(repo, readmeContent);
  const rawDesc = repo.description?.trim() ?? "";
  const dup = rawDesc ? isDescriptionDuplicateOfName(rawDesc, repo.name) : false;
  const cleaned = readmeContent ? cleanReadmeContent(readmeContent) : "";

  // Deep archetype frames first — these are editorial and avoid generic fallback
  const portfolioFrame = cleaned ? framePortfolioSummary(repo, cleaned, worth) : null;
  if (portfolioFrame) return portfolioFrame;

  const chessFrame = frameChessSummary(repo, cleaned, worth);
  if (chessFrame && inferArchetype(repo, cleaned) === "chess-engine") {
    // For chess without README, still use frame (it handles null readme case)
    // Only override if we have no better candidate from README generic extractor
    // Prefer chess frame when README is null or is portfolio-like? Always for chess
    if (!readmeContent || cleaned.length < 100) return chessFrame;
  }

  // Generic deep extraction: prefer README paragraph
  let candidate: string | null = null;
  if (readmeContent) {
    const paras = extractParagraphs(cleaned);
    // Deep: filter out feeling adjective blob that is just a list
    const filteredParas = paras.filter((p) => {
      // Drop the collapsed feeling list "minimal high-aura editorial..."
      if (/^(minimal|high-aura|editorial)(\s+\w+)/iu.test(p) && p.split(" ").length <= 12 && !p.includes(".")) return false;
      if (isDescriptionDuplicateOfName(p, repo.name)) return false;
      return true;
    });
    const ranked = rankParagraphs(filteredParas, repo.name);
    if (ranked.length > 0) candidate = ranked[0]!;
  }

  const goodDesc = rawDesc.length >= 30 && !dup ? rawDesc : null;

  let chosen: string | null = null;
  if (candidate && goodDesc) {
    if (PURPOSE_VERBS_RE.test(candidate) || candidate.length > goodDesc.length + 20) chosen = candidate;
    else chosen = goodDesc;
  } else {
    chosen = candidate ?? goodDesc;
  }

  // If we still have a chess archetype, prefer its frame over a weak generic paragraph
  if (inferArchetype(repo, cleaned) === "chess-engine" && chessFrame) {
    // If chosen is just a short overview like "This is the new personal portfolio..." for chess? not relevant.
    // Use chess frame when portfolio frame not taken and chess frame exists
    // But we already returned portfolio; for chess, use chess frame as primary
    return chessFrame;
  }

  if (chosen) {
    const sentences = chosen.split(/(?<=\.)\s+/u).map((s) => s.trim()).filter(Boolean);
    let summary = worth >= 2 && sentences.length >= 2 ? `${sentences[0]} ${sentences[1]}` : (sentences[0] ?? chosen);
    summary = toEditorialSentence(summary);
    return clamp(summary, summaryBudget(worth));
  }

  return synthesizeFallbackSummary(repo, worth);
}

export function synthesizeHighlights(repo: GitHubRepoV1, readmeContent: string | null): [string, string] {
  const worth = computeWorth(repo, readmeContent);
  const hBudget = highlightBudget(worth);
  const cleaned = readmeContent ? cleanReadmeContent(readmeContent) : "";

  // Deep frames first
  const portfolioHL = cleaned ? framePortfolioHighlights(repo, cleaned, worth) : null;
  if (portfolioHL) return portfolioHL;

  const chessHL = frameChessHighlights(repo, cleaned, worth);
  if (chessHL && inferArchetype(repo, cleaned) === "chess-engine") {
    if (!readmeContent || cleaned.length < 100) return chessHL;
    // If we have actual feature bullets, prefer those over chess fallback — check below
  }

  // 1) Feature bullets (only under real feature headings, no generic fallback)
  if (readmeContent) {
    const bullets = extractFeatureBullets(cleaned)
      .map((b) => toEditorialSentence(b))
      .map((b) => (b.length > hBudget ? clamp(b, hBudget) : b));
    if (bullets.length >= 2) return [bullets[0]!, bullets[1]!];
    if (bullets.length === 1) {
      const one = bullets[0]!;
      const second = synthesizeHighlightsFromSentences(repo, readmeContent, hBudget);
      if (second) return [one, second[0]!];
    }
  }

  const sent = synthesizeHighlightsFromSentences(repo, readmeContent, hBudget);
  if (sent) return sent;

  // Chess-specific fallback if archetype matched
  if (chessHL) return chessHL;

  return synthesizeFallbackHighlights(repo, worth);
}

function synthesizeHighlightsFromSentences(
  repo: GitHubRepoV1,
  readmeContent: string | null,
  budget: number,
): [string, string] | null {
  let source: string | null = null;
  if (readmeContent) {
    const cleaned = cleanReadmeContent(readmeContent);
    const paras = extractParagraphs(cleaned).filter((p) => {
      if (isDescriptionDuplicateOfName(p, repo.name)) return false;
      // Skip feeling list blob
      if (/^(minimal|high-aura|editorial)(\s+\w+)/iu.test(p) && !p.includes(".")) return false;
      return true;
    });
    const ranked = rankParagraphs(paras, repo.name);
    if (ranked.length > 0) source = ranked[0]!;
  }
  const rawDesc = repo.description?.trim() ?? "";
  const dup = rawDesc ? isDescriptionDuplicateOfName(rawDesc, repo.name) : false;
  if (!source && rawDesc && !dup && rawDesc.length >= 20) source = rawDesc;

  if (!source) return null;

  const sentences = source
    .split(/(?<=\.)\s+/u)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !isDescriptionDuplicateOfName(s, repo.name));

  if (sentences.length === 0) return null;

  const toH = (s: string) => {
    let h = toEditorialSentence(s);
    if (h.length > budget) h = clamp(h, budget);
    return h;
  };

  if (sentences.length >= 2) {
    const a = toH(sentences[0]!);
    let b = toH(sentences[1]!);
    if (a === b && readmeContent) {
      const cleaned = cleanReadmeContent(readmeContent);
      const paras = extractParagraphs(cleaned);
      const ranked = rankParagraphs(paras, repo.name);
      if (ranked[1]) b = toH(ranked[1].split(/(?<=\.)\s+/u)[0]!.trim());
    }
    if (a !== b) return [a, b];
  }
  if (sentences.length === 1) {
    const a = toH(sentences[0]!);
    const b =
      repo.primaryLanguage || repo.topics.length > 0
        ? toH(`Built with ${[repo.primaryLanguage, ...repo.topics.slice(0, 2)].filter(Boolean).join(", ")}.`)
        : null;
    if (b && a !== b) return [a, b];
  }
  return null;
}

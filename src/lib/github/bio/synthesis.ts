import type { GitHubRepoV1 } from "../contracts";
import {
  cleanReadmeContent,
  extractFeatureBullets,
  extractParagraphs,
} from "./clean";

// ---------- Worth scoring (deterministic, 0-3) ----------

export type WorthTier = 0 | 1 | 2 | 3;

/**
 * Worth is derived from observable signals — not LLM.
 * Used to make summary/highlights length dynamic per user choice #6.
 */
export function computeWorth(
  repo: GitHubRepoV1,
  readmeContent: string | null,
): WorthTier {
  let score = 0;
  // Popularity
  if (repo.stargazersCount >= 50 || repo.forksCount >= 20) score += 1;
  if (repo.stargazersCount >= 200) score += 1;
  // Richness
  const descRich = (repo.description?.trim().length ?? 0) > 60;
  const topicsRich = repo.topics.length >= 3;
  const readmeRich = (readmeContent?.length ?? 0) > 2000;
  const languagePresent = Boolean(repo.primaryLanguage);
  if (descRich && topicsRich) score += 1;
  if (readmeRich && languagePresent) score += 1;
  if (score >= 4) return 3;
  if (score === 3) return 2;
  if (score >= 1) return 1;
  return 0;
}

export function summaryBudget(worth: WorthTier): number {
  // Dynamic per #6 — higher worth → longer editorial summary allowed
  switch (worth) {
    case 0:
      return 140;
    case 1:
      return 190;
    case 2:
      return 250;
    case 3:
      return 320;
    default:
      return 190;
  }
}

export function highlightBudget(worth: WorthTier): number {
  switch (worth) {
    case 0:
      return 90;
    case 1:
      return 120;
    case 2:
      return 150;
    case 3:
      return 170;
    default:
      return 120;
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

// ---------- Paragraph ranking ----------

const PURPOSE_VERBS_RE =
  /\b(is a|allows?|provides?|helps?|designed to|built for|enables?|offers?|supports?|focuses on|handles?|manages?|implements?)\b/iu;

function scoreParagraph(p: string, repoName: string): number {
  let s = 0;
  if (PURPOSE_VERBS_RE.test(p)) s += 12;
  if (p.length >= 80 && p.length <= 280) s += 6;
  if (p.includes(".")) s += 2;
  // penalize if paragraph is just the name repeated
  if (normalizeName(p) === normalizeName(repoName)) s -= 20;
  if (normalizeName(p).includes(normalizeName(repoName)) && p.length < 60) s -= 8;
  // penalize install-like
  if (/^(npm|yarn|pnpm|pip|install|clone|usage)/iu.test(p)) s -= 15;
  // bonus for language/topic mention
  s += Math.min(p.length / 100, 3);
  return s;
}

export function rankParagraphs(
  paragraphs: string[],
  repoName: string,
): string[] {
  return [...paragraphs].sort(
    (a, b) => scoreParagraph(b, repoName) - scoreParagraph(a, repoName),
  );
}

// ---------- Editorial helpers ----------

function toEditorialSentence(text: string): string {
  let s = text.trim().replace(/\s+/gu, " ");
  // Ensure single sentence — cut at first period if too many
  const firstPeriod = s.indexOf(". ");
  if (firstPeriod > 0 && s.length > 160) {
    // keep up to first period for tight summary
    // but caller handles budget slicing
  }
  // Capitalize first letter
  if (s.length > 0) s = s[0]!.toUpperCase() + s.slice(1);
  // Ensure ends with period
  if (!/[.!?]$/.test(s)) s += ".";
  return s;
}

function synthesizeFallbackSummary(
  repo: GitHubRepoV1,
  worth: WorthTier,
): string {
  const lang = repo.primaryLanguage?.trim();
  const topics = repo.topics.slice(0, 3);
  const topicPhrase =
    topics.length > 0 ? ` exploring ${topics.join(", ")}` : "";
  const langPhrase = lang ? `${lang}-based` : "software";

  // Determine project kind from name/topics
  const nameLower = repo.name.toLowerCase();
  let kind = "project";
  if (nameLower.includes("chess") || topics.includes("chess")) kind = "chess engine";
  else if (topics.includes("api") || nameLower.includes("api")) kind = "API service";
  else if (
    topics.includes("cli") ||
    nameLower.includes("cli") ||
    nameLower.includes("tool")
  )
    kind = "developer tool";
  else if (
    topics.includes("web") ||
    topics.includes("nextjs") ||
    topics.includes("react")
  )
    kind = "web application";
  else if (lang && topics.length === 0) kind = `${lang.toLowerCase()} project`;

  const budget = summaryBudget(worth);
  let s = `A ${langPhrase} ${kind}${topicPhrase} focused on practical, maintainable implementation.`;
  // Enrich for higher worth
  if (worth >= 2 && topics.length > 0) {
    s = `A ${langPhrase} ${kind}${topicPhrase} built with an emphasis on clear interfaces, reliable data flows, and maintainable systems.`;
  }
  if (s.length > budget) s = s.slice(0, budget - 1).trimEnd() + ".";
  return s;
}

// ---------- Public synthesis ----------

export function synthesizeSummary(
  repo: GitHubRepoV1,
  readmeContent: string | null,
): string {
  const worth = computeWorth(repo, readmeContent);
  const budget = summaryBudget(worth);
  const rawDesc = repo.description?.trim() ?? "";
  const dup = rawDesc ? isDescriptionDuplicateOfName(rawDesc, repo.name) : false;

  // Prefer README-derived paragraph when description is dup or weak
  let candidate: string | null = null;

  if (readmeContent) {
    const cleaned = cleanReadmeContent(readmeContent);
    const paras = extractParagraphs(cleaned);
    const ranked = rankParagraphs(paras, repo.name);
    // Filter out paras that are dup of name
    const filtered = ranked.filter(
      (p) => !isDescriptionDuplicateOfName(p, repo.name),
    );
    if (filtered.length > 0) candidate = filtered[0]!;
  }

  // If description is dup, ignore it entirely (#3 yes)
  const goodDesc =
    rawDesc.length >= 30 && !dup ? rawDesc : null;

  // Choose best source: candidate paragraph wins over weak/dup description
  let chosen: string | null = null;
  if (candidate && goodDesc) {
    // Prefer candidate if it contains purpose verb or is substantially longer
    if (
      PURPOSE_VERBS_RE.test(candidate) ||
      candidate.length > goodDesc.length + 20
    ) {
      chosen = candidate;
    } else {
      chosen = goodDesc;
    }
  } else {
    chosen = candidate ?? goodDesc;
  }

  if (chosen) {
    // Take 1-2 sentences depending on worth
    const sentences = chosen
      .split(/(?<=\.)\s+/u)
      .map((s) => s.trim())
      .filter(Boolean);
    let summary =
      worth >= 2 && sentences.length >= 2
        ? `${sentences[0]} ${sentences[1]}`
        : (sentences[0] ?? chosen);
    summary = toEditorialSentence(summary);
    // Dynamic clamp
    if (summary.length > budget) {
      // try to cut at sentence boundary, else hard slice
      const cut = summary.lastIndexOf(". ", budget - 20);
      if (cut > 80) summary = summary.slice(0, cut + 1);
      else summary = summary.slice(0, budget - 1).trimEnd() + ".";
    }
    return summary;
  }

  return synthesizeFallbackSummary(repo, worth);
}

function synthesizeFallbackHighlights(
  repo: GitHubRepoV1,
  worth: WorthTier,
): [string, string] {
  const hBudget = highlightBudget(worth);
  const lang = repo.primaryLanguage ?? "";
  const topics = repo.topics.slice(0, 3);
  let h1 = lang
    ? `Implemented core features in ${lang}${topics.length ? ` with ${topics.join(", ")}` : ""}.`
    : topics.length
      ? `Built with ${topics.join(", ")}.`
      : "Built with a focus on maintainable, test-covered implementation.";
  let h2 =
    worth >= 2
      ? "Added focused tests and documentation for a repeatable local workflow."
      : "Structured for clarity and incremental extension.";

  // Apply budget
  if (h1.length > hBudget) h1 = h1.slice(0, hBudget - 1).trimEnd() + ".";
  if (h2.length > hBudget) h2 = h2.slice(0, hBudget - 1).trimEnd() + ".";
  // Ensure period
  if (!/[.!?]$/.test(h1)) h1 += ".";
  if (!/[.!?]$/.test(h2)) h2 += ".";
  return [h1, h2];
}

/**
 * Highlights synthesis — 2 optimal, 3 only if needed (#5).
 * Output stays [string,string] to match Portfolio tuple (editorial).
 * When 3 strong bullets exist and worth >=2, we compress 2 best into tuple;
 * caller can later expand to 3 if schema allows. For now we return best 2.
 */
export function synthesizeHighlights(
  repo: GitHubRepoV1,
  readmeContent: string | null,
): [string, string] {
  const worth = computeWorth(repo, readmeContent);
  const hBudget = highlightBudget(worth);

  // 1) Try feature bullets from README
  if (readmeContent) {
    const cleaned = cleanReadmeContent(readmeContent);
    const bullets = extractFeatureBullets(cleaned)
      .map((b) => toEditorialSentence(b))
      .map((b) => (b.length > hBudget ? b.slice(0, hBudget - 1).trimEnd() + "." : b));
    if (bullets.length >= 2) {
      // If worth >=2 and 3 bullets, keep 3rd as tie-breaker but still return 2 (best)
      // Deduplicate vs summary hint would be done by caller; here just top 2
      return [bullets[0]!, bullets[1]!];
    }
    if (bullets.length === 1) {
      const one = bullets[0]!;
      // need second highlight — fall through to sentence fallback
      const second = synthesizeHighlightsFromSentences(repo, readmeContent, hBudget);
      if (second) return [one, second[0]!];
    }
  }

  // 2) Sentences from ranked paragraph
  const sent = synthesizeHighlightsFromSentences(repo, readmeContent, hBudget);
  if (sent) return sent;

  // 3) Fallback topics/language synthesis (#4)
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
    const paras = extractParagraphs(cleaned);
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
    if (h.length > budget) h = h.slice(0, budget - 1).trimEnd() + ".";
    return h;
  };

  if (sentences.length >= 2) {
    const a = toH(sentences[0]!);
    let b = toH(sentences[1]!);
    // Dedup: if both same, try second paragraph
    if (a === b) {
      if (readmeContent) {
        const cleaned = cleanReadmeContent(readmeContent);
        const paras = extractParagraphs(cleaned);
        const ranked = rankParagraphs(paras, repo.name);
        if (ranked[1]) {
          b = toH(
            ranked[1].split(/(?<=\.)\s+/u)[0]!.trim(),
          );
        }
      }
    }
    if (a !== b) return [a, b];
  }
  if (sentences.length === 1) {
    // Need 2 — create complementary second from topics/language
    const a = toH(sentences[0]!);
    const b =
      repo.primaryLanguage || repo.topics.length > 0
        ? toH(
            `Built with ${[repo.primaryLanguage, ...repo.topics.slice(0, 2)].filter(Boolean).join(", ")}.`,
          )
        : null;
    if (b && a !== b) return [a, b];
  }
  return null;
}

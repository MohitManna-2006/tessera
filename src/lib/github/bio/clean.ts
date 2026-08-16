/**
 * Deterministic README cleaning — treats README as data.
 * Strips fences, badges, images, HTML, and cuts before install/usage noise.
 */

const INSTALL_HEADING_RE =
  /^#{1,6}\s*(installation|install|getting started|usage|quick start|setup|prerequisites|requirements)\b/imu;

const FEATURE_HEADING_RE =
  /^#{1,6}\s*(features|what it does|highlights|capabilities|overview|about|description)\b/imu;

export function cleanReadmeContent(raw: string): string {
  if (!raw) return "";

  let text = raw;

  // Remove code fences ``` ... ``` and `inline`
  text = text.replace(/```[\s\S]*?```/gu, "\n");
  text = text.replace(/`[^`]*`/gu, " ");

  // Remove HTML comments and tags
  text = text.replace(/<!--[\s\S]*?-->/gu, " ");
  text = text.replace(/<[^>]*>/gu, " ");

  // Remove badge/image lines: [![..., ![...
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/gu, " ");
  text = text.replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/gu, " ");

  // Keep link text, drop URL
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1");

  // Remove markdown emphasis ** ** and __ __
  text = text.replace(/\*\*([^*]+)\*\*/gu, "$1");
  text = text.replace(/__([^_]+)__/gu, "$1");
  text = text.replace(/\*([^*]+)\*/gu, "$1");
  text = text.replace(/_([^_]+)_/gu, "$1");

  // Remove blockquote marker >
  text = text.replace(/^\s*>\s?/gmu, "");

  // Normalize horizontal rules
  text = text.replace(/^\s*[-*_]{3,}\s*$/gmu, " ");

  // Truncate at first install/usage heading — keep everything before it
  const lines = text.split(/\n/u);
  let cutIndex = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    if (INSTALL_HEADING_RE.test(lines[i]!.trim())) {
      cutIndex = i;
      break;
    }
  }
  text = lines.slice(0, cutIndex).join("\n");

  // Collapse whitespace per line but preserve paragraph breaks
  text = text
    .split(/\n/u)
    .map((l) => l.replace(/\s+/gu, " ").trimEnd())
    .join("\n");

  // Collapse 3+ newlines to 2
  text = text.replace(/\n{3,}/gu, "\n\n");

  return text.trim().slice(0, 100_000);
}

export function isFeatureHeading(line: string): boolean {
  return FEATURE_HEADING_RE.test(line.trim());
}

/**
 * Extract bullet items ONLY under a feature heading.
 * No fallback to generic top-level bullets — that was causing "Nonchalant." highlights.
 */
export function extractFeatureBullets(cleaned: string): string[] {
  const lines = cleaned.split(/\n/u);
  const bullets: string[] = [];
  let inFeature = false;
  let featureDepth = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const headingMatch = line.match(/^(#{1,6})\s+/u);
    if (headingMatch) {
      const depth = headingMatch[1]!.length;
      if (isFeatureHeading(line)) {
        inFeature = true;
        featureDepth = depth;
        continue;
      }
      if (inFeature && depth <= featureDepth) {
        inFeature = false;
      }
    }
    if (inFeature) {
      const bullet = line.match(/^[-*•]\s+(.+)/u);
      if (bullet) {
        const item = bullet[1]!.trim().replace(/\s+/gu, " ");
        // Require meaningful feature bullet: at least 12 chars and contains a verb/noun phrase
        if (item.length >= 12 && item.length <= 220) {
          // Skip feeling-style single adjectives that slipped under feature heading
          if (/^(minimal|high-aura|editorial|premium|technical|calm|nonchalant|recruiter-friendly|smooth|low-latency|intentional)$/iu.test(item)) continue;
          bullets.push(item);
        }
        if (bullets.length >= 6) break;
      }
    }
  }
  return bullets.slice(0, 6);
}

export function extractParagraphs(cleaned: string): string[] {
  return cleaned
    .split(/\n\s*\n/u)
    .map((p) =>
      p
        .replace(/^#{1,6}\s+/gmu, "")
        .replace(/^\s*[-*•]\s+/gmu, "")
        .replace(/\s+/gu, " ")
        .trim(),
    )
    .filter((p) => p.length >= 40 && p.length <= 1400);
}

/**
 * Section-aware parse: heading -> body text (until next heading of same or higher level).
 */
export type ReadmeSection = { heading: string; level: number; body: string };

export function parseSections(cleaned: string): ReadmeSection[] {
  const lines = cleaned.split(/\n/u);
  const sections: ReadmeSection[] = [];
  let current: ReadmeSection | null = null;

  for (const raw of lines) {
    const m = raw.match(/^(#{1,6})\s+(.+)/u);
    if (m) {
      if (current) sections.push(current);
      current = { heading: m[2]!.trim(), level: m[1]!.length, body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + raw;
    } else {
      // Pre-amble before first heading
      if (!sections.length) {
        if (!current) current = { heading: "", level: 0, body: "" };
        current.body += (current.body ? "\n" : "") + raw;
      }
    }
  }
  if (current) sections.push(current);
  return sections;
}

/**
 * Quick phrase existence check (case-insensitive).
 */
export function containsPhrase(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

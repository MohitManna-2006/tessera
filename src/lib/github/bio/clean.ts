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
  // Keep alt text for normal images? No — strip entirely to avoid "build passing" noise
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/gu, " ");
  text = text.replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/gu, " ");

  // Remove reference-style link definitions? keep link text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1");

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

  // Collapse excessive blank lines and whitespace per line
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
 * Extract bullet items under a feature heading, deterministically.
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
        // left feature section
        inFeature = false;
      }
    }
    if (inFeature) {
      const bullet = line.match(/^[-*•]\s+(.+)/u);
      if (bullet) {
        const item = bullet[1]!.trim().replace(/\s+/gu, " ");
        if (item.length >= 10 && item.length <= 200) bullets.push(item);
        if (bullets.length >= 6) break;
      }
    }
  }
  // Also capture top-level bullets near start if no feature heading bullets found
  if (bullets.length === 0) {
    for (const raw of lines.slice(0, 40)) {
      const line = raw.trim();
      const bullet = line.match(/^[-*•]\s+(.+)/u);
      if (bullet) {
        const item = bullet[1]!.trim().replace(/\s+/gu, " ");
        // skip install/usage bullets
        if (/^(npm|yarn|pnpm|pip|install|clone)/iu.test(item)) continue;
        if (item.length >= 10 && item.length <= 200) bullets.push(item);
        if (bullets.length >= 4) break;
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
    .filter((p) => p.length >= 40 && p.length <= 1200);
}

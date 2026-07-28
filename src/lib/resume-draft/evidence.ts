import { RESUME_DRAFT_LIMITS } from "./contracts";

const TYPOGRAPHIC_PUNCTUATION = /[‘’‚‛“”„‟‐‑‒–—―]/gu;

function normalizePunctuation(character: string): string {
  if (/[‘’‚‛]/u.test(character)) {
    return "'";
  }
  if (/[“”„‟]/u.test(character)) {
    return '"';
  }
  return "-";
}

function normalizeWhitespace(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\r\n?/gu, "\n")
    .replace(/[\u00a0\u202f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeForEvidence(value: string): string {
  return normalizeWhitespace(value).replace(
    TYPOGRAPHIC_PUNCTUATION,
    normalizePunctuation,
  );
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) {
    return 0;
  }

  let count = 0;
  let offset = 0;
  while (offset <= haystack.length - needle.length) {
    const match = haystack.indexOf(needle, offset);
    if (match === -1) {
      break;
    }
    count += 1;
    offset = match + needle.length;
  }
  return count;
}

export type EvidenceMatchResult = {
  matched: boolean;
  occurrences: number;
  normalization: "none" | "whitespace" | "safe_reformat";
};

export function verifyEvidenceExcerpt(
  sourceText: string,
  sourceExcerpt: string,
): EvidenceMatchResult {
  if (
    !sourceExcerpt ||
    sourceExcerpt.length > RESUME_DRAFT_LIMITS.maxEvidenceExcerptCharacters
  ) {
    return {
      matched: false,
      occurrences: 0,
      normalization: "none",
    };
  }

  const exactOccurrences = countOccurrences(sourceText, sourceExcerpt);
  if (exactOccurrences > 0) {
    return {
      matched: true,
      occurrences: exactOccurrences,
      normalization: "none",
    };
  }

  const whitespaceSource = normalizeWhitespace(sourceText);
  const whitespaceExcerpt = normalizeWhitespace(sourceExcerpt);
  const whitespaceOccurrences = countOccurrences(
    whitespaceSource,
    whitespaceExcerpt,
  );
  if (whitespaceOccurrences > 0) {
    return {
      matched: true,
      occurrences: whitespaceOccurrences,
      normalization: "whitespace",
    };
  }

  const normalizedSource = normalizeForEvidence(sourceText);
  const normalizedExcerpt = normalizeForEvidence(sourceExcerpt);
  const normalizedOccurrences = countOccurrences(
    normalizedSource,
    normalizedExcerpt,
  );
  if (normalizedOccurrences === 0) {
    return {
      matched: false,
      occurrences: 0,
      normalization: "none",
    };
  }

  return {
    matched: true,
    occurrences: normalizedOccurrences,
    normalization: "safe_reformat",
  };
}

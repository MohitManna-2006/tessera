export const MIN_MEANINGFUL_TOKEN_COUNT = 5;

export function normalizeResumeText(value: string): string {
  return value
    .replace(/\r\n?/gu, "\n")
    .replace(/\u0000/gu, "")
    .replace(/[\u00a0\u202f]/gu, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/gu, ""))
    .join("\n")
    .replace(/\n{4,}/gu, "\n\n\n")
    .trim();
}

export type MeaningfulTextAnalysis = {
  meaningful: boolean;
  alphanumericCharacterCount: number;
  letterCharacterCount: number;
  substantiveTokenCount: number;
};

export function analyzeMeaningfulResumeText(
  text: string,
  minAlphanumericCharacters: number,
): MeaningfulTextAnalysis {
  const alphanumericCharacterCount = text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  const letterCharacterCount = text.match(/\p{L}/gu)?.length ?? 0;
  const tokens = text.match(/[\p{L}\p{N}][\p{L}\p{N}.'’@:/+-]*/gu) ?? [];
  const substantiveTokenCount = tokens.filter((token) => {
    const alphanumericCount = token.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
    const letterCount = token.match(/\p{L}/gu)?.length ?? 0;
    return alphanumericCount >= 2 && letterCount >= 1;
  }).length;
  const requiredLetterCount = Math.min(
    20,
    Math.max(10, Math.ceil(minAlphanumericCharacters / 2)),
  );

  return {
    meaningful:
      alphanumericCharacterCount >= minAlphanumericCharacters &&
      letterCharacterCount >= requiredLetterCount &&
      substantiveTokenCount >= MIN_MEANINGFUL_TOKEN_COUNT,
    alphanumericCharacterCount,
    letterCharacterCount,
    substantiveTokenCount,
  };
}

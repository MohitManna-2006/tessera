import "server-only";

import {
  DEFAULT_RESUME_PROCESSING_LIMITS,
  type ResumeProcessingLimits,
} from "./contracts";

export { DEFAULT_RESUME_PROCESSING_LIMITS };

type LimitDefinition = {
  envName: string;
  minimum: number;
  maximum: number;
  fallback: number;
};

const LIMIT_DEFINITIONS = {
  maxUploadBytes: {
    envName: "RESUME_MAX_UPLOAD_BYTES",
    minimum: 1024,
    maximum: 25 * 1024 * 1024,
    fallback: DEFAULT_RESUME_PROCESSING_LIMITS.maxUploadBytes,
  },
  maxPages: {
    envName: "RESUME_MAX_PAGES",
    minimum: 1,
    maximum: 100,
    fallback: DEFAULT_RESUME_PROCESSING_LIMITS.maxPages,
  },
  maxTextCharacters: {
    envName: "RESUME_MAX_TEXT_CHARACTERS",
    minimum: 1000,
    maximum: 1_000_000,
    fallback: DEFAULT_RESUME_PROCESSING_LIMITS.maxTextCharacters,
  },
  minMeaningfulAlphanumericCharacters: {
    envName: "RESUME_MIN_MEANINGFUL_ALPHANUMERIC_CHARACTERS",
    minimum: 10,
    maximum: 1000,
    fallback:
      DEFAULT_RESUME_PROCESSING_LIMITS.minMeaningfulAlphanumericCharacters,
  },
} satisfies Record<keyof ResumeProcessingLimits, LimitDefinition>;

function readBoundedInteger(
  value: string | undefined,
  definition: LimitDefinition,
): number {
  if (value === undefined || !/^[1-9]\d*$/u.test(value)) {
    return definition.fallback;
  }

  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < definition.minimum ||
    parsed > definition.maximum
  ) {
    return definition.fallback;
  }

  return parsed;
}

export function parseResumeProcessingLimits(
  environment: Readonly<Record<string, string | undefined>>,
): ResumeProcessingLimits {
  return Object.freeze({
    maxUploadBytes: readBoundedInteger(
      environment[LIMIT_DEFINITIONS.maxUploadBytes.envName],
      LIMIT_DEFINITIONS.maxUploadBytes,
    ),
    maxPages: readBoundedInteger(
      environment[LIMIT_DEFINITIONS.maxPages.envName],
      LIMIT_DEFINITIONS.maxPages,
    ),
    maxTextCharacters: readBoundedInteger(
      environment[LIMIT_DEFINITIONS.maxTextCharacters.envName],
      LIMIT_DEFINITIONS.maxTextCharacters,
    ),
    minMeaningfulAlphanumericCharacters: readBoundedInteger(
      environment[
        LIMIT_DEFINITIONS.minMeaningfulAlphanumericCharacters.envName
      ],
      LIMIT_DEFINITIONS.minMeaningfulAlphanumericCharacters,
    ),
  });
}

export function getResumeProcessingLimits(): ResumeProcessingLimits {
  return parseResumeProcessingLimits(process.env);
}

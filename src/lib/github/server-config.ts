import "server-only";

export const DEFAULT_GITHUB_LIMITS = Object.freeze({
  maxSelectedRepos: 5,
  maxRepos: 100,
  maxReadmeBytes: 100_000,
  requestTimeoutMs: 10_000,
  cacheTtlMs: 60_000,
});

export type GitHubLimits = {
  maxSelectedRepos: number;
  maxRepos: number;
  maxReadmeBytes: number;
  requestTimeoutMs: number;
  cacheTtlMs: number;
};

type LimitDefinition = {
  envName: string;
  minimum: number;
  maximum: number;
  fallback: number;
};

const LIMIT_DEFINITIONS = {
  maxSelectedRepos: {
    envName: "GITHUB_MAX_SELECTED_REPOS",
    minimum: 1,
    maximum: 10,
    fallback: DEFAULT_GITHUB_LIMITS.maxSelectedRepos,
  },
  maxRepos: {
    envName: "GITHUB_MAX_REPOS",
    minimum: 1,
    maximum: 100,
    fallback: DEFAULT_GITHUB_LIMITS.maxRepos,
  },
  maxReadmeBytes: {
    envName: "GITHUB_MAX_README_BYTES",
    minimum: 1_000,
    maximum: 1_000_000,
    fallback: DEFAULT_GITHUB_LIMITS.maxReadmeBytes,
  },
  requestTimeoutMs: {
    envName: "GITHUB_REQUEST_TIMEOUT_MS",
    minimum: 1_000,
    maximum: 30_000,
    fallback: DEFAULT_GITHUB_LIMITS.requestTimeoutMs,
  },
} satisfies Record<keyof Omit<GitHubLimits, "cacheTtlMs">, LimitDefinition>;

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

export function parseGitHubLimits(
  environment: Readonly<Record<string, string | undefined>>,
): GitHubLimits {
  return Object.freeze({
    maxSelectedRepos: readBoundedInteger(
      environment[LIMIT_DEFINITIONS.maxSelectedRepos.envName],
      LIMIT_DEFINITIONS.maxSelectedRepos,
    ),
    maxRepos: readBoundedInteger(
      environment[LIMIT_DEFINITIONS.maxRepos.envName],
      LIMIT_DEFINITIONS.maxRepos,
    ),
    maxReadmeBytes: readBoundedInteger(
      environment[LIMIT_DEFINITIONS.maxReadmeBytes.envName],
      LIMIT_DEFINITIONS.maxReadmeBytes,
    ),
    requestTimeoutMs: readBoundedInteger(
      environment[LIMIT_DEFINITIONS.requestTimeoutMs.envName],
      LIMIT_DEFINITIONS.requestTimeoutMs,
    ),
    cacheTtlMs: DEFAULT_GITHUB_LIMITS.cacheTtlMs,
  });
}

export function getGitHubLimits(): GitHubLimits {
  return parseGitHubLimits(process.env);
}

export function getGitHubToken(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const token = environment.GITHUB_TOKEN?.trim();
  if (!token) return null;
  // Basic sanity: GitHub tokens are 40+ chars, no spaces, no newlines
  if (token.length < 20 || /\s/u.test(token)) return null;
  return token;
}

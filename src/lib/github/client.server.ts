import "server-only";

import { getGitHubLimits, getGitHubToken } from "./server-config";
import {
  normalizeGitHubProfile,
  normalizeGitHubReadme,
  normalizeGitHubRepo,
} from "./normalization";
import type { GitHubProfileV1, GitHubRepoV1 } from "./contracts";

export type GitHubErrorKind =
  | "not_found"
  | "rate_limited"
  | "unauthorized"
  | "timeout"
  | "unavailable"
  | "unknown";

export class GitHubClientError extends Error {
  readonly kind: GitHubErrorKind;
  readonly status: number | null;
  readonly retryAfterMs: number | null;

  constructor(
    kind: GitHubErrorKind,
    message: string,
    status: number | null = null,
    retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "GitHubClientError";
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

type FetchOptions = {
  token?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
};

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const profileCache = new Map<string, CacheEntry<GitHubProfileV1>>();
const reposCache = new Map<string, CacheEntry<GitHubRepoV1[]>>();

function getCacheKey(username: string, suffix: string) {
  return `${username.toLowerCase()}:${suffix}`;
}

function parseRetryAfter(headers: Headers): number | null {
  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }
  }
  const reset = headers.get("x-ratelimit-reset");
  if (reset) {
    const resetSeconds = Number(reset);
    if (Number.isFinite(resetSeconds)) {
      const resetMs = resetSeconds * 1000;
      const diff = resetMs - Date.now();
      if (diff > 0 && diff < 3600_1000) return diff;
    }
  }
  return null;
}

async function githubFetch(
  url: string,
  options: FetchOptions,
): Promise<Response> {
  const limits = getGitHubLimits();
  const timeoutMs = options.timeoutMs ?? limits.requestTimeoutMs;
  const token = options.token ?? getGitHubToken() ?? null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const abortHandler = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", abortHandler, { once: true });
  }

  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "tessera-portfolio",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      const abortedByClient = options.signal?.aborted ?? false;
      if (abortedByClient) {
        throw new GitHubClientError("unavailable", "Request was cancelled.");
      }
      throw new GitHubClientError("timeout", "GitHub request timed out.");
    }
    throw new GitHubClientError("unavailable", "GitHub is unavailable.");
  } finally {
    clearTimeout(timeoutId);
    if (options.signal) {
      options.signal.removeEventListener("abort", abortHandler);
    }
  }
}

function handleErrorResponse(response: Response, headers: Headers): never {
  const retryAfterMs = parseRetryAfter(headers);
  if (response.status === 404) {
    throw new GitHubClientError("not_found", "Not found.", 404);
  }
  if (response.status === 401) {
    throw new GitHubClientError("unauthorized", "Unauthorized.", 401);
  }
  if (response.status === 403 || response.status === 429) {
    throw new GitHubClientError(
      "rate_limited",
      "GitHub rate limit exceeded.",
      response.status,
      retryAfterMs,
    );
  }
  if (response.status >= 500) {
    throw new GitHubClientError(
      "unavailable",
      "GitHub is unavailable.",
      response.status,
    );
  }
  throw new GitHubClientError(
    "unknown",
    `GitHub error ${response.status}`,
    response.status,
  );
}

export async function fetchGitHubProfile(
  username: string,
  options: FetchOptions = {},
): Promise<GitHubProfileV1> {
  const cacheKey = getCacheKey(username, "profile");
  const cached = profileCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const url = `https://api.github.com/users/${encodeURIComponent(username)}`;
  const response = await githubFetch(url, options);
  if (!response.ok) handleErrorResponse(response, response.headers);

  const json = await response.json();
  const normalized = normalizeGitHubProfile(json);
  if (!normalized) {
    throw new GitHubClientError("unknown", "Invalid profile response.");
  }

  const limits = getGitHubLimits();
  profileCache.set(cacheKey, {
    data: normalized,
    expiresAt: Date.now() + limits.cacheTtlMs,
  });
  return normalized;
}

export async function fetchGitHubRepos(
  username: string,
  page = 1,
  perPage = 30,
  options: FetchOptions = {},
): Promise<GitHubRepoV1[]> {
  const clampedPerPage = Math.min(100, Math.max(1, perPage));
  const clampedPage = Math.max(1, Math.min(10, page));
  const cacheKey = getCacheKey(
    username,
    `repos:${clampedPage}:${clampedPerPage}`,
  );
  const cached = reposCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=${clampedPerPage}&page=${clampedPage}&sort=updated`;
  const response = await githubFetch(url, options);
  if (!response.ok) handleErrorResponse(response, response.headers);

  const json = (await response.json()) as unknown[];
  if (!Array.isArray(json)) {
    throw new GitHubClientError("unknown", "Invalid repos response.");
  }
  const normalized = json
    .map((item) => normalizeGitHubRepo(item))
    .filter((r): r is GitHubRepoV1 => r !== null);

  const limits = getGitHubLimits();
  reposCache.set(cacheKey, {
    data: normalized,
    expiresAt: Date.now() + limits.cacheTtlMs,
  });
  return normalized;
}

export async function fetchGitHubReadme(
  username: string,
  repo: string,
  options: FetchOptions & { maxBytes?: number } = {},
): Promise<{
  readme: ReturnType<typeof normalizeGitHubReadme>;
  rawHeaders: Headers;
}> {
  const limits = getGitHubLimits();
  const maxBytes = options.maxBytes ?? limits.maxReadmeBytes;
  const url = `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/readme`;
  // Use raw accept to get plain text directly, fallback to json
  const readmeHeaders: Record<string, string> = {
    Accept: "application/vnd.github.raw+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "tessera-portfolio",
  };
  if (options.token ?? getGitHubToken()) {
    readmeHeaders.Authorization = `Bearer ${options.token ?? getGitHubToken()}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? limits.requestTimeoutMs,
  );
  const abortHandler = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", abortHandler, { once: true });
  }

  try {
    const response = await fetch(url, {
      headers: readmeHeaders,
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.status === 404) {
      // No readme is not an error — return empty
      return {
        readme: normalizeGitHubReadme(repo, "", 0, false),
        rawHeaders: response.headers,
      };
    }
    if (!response.ok) handleErrorResponse(response, response.headers);

    const contentType = response.headers.get("content-type") ?? "";
    let content = "";
    let size = 0;
    let truncated = false;

    if (contentType.includes("application/json")) {
      const json = (await response.json()) as {
        content?: string;
        size?: number;
        encoding?: string;
      };
      if (json.encoding === "base64" && typeof json.content === "string") {
        const cleaned = json.content.replace(/\n/g, "");
        try {
          content = Buffer.from(cleaned, "base64").toString("utf-8");
        } catch {
          content = "";
        }
        size = json.size ?? content.length;
      }
    } else {
      content = await response.text();
      size = content.length;
    }

    if (content.length > maxBytes) {
      content = content.slice(0, maxBytes);
      truncated = true;
    }
    // Also truncate as safety against extremely large
    if (content.length > 1_000_000) {
      content = content.slice(0, 1_000_000);
      truncated = true;
    }

    return {
      readme: normalizeGitHubReadme(repo, content, size, truncated),
      rawHeaders: response.headers,
    };
  } catch (error) {
    if (error instanceof GitHubClientError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      if (options.signal?.aborted) {
        throw new GitHubClientError("unavailable", "Request was cancelled.");
      }
      throw new GitHubClientError("timeout", "GitHub request timed out.");
    }
    throw new GitHubClientError("unavailable", "GitHub is unavailable.");
  } finally {
    clearTimeout(timeoutId);
    if (options.signal)
      options.signal.removeEventListener("abort", abortHandler);
  }
}

// For testing: clear caches
export function clearGitHubCache(): void {
  profileCache.clear();
  reposCache.clear();
}

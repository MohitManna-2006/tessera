import {
  GitHubProfileV1Schema,
  GitHubRepoV1Schema,
  type GitHubProfileV1,
  type GitHubReadmeV1,
  type GitHubRepoV1,
} from "./contracts";

type RawGitHubProfile = {
  login: unknown;
  name: unknown;
  avatar_url: unknown;
  bio: unknown;
  html_url: unknown;
  public_repos: unknown;
  followers: unknown;
};

type RawGitHubRepo = {
  id: unknown;
  name: unknown;
  full_name: unknown;
  description: unknown;
  html_url: unknown;
  stargazers_count: unknown;
  forks_count: unknown;
  language: unknown;
  topics: unknown;
  updated_at: unknown;
  fork: unknown;
  archived: unknown;
};

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toUrlString(value: unknown): string | null {
  const str = toTrimmedString(value);
  if (!str) return null;
  try {
    const url = new URL(str);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return str;
  } catch {
    return null;
  }
}

export function normalizeGitHubProfile(raw: unknown): GitHubProfileV1 | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as RawGitHubProfile;
  const login = typeof data.login === "string" ? data.login.trim() : "";
  const htmlUrl = toUrlString(data.html_url);
  if (!login || !htmlUrl) return null;

  const candidate = {
    login,
    name: toTrimmedString(data.name),
    avatarUrl: toUrlString(data.avatar_url),
    bio: toTrimmedString(data.bio),
    htmlUrl,
    publicRepos:
      typeof data.public_repos === "number" &&
      Number.isInteger(data.public_repos)
        ? data.public_repos
        : 0,
    followers:
      typeof data.followers === "number" && Number.isInteger(data.followers)
        ? data.followers
        : 0,
  };

  // Truncate bio to 500 if needed (schema max)
  if (candidate.bio && candidate.bio.length > 500) {
    candidate.bio = candidate.bio.slice(0, 500);
  }
  if (candidate.name && candidate.name.length > 100) {
    candidate.name = candidate.name.slice(0, 100);
  }

  const parsed = GitHubProfileV1Schema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function normalizeGitHubRepo(raw: unknown): GitHubRepoV1 | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as RawGitHubRepo;

  const idRaw = data.id;
  const id =
    typeof idRaw === "number"
      ? String(idRaw)
      : typeof idRaw === "string"
        ? idRaw.trim()
        : "";
  const name = toTrimmedString(data.name);
  const fullName = toTrimmedString(data.full_name);
  const htmlUrl = toUrlString(data.html_url);
  const updatedAt = toTrimmedString(data.updated_at);

  if (!id || !name || !fullName || !htmlUrl || !updatedAt) return null;

  // Validate updatedAt is ISO datetime, fallback to now if invalid
  let normalizedUpdatedAt = updatedAt;
  const date = Date.parse(updatedAt);
  if (Number.isNaN(date)) {
    normalizedUpdatedAt = new Date().toISOString();
  }

  let topics: string[] = [];
  if (Array.isArray(data.topics)) {
    topics = data.topics
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length <= 50)
      .slice(0, 32);
  }

  let description = toTrimmedString(data.description);
  if (description && description.length > 2000) {
    description = description.slice(0, 2000);
  }

  let primaryLanguage = toTrimmedString(data.language);
  if (primaryLanguage && primaryLanguage.length > 50) {
    primaryLanguage = primaryLanguage.slice(0, 50);
  }

  const candidate = {
    id,
    name,
    fullName,
    description,
    htmlUrl,
    stargazersCount:
      typeof data.stargazers_count === "number" &&
      Number.isInteger(data.stargazers_count)
        ? data.stargazers_count
        : 0,
    forksCount:
      typeof data.forks_count === "number" && Number.isInteger(data.forks_count)
        ? data.forks_count
        : 0,
    primaryLanguage,
    topics,
    updatedAt: normalizedUpdatedAt,
    isFork: Boolean(data.fork),
    isArchived: Boolean(data.archived),
  };

  const parsed = GitHubRepoV1Schema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function normalizeGitHubReadme(
  repo: string,
  content: string,
  size: number,
  truncated: boolean,
): GitHubReadmeV1 {
  // Treat content as data, never as prompt — store verbatim truncated to max
  let normalizedContent = content;
  if (normalizedContent.length > 1_000_000) {
    normalizedContent = normalizedContent.slice(0, 1_000_000);
  }
  return {
    repo: repo.trim().slice(0, 100),
    size,
    truncated,
    content: normalizedContent,
  };
}

export function filterRepos(
  repos: readonly GitHubRepoV1[],
  query: string,
  language: string | null,
  topic: string | null,
): GitHubRepoV1[] {
  const lowerQuery = query.trim().toLowerCase();
  return repos.filter((repo) => {
    if (
      lowerQuery &&
      !repo.name.toLowerCase().includes(lowerQuery) &&
      !(repo.description?.toLowerCase().includes(lowerQuery) ?? false)
    ) {
      return false;
    }
    if (
      language &&
      (repo.primaryLanguage?.toLowerCase() ?? "") !== language.toLowerCase()
    ) {
      return false;
    }
    if (topic && !repo.topics.includes(topic.toLowerCase())) {
      return false;
    }
    return true;
  });
}

export function sortRepos(
  repos: readonly GitHubRepoV1[],
  sortBy: "updated" | "stars" | "name",
): GitHubRepoV1[] {
  const copy = [...repos];
  if (sortBy === "stars") {
    copy.sort((a, b) => b.stargazersCount - a.stargazersCount);
  } else if (sortBy === "name") {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    copy.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  return copy;
}

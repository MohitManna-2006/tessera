/* eslint-disable react-hooks/set-state-in-effect -- hydration from sessionStorage */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GitHubUsernameSchema } from "@/lib/github/contracts";
import { filterRepos, sortRepos } from "@/lib/github/normalization";
import {
  createGitHubEnvelope,
  readGitHubEnvelope,
  toggleRepoSelection,
  writeGitHubEnvelope,
  type GitHubEnvelopeV1,
} from "@/lib/github/persistence";
import type { GitHubProfileV1, GitHubRepoV1 } from "@/lib/github/contracts";

type SortBy = "updated" | "stars" | "name";

export function GitHubImport({
  maxSelectedRepos = 5,
}: {
  maxSelectedRepos?: number;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [profile, setProfile] = useState<GitHubProfileV1 | null>(null);
  const [repos, setRepos] = useState<GitHubRepoV1[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [reposError, setReposError] = useState<string | null>(null);
  const [retryAfterMs, setRetryAfterMs] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("updated");
  const [expandedReadmes, setExpandedReadmes] = useState<
    Record<string, string>
  >({});
  const [readmeLoading, setReadmeLoading] = useState<string | null>(null);
  const [readmeErrors, setReadmeErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const envelope = readGitHubEnvelope(window.sessionStorage);
      if (envelope) {
        setUsername(envelope.username);
        setProfile(envelope.profile);
        setRepos(envelope.repos);
        setSelectedIds(envelope.selectedRepoIds);
        const restoredReadmes: Record<string, string> = {};
        for (const [id, readme] of Object.entries(envelope.readmes)) {
          restoredReadmes[id] = readme.content;
        }
        setExpandedReadmes(restoredReadmes);
      }
    } catch {
      // ignore
    }
  }, []);

  const persist = useCallback(
    (next: Partial<GitHubEnvelopeV1> & { username: string }) => {
      try {
        const current = readGitHubEnvelope(window.sessionStorage);
        const envelope = createGitHubEnvelope({
          username: next.username,
          profile: next.profile ?? current?.profile ?? null,
          repos: next.repos ?? current?.repos ?? [],
          selectedRepoIds:
            next.selectedRepoIds ?? current?.selectedRepoIds ?? [],
          readmes: (next.readmes as never) ?? current?.readmes ?? {},
        });
        writeGitHubEnvelope(window.sessionStorage, envelope);
      } catch {
        // best-effort
      }
    },
    [],
  );

  const validateUsername = (value: string): string | null => {
    const parsed = GitHubUsernameSchema.safeParse(value.trim());
    if (!parsed.success)
      return parsed.error.issues[0]?.message ?? "Invalid username.";
    return null;
  };

  const handleLookup = async () => {
    const error = validateUsername(username);
    if (error) {
      setUsernameError(error);
      return;
    }
    setUsernameError(null);
    setProfileError(null);
    setReposError(null);
    setRetryAfterMs(null);
    setIsLoadingProfile(true);
    setIsLoadingRepos(true);
    try {
      const profileRes = await fetch("/api/github/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      const profileJson = (await profileRes.json()) as {
        profile?: GitHubProfileV1;
        message?: string;
        retryAfterMs?: number;
      };
      if (!profileRes.ok) {
        setProfileError(profileJson.message ?? "Could not fetch profile.");
        if (profileJson.retryAfterMs) setRetryAfterMs(profileJson.retryAfterMs);
        setProfile(null);
        setRepos([]);
        setIsLoadingProfile(false);
        setIsLoadingRepos(false);
        return;
      }
      const fetchedProfile = profileJson.profile ?? null;
      setProfile(fetchedProfile ?? null);
      setIsLoadingProfile(false);

      const reposRes = await fetch("/api/github/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          perPage: 100,
          page: 1,
        }),
      });
      const reposJson = (await reposRes.json()) as {
        repos?: GitHubRepoV1[];
        message?: string;
        retryAfterMs?: number;
      };
      if (!reposRes.ok) {
        setReposError(reposJson.message ?? "Could not fetch repositories.");
        if (reposJson.retryAfterMs) setRetryAfterMs(reposJson.retryAfterMs);
        setRepos([]);
      } else {
        const fetchedRepos = reposJson.repos ?? [];
        setRepos(fetchedRepos);
        persist({
          username: username.trim(),
          profile: fetchedProfile,
          repos: fetchedRepos,
          selectedRepoIds: selectedIds,
          readmes: {},
        });
      }
    } catch {
      setProfileError("Network error. Check your connection and try again.");
    } finally {
      setIsLoadingProfile(false);
      setIsLoadingRepos(false);
    }
  };

  const handleToggle = (repoId: string) => {
    const current = readGitHubEnvelope(window.sessionStorage);
    const baseEnvelope =
      current ??
      createGitHubEnvelope({
        username: username.trim() || "unknown",
        profile,
        repos,
        selectedRepoIds: selectedIds,
        readmes: {},
      });
    const next = toggleRepoSelection(baseEnvelope, repoId, maxSelectedRepos);
    if (!next) return;
    setSelectedIds(next.selectedRepoIds);
    writeGitHubEnvelope(window.sessionStorage, next);
  };

  const handleReadmeToggle = async (repo: GitHubRepoV1) => {
    if (expandedReadmes[repo.id] !== undefined) {
      const next = { ...expandedReadmes };
      delete next[repo.id];
      setExpandedReadmes(next);
      return;
    }
    setReadmeLoading(repo.id);
    setReadmeErrors((prev) => {
      const next = { ...prev };
      delete next[repo.id];
      return next;
    });
    try {
      const res = await fetch("/api/github/readme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: profile?.login ?? username.trim(),
          repo: repo.name,
        }),
      });
      const json = (await res.json()) as {
        readme?: { content: string; truncated: boolean };
        message?: string;
      };
      if (!res.ok) {
        setReadmeErrors((prev) => ({
          ...prev,
          [repo.id]: json.message ?? "Could not fetch README.",
        }));
      } else {
        const content = json.readme?.content ?? "";
        setExpandedReadmes((prev) => ({ ...prev, [repo.id]: content }));
        const current = readGitHubEnvelope(window.sessionStorage);
        if (current) {
          const nextEnvelope = {
            ...current,
            readmes: {
              ...current.readmes,
              [repo.id]: {
                repo: repo.name,
                size: content.length,
                truncated: json.readme?.truncated ?? false,
                content,
              },
            },
          };
          writeGitHubEnvelope(
            window.sessionStorage,
            nextEnvelope as GitHubEnvelopeV1,
          );
        }
      }
    } catch {
      setReadmeErrors((prev) => ({ ...prev, [repo.id]: "Network error." }));
    } finally {
      setReadmeLoading(null);
    }
  };

  const handleContinue = () => {
    const current = readGitHubEnvelope(window.sessionStorage);
    if (!current || selectedIds.length === 0) return;
    let hasResume = false;
    try {
      const resumeRaw = window.sessionStorage.getItem(
        "tessera.resume-review.v1",
      );
      hasResume = Boolean(resumeRaw);
    } catch {
      hasResume = false;
    }
    const source = hasResume ? "resume" : "github";
    router.push(`/builder?source=${source}`);
  };

  const filtered = useMemo(() => {
    const filteredRepos = filterRepos(
      repos,
      searchQuery,
      languageFilter,
      topicFilter,
    );
    return sortRepos(filteredRepos, sortBy);
  }, [repos, searchQuery, languageFilter, topicFilter, sortBy]);

  const languages = useMemo(() => {
    const set = new Set<string>();
    for (const repo of repos)
      if (repo.primaryLanguage) set.add(repo.primaryLanguage);
    return Array.from(set).sort();
  }, [repos]);

  const topics = useMemo(() => {
    const set = new Set<string>();
    for (const repo of repos) for (const t of repo.topics) set.add(t);
    return Array.from(set).sort().slice(0, 20);
  }, [repos]);

  const selectedCount = selectedIds.length;

  return (
    <main className="resume-main">
      <div className="resume-container">
        <section className="resume-page-intro" aria-labelledby="github-title">
          <p className="onboarding-eyebrow">GitHub import</p>
          <h1 id="github-title">Import your public projects.</h1>
          <p>
            Enter a GitHub username to list public repositories. Select up to{" "}
            {maxSelectedRepos} to feature in your portfolio. READMEs are treated
            as data, not instructions.
          </p>
        </section>

        <div className="resume-workspace">
          <div className="resume-upload-panel">
            <div className="field">
              <label htmlFor="github-username">GitHub username</label>
              <div
                className="field-grid"
                style={{ gridTemplateColumns: "minmax(0, 1fr) 128px" }}
              >
                <input
                  id="github-username"
                  className={`form-control${usernameError ? " form-control-error" : ""}`}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (usernameError) setUsernameError(null);
                  }}
                  placeholder="octocat"
                  aria-invalid={Boolean(usernameError)}
                  aria-describedby={
                    usernameError ? "github-username-error" : undefined
                  }
                />
                <button
                  className="resume-primary-button"
                  type="button"
                  onClick={() => void handleLookup()}
                  disabled={isLoadingProfile || isLoadingRepos}
                  style={{ minHeight: "40px" }}
                >
                  {isLoadingProfile ? "Looking up…" : "Look up"}
                </button>
              </div>
              {usernameError ? (
                <p
                  id="github-username-error"
                  className="field-error"
                  role="alert"
                >
                  {usernameError}
                </p>
              ) : null}
            </div>

            {profileError ? (
              <div className="resume-error" role="alert" tabIndex={-1}>
                <strong>Could not load profile</strong>
                <p>{profileError}</p>
                {retryAfterMs ? (
                  <p>Retry after {Math.ceil(retryAfterMs / 1000)}s.</p>
                ) : null}
              </div>
            ) : null}
            {reposError ? (
              <div className="resume-error" role="alert">
                <strong>Could not load repositories</strong>
                <p>{reposError}</p>
              </div>
            ) : null}
            {retryAfterMs && !profileError && !reposError ? (
              <div className="resume-error" role="alert">
                <p>
                  GitHub is rate-limited. Try again in{" "}
                  {Math.ceil(retryAfterMs / 1000)}s.
                </p>
              </div>
            ) : null}

            {profile ? (
              <section
                className="github-profile-card"
                aria-label="GitHub profile"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.avatarUrl ?? ""}
                  alt={`${profile.login} avatar`}
                  width={52}
                  height={52}
                  style={{
                    borderRadius: "50%",
                    flex: "0 0 52px",
                    objectFit: "cover",
                    border: "1px solid var(--border)",
                  }}
                />
                <div className="github-profile-copy">
                  <strong className="github-profile-name">
                    {profile.name ?? profile.login}
                  </strong>
                  <a
                    href={profile.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="github-profile-handle"
                  >
                    @{profile.login}
                  </a>
                  {profile.bio ? (
                    <p className="github-profile-bio">{profile.bio}</p>
                  ) : null}
                  <span className="github-profile-stats">
                    {profile.publicRepos} repos · {profile.followers} followers
                  </span>
                </div>
              </section>
            ) : null}

            {repos.length > 0 ? (
              <section
                className="github-controls"
                aria-label="Repository filters"
              >
                <div className="github-controls-grid">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label
                      htmlFor="github-search"
                      className="github-filter-label"
                    >
                      Search
                    </label>
                    <input
                      id="github-search"
                      aria-label="Search repositories"
                      placeholder="Search by name or description"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="form-control"
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label
                      htmlFor="github-language"
                      className="github-filter-label"
                    >
                      Language
                    </label>
                    <select
                      id="github-language"
                      aria-label="Filter by language"
                      value={languageFilter ?? ""}
                      onChange={(e) =>
                        setLanguageFilter(e.target.value || null)
                      }
                      className="form-control"
                    >
                      <option value="">All languages</option>
                      {languages.map((lang) => (
                        <option key={lang} value={lang}>
                          {lang}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label
                      htmlFor="github-topic"
                      className="github-filter-label"
                    >
                      Topic
                    </label>
                    <select
                      id="github-topic"
                      aria-label="Filter by topic"
                      value={topicFilter ?? ""}
                      onChange={(e) => setTopicFilter(e.target.value || null)}
                      className="form-control"
                    >
                      <option value="">All topics</option>
                      {topics.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label
                      htmlFor="github-sort"
                      className="github-filter-label"
                    >
                      Sort
                    </label>
                    <select
                      id="github-sort"
                      aria-label="Sort repositories"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortBy)}
                      className="form-control"
                    >
                      <option value="updated">Recently updated</option>
                      <option value="stars">Most stars</option>
                      <option value="name">Name</option>
                    </select>
                  </div>
                </div>
              </section>
            ) : null}

            {isLoadingRepos ? (
              <p role="status" className="github-status">
                Loading repositories…
              </p>
            ) : null}

            {filtered.length > 0 ? (
              <ul className="github-repo-list" aria-label="Repositories">
                {filtered.map((repo) => {
                  const isSelected = selectedIds.includes(repo.id);
                  const isDisabled =
                    !isSelected && selectedIds.length >= maxSelectedRepos;
                  const isExpanded = expandedReadmes[repo.id] !== undefined;
                  return (
                    <li
                      key={repo.id}
                      className="github-repo-card"
                      data-selected={isSelected}
                    >
                      <label className="github-repo-label">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => handleToggle(repo.id)}
                          aria-label={`Select ${repo.name}`}
                          className="github-checkbox"
                        />
                        <span className="github-repo-name">
                          {repo.name}
                          {repo.isFork ? (
                            <span className="github-repo-badge">fork</span>
                          ) : null}
                          {repo.isArchived ? (
                            <span className="github-repo-badge">archived</span>
                          ) : null}
                        </span>
                      </label>
                      <p className="github-repo-desc">
                        {repo.description?.trim() || "No description."}
                      </p>
                      <div className="github-repo-meta">
                        <span className="github-meta-language">
                          {repo.primaryLanguage ?? "—"}
                        </span>
                        <span
                          className="github-meta-stars"
                          aria-label={`${repo.stargazersCount} stars`}
                        >
                          ★ {repo.stargazersCount}
                        </span>
                        <span className="github-meta-updated">
                          Updated{" "}
                          {new Date(repo.updatedAt).toLocaleDateString(
                            undefined,
                            { year: "numeric", month: "short", day: "numeric" },
                          )}
                        </span>
                        <a
                          href={repo.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="github-repo-link"
                        >
                          View <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                      {repo.topics.length ? (
                        <div className="github-topics">
                          {repo.topics.map((t) => (
                            <span key={t} className="github-topic">
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleReadmeToggle(repo)}
                        disabled={readmeLoading === repo.id}
                        aria-expanded={isExpanded}
                        className="github-readme-toggle"
                      >
                        {readmeLoading === repo.id
                          ? "Loading README…"
                          : isExpanded
                            ? "Hide README"
                            : "View README"}
                      </button>
                      {readmeErrors[repo.id] ? (
                        <p role="alert" className="field-error">
                          {readmeErrors[repo.id]}
                        </p>
                      ) : null}
                      {isExpanded ? (
                        <pre className="github-readme-content">
                          {expandedReadmes[repo.id] || "(No README content)"}
                        </pre>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : repos.length > 0 ? (
              <p className="github-empty">
                No repositories match your filters.
              </p>
            ) : profile ? (
              <p className="github-empty">No public repositories found.</p>
            ) : null}

            <div className="github-actions">
              <span className="github-selection-count" aria-live="polite">
                {selectedCount} of {maxSelectedRepos} selected
              </span>
              <div className="github-actions-buttons">
                <button
                  className="resume-primary-button"
                  type="button"
                  onClick={handleContinue}
                  disabled={selectedCount === 0}
                >
                  Continue to builder
                </button>
                <Link
                  href="/builder"
                  className="resume-secondary-button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                    minHeight: "44px",
                  }}
                >
                  Skip GitHub import
                </Link>
              </div>
            </div>
            {selectedCount >= maxSelectedRepos ? (
              <p role="status" className="github-limit-notice">
                Maximum {maxSelectedRepos} projects selected.
              </p>
            ) : null}
          </div>

          <aside
            className="resume-privacy-panel"
            aria-labelledby="github-privacy-title"
          >
            <p className="resume-aside-index">02 / Public data only</p>
            <h2 id="github-privacy-title">Only public repositories.</h2>
            <p>
              Tessera fetches public profile and repo metadata via the GitHub
              REST API. Private repositories are never requested. READMEs are
              stored as plain text and truncated to {maxSelectedRepos * 20000}{" "}
              characters.
            </p>
            <p>Rate limits are handled server-side with a 60s cache.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}

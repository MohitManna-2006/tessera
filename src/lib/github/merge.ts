import type { Portfolio, Project } from "@/lib/portfolio";
import { createPortfolioDraft } from "@/lib/portfolio";
import type { GitHubRepoV1 } from "./contracts";
import type { GitHubEnvelopeV1 } from "./persistence";

function repoToProject(
  repo: GitHubRepoV1,
  fallback: Project,
  featured: boolean,
): Project {
  const technologies =
    [repo.primaryLanguage, ...repo.topics.slice(0, 5)]
      .filter((v): v is string => Boolean(v))
      .join(", ") || fallback.technologies;

  const summary = repo.description?.trim() || fallback.summary;

  // Highlights: first split description sentences, fallback
  const rawHighlights: string[] = [];
  if (repo.description?.trim()) {
    const sentences = repo.description
      .split(/(?<=\.)\s+/u)
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (sentences[0]) rawHighlights.push(sentences[0].slice(0, 300));
    if (sentences[1] && rawHighlights.length < 2)
      rawHighlights.push(sentences[1].slice(0, 300));
  }
  if (rawHighlights.length < 2 && repo.topics[0]) {
    rawHighlights.push(`Built with ${repo.topics.slice(0, 3).join(", ")}`);
  }

  const highlights: [string, string] =
    rawHighlights.length >= 2
      ? [rawHighlights[0]!, rawHighlights[1]!]
      : rawHighlights.length === 1
        ? [rawHighlights[0]!, fallback.highlights[1]]
        : fallback.highlights;

  return {
    name: repo.name,
    summary,
    highlights,
    technologies,
    repositoryUrl: repo.htmlUrl,
    liveUrl: fallback.liveUrl,
    featured,
  };
}

export function mergeGitHubIntoPortfolio(
  base: Portfolio,
  envelope: GitHubEnvelopeV1 | null,
): Portfolio {
  if (!envelope || envelope.selectedRepoIds.length === 0) return base;

  const repoMap = new Map(envelope.repos.map((r) => [r.id, r]));
  const selectedRepos = envelope.selectedRepoIds
    .map((id) => repoMap.get(id))
    .filter((r): r is GitHubRepoV1 => Boolean(r));

  if (selectedRepos.length === 0) return base;

  const fixture = createPortfolioDraft();
  const projects: [Project, Project, Project] = [0, 1, 2].map((index) => {
    const repo = selectedRepos[index];
    const fallback = base.projects[index] ?? fixture.projects[index];
    if (!repo) return fallback;
    return repoToProject(repo, fallback, index < 2);
  }) as [Project, Project, Project];

  return {
    ...base,
    projects,
    // Also update githubUrl in links if profile exists and base is still fixture
    links: {
      ...base.links,
      githubUrl: envelope.profile?.htmlUrl ?? base.links.githubUrl,
    },
  };
}

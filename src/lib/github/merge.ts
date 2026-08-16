import type { Portfolio, Project } from "@/lib/portfolio";
import { createPortfolioDraft } from "@/lib/portfolio";
import type { GitHubRepoV1 } from "./contracts";
import type { GitHubEnvelopeV1 } from "./persistence";

function getReadmeSnippet(
  envelope: GitHubEnvelopeV1,
  repoId: string,
): string | null {
  const readme = envelope.readmes[repoId];
  if (!readme?.content) return null;
  // Take first meaningful paragraph, strip markdown headings
  const firstParagraph = readme.content
    .split(/\n\s*\n/u)
    .map((p) => p.trim())
    .find((p) => p.length > 20);
  if (!firstParagraph) return null;
  // Remove leading markdown symbols
  return firstParagraph
    .replace(/^#+\s+/u, "")
    .trim()
    .slice(0, 400);
}

function repoToProject(
  repo: GitHubRepoV1,
  fallback: Project,
  featured: boolean,
  envelope: GitHubEnvelopeV1,
): Project {
  const technologies =
    [repo.primaryLanguage, ...repo.topics.slice(0, 5)]
      .filter((v): v is string => Boolean(v))
      .join(", ") || fallback.technologies;

  const readmeSnippet = getReadmeSnippet(envelope, repo.id);
  const summary = repo.description?.trim() || readmeSnippet || fallback.summary;

  // Highlights: prefer description, then README, then topics
  const rawHighlights: string[] = [];
  const highlightSource = repo.description?.trim() || readmeSnippet || "";
  if (highlightSource) {
    const sentences = highlightSource
      .split(/(?<=\.)\s+/u)
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (sentences[0]) rawHighlights.push(sentences[0].slice(0, 300));
    if (sentences[1] && rawHighlights.length < 2)
      rawHighlights.push(sentences[1].slice(0, 300));
  }
  if (rawHighlights.length < 2 && readmeSnippet) {
    const secondPara = readmeSnippet.split(/(?<=\.)\s+/u)[1]?.trim();
    if (secondPara && rawHighlights.length < 2)
      rawHighlights.push(secondPara.slice(0, 300));
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
    return repoToProject(repo, fallback, index < 2, envelope);
  }) as [Project, Project, Project];

  // Profile: GitHub is source of truth when available — fixes "Avery Morgan" staying after import
  const githubName =
    envelope.profile?.name?.trim() || envelope.profile?.login?.trim() || "";
  const githubBio = envelope.profile?.bio?.trim() ?? "";
  const githubAvatar = envelope.profile?.avatarUrl?.trim() ?? "";

  const nextProfile = {
    fullName: githubName || base.profile.fullName,
    headline: base.profile.headline,
    biography: githubBio || base.profile.biography,
    location: base.profile.location,
    avatarUrl: githubAvatar || base.profile.avatarUrl,
  };

  return {
    ...base,
    profile: nextProfile,
    projects,
    links: {
      ...base.links,
      githubUrl: envelope.profile?.htmlUrl ?? base.links.githubUrl,
    },
  };
}

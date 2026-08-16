import type { Portfolio, Project } from "@/lib/portfolio";
import { createPortfolioDraft } from "@/lib/portfolio";
import type { GitHubRepoV1 } from "./contracts";
import type { GitHubEnvelopeV1 } from "./persistence";
import { synthesizeHighlights, synthesizeSummary } from "./bio/synthesis";

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

  const readmeContent = envelope.readmes[repo.id]?.content ?? null;
  const summary = synthesizeSummary(repo, readmeContent);
  const highlights = synthesizeHighlights(repo, readmeContent);

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

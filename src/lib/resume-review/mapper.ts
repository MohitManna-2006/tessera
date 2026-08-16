import type {
  PartialDateV1,
  ResumeDraftV1,
} from "@/lib/resume-draft/contracts";
import {
  createPortfolioDraft,
  type Education,
  type Experience,
  type Portfolio,
  type Project,
  type SkillGroup,
} from "@/lib/portfolio";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function formatPartialDate(value: PartialDateV1 | null): string {
  if (!value) return "";
  if (value.precision === "year") return `${value.year}`;
  if (value.month !== null) {
    const monthLabel = MONTH_NAMES[value.month - 1] ?? "";
    return monthLabel ? `${monthLabel} ${value.year}` : `${value.year}`;
  }
  return `${value.year}`;
}

function formatDateRange(
  start: PartialDateV1 | null,
  end: PartialDateV1 | null,
  current: boolean | undefined,
): { startDate: string; endDate: string } {
  const startDate = formatPartialDate(start);
  if (current) return { startDate, endDate: "Present" };
  const endDate = formatPartialDate(end);
  return { startDate, endDate };
}

function coerceHighlights(
  values: readonly string[],
  fallback: [string, string],
): [string, string] {
  const first = values[0]?.trim() ?? "";
  const second = values[1]?.trim() ?? "";
  return [first || fallback[0], second || fallback[1]];
}

export function mapResumeDraftToPortfolio(
  draft: ResumeDraftV1,
  now = new Date(),
): Portfolio {
  const fixture = createPortfolioDraft();
  const data = draft.draft;

  // Profile
  const fullName = data.profile.name?.trim() || fixture.profile.fullName;
  const headline = data.profile.sourceTitle?.trim() || fixture.profile.headline;
  const location = data.profile.location?.trim() || fixture.profile.location;
  // Biography: concatenate first experience achievements or fallback
  const biographySource =
    data.experience[0]?.achievements
      .map((a) => a.text.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(" ") ?? "";
  const biography = biographySource
    ? biographySource.slice(0, 500)
    : fixture.profile.biography;

  // Links
  const githubLink = data.profile.links.find((l) => l.kind === "github");
  const linkedinLink = data.profile.links.find((l) => l.kind === "linkedin");
  const email = data.profile.email?.trim() ?? fixture.links.email;

  // Experience – exactly 2
  const experiences: [Experience, Experience] = [0, 1].map((index) => {
    const source = data.experience[index];
    const fallback = fixture.experience[index];
    if (!source) return fallback;
    const { startDate, endDate } = formatDateRange(
      source.startDate,
      source.endDate,
      source.current,
    );
    const highlights = coerceHighlights(
      source.achievements.map((a) => a.text),
      fallback.highlights,
    );
    return {
      organization: source.company?.trim() || fallback.organization,
      role: source.role?.trim() || fallback.role,
      location: source.location?.trim() || fallback.location,
      startDate: startDate || fallback.startDate,
      endDate: endDate || fallback.endDate,
      highlights,
    };
  }) as [Experience, Experience];

  // Projects – exactly 3
  const projects: [Project, Project, Project] = [0, 1, 2].map((index) => {
    const source = data.projects[index];
    const fallback = fixture.projects[index];
    if (!source) return fallback;
    const technologies =
      source.technologies.map((t) => t.name).join(", ") ||
      fallback.technologies;
    const summary = source.description?.trim() || fallback.summary;
    const name = source.name?.trim() || fallback.name;
    // Highlights: use role + first sentence split if needed
    const rawHighlights: string[] = [];
    if (source.role?.trim()) rawHighlights.push(source.role.trim());
    if (source.description?.trim()) {
      const sentences = source.description
        .split(/(?<=\.)\s+/u)
        .map((s) => s.trim())
        .filter(Boolean);
      if (sentences[0] && rawHighlights.length < 2) {
        rawHighlights.push(sentences[0]);
      }
      if (sentences[1] && rawHighlights.length < 2) {
        rawHighlights.push(sentences[1]);
      }
    }
    const highlights = coerceHighlights(rawHighlights, fallback.highlights);
    return {
      name,
      summary,
      highlights,
      technologies,
      repositoryUrl: source.repositoryUrl?.trim() || fallback.repositoryUrl,
      liveUrl: source.liveUrl?.trim() || fallback.liveUrl,
      featured: index < 2,
    };
  }) as [Project, Project, Project];

  // SkillGroups – exactly 3
  // Group skills by group name, sort by size desc then alpha
  const grouped = new Map<string, string[]>();
  for (const skill of data.skills) {
    const list = grouped.get(skill.group) ?? [];
    list.push(skill.name);
    grouped.set(skill.group, list);
  }
  const sortedGroups = Array.from(grouped.entries())
    .sort((a, b) => {
      if (b[1].length !== a[1].length) return b[1].length - a[1].length;
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 3);
  const skillGroups: [SkillGroup, SkillGroup, SkillGroup] = [0, 1, 2].map(
    (index) => {
      const entry = sortedGroups[index];
      const fallback = fixture.skillGroups[index];
      if (!entry) return fallback;
      return {
        name: entry[0],
        skills: entry[1].join(", "),
      };
    },
  ) as [SkillGroup, SkillGroup, SkillGroup];

  // Education – single
  const eduSource = data.education[0];
  let education: Education = fixture.education;
  if (eduSource) {
    const { startDate, endDate } = formatDateRange(
      eduSource.startDate,
      eduSource.endDate,
      eduSource.expected,
    );
    education = {
      institution:
        eduSource.institution?.trim() || fixture.education.institution,
      degree: eduSource.degree?.trim() || fixture.education.degree,
      field: eduSource.field?.trim() || fixture.education.field,
      startDate: startDate || fixture.education.startDate,
      endDate: eduSource.expected
        ? "Expected " + (endDate || String(now.getFullYear() + 1))
        : endDate || fixture.education.endDate,
    };
  }

  return {
    profile: {
      fullName,
      headline,
      biography,
      location,
      avatarUrl: fixture.profile.avatarUrl,
    },
    links: {
      email,
      githubUrl: githubLink?.url ?? fixture.links.githubUrl,
      linkedinUrl: linkedinLink?.url ?? fixture.links.linkedinUrl,
    },
    experience: experiences,
    projects,
    skillGroups,
    education,
  };
}

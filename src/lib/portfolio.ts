export const PORTFOLIO_SECTION_ORDER = [
  "profile",
  "links",
  "experience",
  "projects",
  "skills",
  "education",
] as const;

export type PortfolioSectionId = (typeof PORTFOLIO_SECTION_ORDER)[number];

export type Experience = {
  organization: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  highlights: [string, string];
};

export type Project = {
  name: string;
  summary: string;
  highlights: [string, string];
  technologies: string;
  repositoryUrl: string;
  liveUrl: string;
  featured: boolean;
};

export type SkillGroup = {
  name: string;
  skills: string;
};

export type Education = {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
};

export type Portfolio = {
  profile: {
    fullName: string;
    headline: string;
    biography: string;
    location: string;
  };
  links: {
    email: string;
    githubUrl: string;
    linkedinUrl: string;
  };
  experience: [Experience, Experience];
  projects: [Project, Project, Project];
  skillGroups: [SkillGroup, SkillGroup, SkillGroup];
  education: Education;
};

export const portfolioFixture: Portfolio = {
  profile: {
    fullName: "Avery Morgan",
    headline: "Software engineer focused on dependable developer tools",
    biography:
      "I build practical web applications and internal tools with an emphasis on clear interfaces, reliable data flows, and maintainable systems.",
    location: "Portland, Oregon",
  },
  links: {
    email: "avery.morgan@example.com",
    githubUrl: "https://github.com/averymorgan",
    linkedinUrl: "https://www.linkedin.com/in/avery-morgan",
  },
  experience: [
    {
      organization: "Northstar Systems",
      role: "Software Engineering Intern",
      location: "Portland, Oregon",
      startDate: "May 2025",
      endDate: "Aug 2025",
      highlights: [
        "Built an internal release dashboard that brought deployment status and service ownership into one searchable view.",
        "Added integration tests for shared API clients and documented a repeatable local testing workflow.",
      ],
    },
    {
      organization: "Civic Data Lab",
      role: "Frontend Developer, Student Team",
      location: "Corvallis, Oregon",
      startDate: "Sep 2024",
      endDate: "Mar 2025",
      highlights: [
        "Developed accessible data filters and table views for a public records research tool.",
        "Worked with researchers to turn dense source material into concise, traceable interface copy.",
      ],
    },
  ],
  projects: [
    {
      name: "Patchwork",
      summary:
        "A local-first issue notebook for small engineering teams that need fast capture and dependable search.",
      highlights: [
        "Designed an offline-capable editing flow with conflict-aware updates.",
        "Added full-text search and keyboard navigation across issue records.",
      ],
      technologies: "TypeScript, React, IndexedDB, Vitest",
      repositoryUrl: "https://github.com/averymorgan/patchwork",
      liveUrl: "",
      featured: true,
    },
    {
      name: "Tracebench",
      summary:
        "A compact web interface for comparing structured application traces during local development.",
      highlights: [
        "Normalized trace events into a consistent inspection model.",
        "Built side-by-side filtering for requests, spans, and timing data.",
      ],
      technologies: "Next.js, TypeScript, PostgreSQL, Playwright",
      repositoryUrl: "https://github.com/averymorgan/tracebench",
      liveUrl: "https://tracebench.example.com",
      featured: true,
    },
    {
      name: "Course Map",
      summary:
        "A degree-planning tool that makes prerequisites and term availability easier to review.",
      highlights: [
        "Modeled prerequisite relationships and incomplete course data.",
        "Tested responsive planning flows with students using small screens.",
      ],
      technologies: "React, Node.js, SQLite, Testing Library",
      repositoryUrl: "https://github.com/averymorgan/course-map",
      liveUrl: "",
      featured: false,
    },
  ],
  skillGroups: [
    {
      name: "Languages",
      skills: "TypeScript, JavaScript, Python, SQL",
    },
    {
      name: "Web",
      skills: "React, Next.js, Node.js, HTML, CSS",
    },
    {
      name: "Tools",
      skills: "Git, PostgreSQL, Playwright, Vitest, Docker",
    },
  ],
  education: {
    institution: "Oregon State University",
    degree: "Bachelor of Science",
    field: "Computer Science",
    startDate: "2022",
    endDate: "2026",
  },
};

export function createPortfolioDraft(): Portfolio {
  return structuredClone(portfolioFixture);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidHttpUrl(value: string): boolean {
  if (!value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function formatUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return value;
  }
}

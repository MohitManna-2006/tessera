import {
  isValidEmail,
  isValidHttpUrl,
  PORTFOLIO_SCHEMA_VERSION,
  PORTFOLIO_SECTION_ORDER,
  type Education,
  type Experience,
  type Portfolio,
  type PortfolioSectionId,
  type Project,
  type SkillGroup,
} from "./portfolio";

const MAX_EXPORT_PAYLOAD_LENGTH = 100_000;
const MAX_STRING_LENGTH = 10_000;

export type PortfolioExportRequest = {
  schemaVersion: typeof PORTFOLIO_SCHEMA_VERSION;
  sectionOrder: readonly PortfolioSectionId[];
  portfolio: Portfolio;
};

export type PortfolioValidationIssue = {
  path: string;
  message: string;
  section?: PortfolioSectionId;
  fieldId?: string;
};

export type PortfolioValidationResult =
  | {
      success: true;
      data: PortfolioExportRequest;
      issues: [];
    }
  | {
      success: false;
      issues: PortfolioValidationIssue[];
    };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: string) {
  return value.replace(/\r\n?/g, "\n");
}

function validateObjectKeys(
  value: unknown,
  expectedKeys: readonly string[],
  path: string,
  issues: PortfolioValidationIssue[],
  section?: PortfolioSectionId,
): value is UnknownRecord {
  if (!isRecord(value)) {
    issues.push({
      path,
      message: "Expected an object.",
      section,
    });
    return false;
  }

  const expected = new Set(expectedKeys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      issues.push({
        path: `${path}.${key}`,
        message: "Unexpected field.",
        section,
      });
    }
  }
  for (const key of expectedKeys) {
    if (!(key in value)) {
      issues.push({
        path: `${path}.${key}`,
        message: "Required field is missing.",
        section,
      });
    }
  }

  return true;
}

function readString(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: PortfolioValidationIssue[],
  section: PortfolioSectionId,
  fieldId?: string,
) {
  const value = record[key];
  if (typeof value !== "string") {
    issues.push({
      path: `${path}.${key}`,
      message: "Expected text.",
      section,
      fieldId,
    });
    return "";
  }
  if (value.length > MAX_STRING_LENGTH) {
    issues.push({
      path: `${path}.${key}`,
      message: "Text is too long to export.",
      section,
      fieldId,
    });
  }
  return normalizeText(value);
}

function readBoolean(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: PortfolioValidationIssue[],
  section: PortfolioSectionId,
) {
  const value = record[key];
  if (typeof value !== "boolean") {
    issues.push({
      path: `${path}.${key}`,
      message: "Expected true or false.",
      section,
    });
    return false;
  }
  return value;
}

function readStringTuple(
  value: unknown,
  path: string,
  issues: PortfolioValidationIssue[],
  section: PortfolioSectionId,
  fieldId: (index: number) => string,
): [string, string] {
  if (!Array.isArray(value) || value.length !== 2) {
    issues.push({
      path,
      message: "Expected exactly two entries.",
      section,
    });
    return ["", ""];
  }

  return value.map((entry, index) => {
    if (typeof entry !== "string") {
      issues.push({
        path: `${path}.${index}`,
        message: "Expected text.",
        section,
        fieldId: fieldId(index),
      });
      return "";
    }
    if (entry.length > MAX_STRING_LENGTH) {
      issues.push({
        path: `${path}.${index}`,
        message: "Text is too long to export.",
        section,
        fieldId: fieldId(index),
      });
    }
    return normalizeText(entry);
  }) as [string, string];
}

function readExperience(
  value: unknown,
  index: number,
  issues: PortfolioValidationIssue[],
): Experience {
  const path = `portfolio.experience.${index}`;
  if (
    !validateObjectKeys(
      value,
      [
        "organization",
        "role",
        "location",
        "startDate",
        "endDate",
        "highlights",
      ],
      path,
      issues,
      "experience",
    )
  ) {
    return {
      organization: "",
      role: "",
      location: "",
      startDate: "",
      endDate: "",
      highlights: ["", ""],
    };
  }

  return {
    organization: readString(
      value,
      "organization",
      path,
      issues,
      "experience",
      `experience-${index}-organization`,
    ),
    role: readString(
      value,
      "role",
      path,
      issues,
      "experience",
      `experience-${index}-role`,
    ),
    location: readString(
      value,
      "location",
      path,
      issues,
      "experience",
      `experience-${index}-location`,
    ),
    startDate: readString(
      value,
      "startDate",
      path,
      issues,
      "experience",
      `experience-${index}-start`,
    ),
    endDate: readString(
      value,
      "endDate",
      path,
      issues,
      "experience",
      `experience-${index}-end`,
    ),
    highlights: readStringTuple(
      value.highlights,
      `${path}.highlights`,
      issues,
      "experience",
      (highlightIndex) => `experience-${index}-highlight-${highlightIndex}`,
    ),
  };
}

function readProject(
  value: unknown,
  index: number,
  issues: PortfolioValidationIssue[],
): Project {
  const path = `portfolio.projects.${index}`;
  if (
    !validateObjectKeys(
      value,
      [
        "name",
        "summary",
        "highlights",
        "technologies",
        "repositoryUrl",
        "liveUrl",
        "featured",
      ],
      path,
      issues,
      "projects",
    )
  ) {
    return {
      name: "",
      summary: "",
      highlights: ["", ""],
      technologies: "",
      repositoryUrl: "",
      liveUrl: "",
      featured: false,
    };
  }

  const repositoryUrl = readString(
    value,
    "repositoryUrl",
    path,
    issues,
    "projects",
    `project-${index}-repository`,
  );
  const liveUrl = readString(
    value,
    "liveUrl",
    path,
    issues,
    "projects",
    `project-${index}-live`,
  );

  if (repositoryUrl && !isValidHttpUrl(repositoryUrl)) {
    issues.push({
      path: `${path}.repositoryUrl`,
      message: "Enter a full URL beginning with http:// or https://.",
      section: "projects",
      fieldId: `project-${index}-repository`,
    });
  }
  if (liveUrl && !isValidHttpUrl(liveUrl)) {
    issues.push({
      path: `${path}.liveUrl`,
      message: "Enter a full URL beginning with http:// or https://.",
      section: "projects",
      fieldId: `project-${index}-live`,
    });
  }

  return {
    name: readString(
      value,
      "name",
      path,
      issues,
      "projects",
      `project-${index}-name`,
    ),
    summary: readString(
      value,
      "summary",
      path,
      issues,
      "projects",
      `project-${index}-summary`,
    ),
    highlights: readStringTuple(
      value.highlights,
      `${path}.highlights`,
      issues,
      "projects",
      (highlightIndex) => `project-${index}-highlight-${highlightIndex}`,
    ),
    technologies: readString(
      value,
      "technologies",
      path,
      issues,
      "projects",
      `project-${index}-technologies`,
    ),
    repositoryUrl,
    liveUrl,
    featured: readBoolean(value, "featured", path, issues, "projects"),
  };
}

function readSkillGroup(
  value: unknown,
  index: number,
  issues: PortfolioValidationIssue[],
): SkillGroup {
  const path = `portfolio.skillGroups.${index}`;
  if (!validateObjectKeys(value, ["name", "skills"], path, issues, "skills")) {
    return { name: "", skills: "" };
  }

  return {
    name: readString(
      value,
      "name",
      path,
      issues,
      "skills",
      `skill-${index}-name`,
    ),
    skills: readString(
      value,
      "skills",
      path,
      issues,
      "skills",
      `skill-${index}-items`,
    ),
  };
}

function readEducation(
  value: unknown,
  issues: PortfolioValidationIssue[],
): Education {
  const path = "portfolio.education";
  if (
    !validateObjectKeys(
      value,
      ["institution", "degree", "field", "startDate", "endDate"],
      path,
      issues,
      "education",
    )
  ) {
    return {
      institution: "",
      degree: "",
      field: "",
      startDate: "",
      endDate: "",
    };
  }

  return {
    institution: readString(
      value,
      "institution",
      path,
      issues,
      "education",
      "education-institution",
    ),
    degree: readString(
      value,
      "degree",
      path,
      issues,
      "education",
      "education-degree",
    ),
    field: readString(
      value,
      "field",
      path,
      issues,
      "education",
      "education-field",
    ),
    startDate: readString(
      value,
      "startDate",
      path,
      issues,
      "education",
      "education-start",
    ),
    endDate: readString(
      value,
      "endDate",
      path,
      issues,
      "education",
      "education-end",
    ),
  };
}

function readPortfolio(
  value: unknown,
  issues: PortfolioValidationIssue[],
): Portfolio {
  if (
    !validateObjectKeys(
      value,
      [
        "profile",
        "links",
        "experience",
        "projects",
        "skillGroups",
        "education",
      ],
      "portfolio",
      issues,
    )
  ) {
    return {
      profile: { fullName: "", headline: "", biography: "", location: "" },
      links: { email: "", githubUrl: "", linkedinUrl: "" },
      experience: [
        {
          organization: "",
          role: "",
          location: "",
          startDate: "",
          endDate: "",
          highlights: ["", ""],
        },
        {
          organization: "",
          role: "",
          location: "",
          startDate: "",
          endDate: "",
          highlights: ["", ""],
        },
      ],
      projects: [
        {
          name: "",
          summary: "",
          highlights: ["", ""],
          technologies: "",
          repositoryUrl: "",
          liveUrl: "",
          featured: false,
        },
        {
          name: "",
          summary: "",
          highlights: ["", ""],
          technologies: "",
          repositoryUrl: "",
          liveUrl: "",
          featured: false,
        },
        {
          name: "",
          summary: "",
          highlights: ["", ""],
          technologies: "",
          repositoryUrl: "",
          liveUrl: "",
          featured: false,
        },
      ],
      skillGroups: [
        { name: "", skills: "" },
        { name: "", skills: "" },
        { name: "", skills: "" },
      ],
      education: {
        institution: "",
        degree: "",
        field: "",
        startDate: "",
        endDate: "",
      },
    };
  }

  const profilePath = "portfolio.profile";
  const profileValue = value.profile;
  const profile = validateObjectKeys(
    profileValue,
    ["fullName", "headline", "biography", "location"],
    profilePath,
    issues,
    "profile",
  )
    ? {
        fullName: readString(
          profileValue,
          "fullName",
          profilePath,
          issues,
          "profile",
          "full-name",
        ),
        headline: readString(
          profileValue,
          "headline",
          profilePath,
          issues,
          "profile",
          "headline",
        ),
        biography: readString(
          profileValue,
          "biography",
          profilePath,
          issues,
          "profile",
          "biography",
        ),
        location: readString(
          profileValue,
          "location",
          profilePath,
          issues,
          "profile",
          "location",
        ),
      }
    : { fullName: "", headline: "", biography: "", location: "" };

  const linksPath = "portfolio.links";
  const linksValue = value.links;
  let links = { email: "", githubUrl: "", linkedinUrl: "" };
  if (
    validateObjectKeys(
      linksValue,
      ["email", "githubUrl", "linkedinUrl"],
      linksPath,
      issues,
      "links",
    )
  ) {
    links = {
      email: readString(
        linksValue,
        "email",
        linksPath,
        issues,
        "links",
        "email",
      ),
      githubUrl: readString(
        linksValue,
        "githubUrl",
        linksPath,
        issues,
        "links",
        "github-url",
      ),
      linkedinUrl: readString(
        linksValue,
        "linkedinUrl",
        linksPath,
        issues,
        "links",
        "linkedin-url",
      ),
    };

    if (links.email && !isValidEmail(links.email)) {
      issues.push({
        path: `${linksPath}.email`,
        message: "Enter a complete email address.",
        section: "links",
        fieldId: "email",
      });
    }
    if (links.githubUrl && !isValidHttpUrl(links.githubUrl)) {
      issues.push({
        path: `${linksPath}.githubUrl`,
        message: "Enter a full URL beginning with http:// or https://.",
        section: "links",
        fieldId: "github-url",
      });
    }
    if (links.linkedinUrl && !isValidHttpUrl(links.linkedinUrl)) {
      issues.push({
        path: `${linksPath}.linkedinUrl`,
        message: "Enter a full URL beginning with http:// or https://.",
        section: "links",
        fieldId: "linkedin-url",
      });
    }
  }

  const experienceValue = value.experience;
  if (!Array.isArray(experienceValue) || experienceValue.length !== 2) {
    issues.push({
      path: "portfolio.experience",
      message: "Expected exactly two experience entries.",
      section: "experience",
    });
  }
  const experience = [0, 1].map((index) =>
    readExperience(
      Array.isArray(experienceValue) ? experienceValue[index] : undefined,
      index,
      issues,
    ),
  ) as [Experience, Experience];

  const projectsValue = value.projects;
  if (!Array.isArray(projectsValue) || projectsValue.length !== 3) {
    issues.push({
      path: "portfolio.projects",
      message: "Expected exactly three project entries.",
      section: "projects",
    });
  }
  const projects = [0, 1, 2].map((index) =>
    readProject(
      Array.isArray(projectsValue) ? projectsValue[index] : undefined,
      index,
      issues,
    ),
  ) as [Project, Project, Project];

  const skillGroupsValue = value.skillGroups;
  if (!Array.isArray(skillGroupsValue) || skillGroupsValue.length !== 3) {
    issues.push({
      path: "portfolio.skillGroups",
      message: "Expected exactly three skill groups.",
      section: "skills",
    });
  }
  const skillGroups = [0, 1, 2].map((index) =>
    readSkillGroup(
      Array.isArray(skillGroupsValue) ? skillGroupsValue[index] : undefined,
      index,
      issues,
    ),
  ) as [SkillGroup, SkillGroup, SkillGroup];

  return {
    profile,
    links,
    experience,
    projects,
    skillGroups,
    education: readEducation(value.education, issues),
  };
}

export function validatePortfolioExportRequest(
  value: unknown,
): PortfolioValidationResult {
  const issues: PortfolioValidationIssue[] = [];

  let serializedLength = 0;
  try {
    serializedLength = JSON.stringify(value).length;
  } catch {
    return {
      success: false,
      issues: [
        { path: "request", message: "Export data is not serializable." },
      ],
    };
  }
  if (serializedLength > MAX_EXPORT_PAYLOAD_LENGTH) {
    return {
      success: false,
      issues: [{ path: "request", message: "Portfolio data is too large." }],
    };
  }

  if (
    !validateObjectKeys(
      value,
      ["schemaVersion", "sectionOrder", "portfolio"],
      "request",
      issues,
    )
  ) {
    return { success: false, issues };
  }

  if (value.schemaVersion !== PORTFOLIO_SCHEMA_VERSION) {
    issues.push({
      path: "request.schemaVersion",
      message: "Unsupported portfolio schema version.",
    });
  }

  const sectionOrder = value.sectionOrder;
  if (
    !Array.isArray(sectionOrder) ||
    sectionOrder.length !== PORTFOLIO_SECTION_ORDER.length ||
    sectionOrder.some(
      (section, index) => section !== PORTFOLIO_SECTION_ORDER[index],
    )
  ) {
    issues.push({
      path: "request.sectionOrder",
      message: "Portfolio section order is not supported.",
    });
  }

  const portfolio = readPortfolio(value.portfolio, issues);
  if (issues.length > 0) {
    return { success: false, issues };
  }

  return {
    success: true,
    data: {
      schemaVersion: PORTFOLIO_SCHEMA_VERSION,
      sectionOrder: [...PORTFOLIO_SECTION_ORDER],
      portfolio,
    },
    issues: [],
  };
}

export function createPortfolioExportSnapshot(
  portfolio: Portfolio,
): PortfolioValidationResult {
  return validatePortfolioExportRequest({
    schemaVersion: PORTFOLIO_SCHEMA_VERSION,
    sectionOrder: [...PORTFOLIO_SECTION_ORDER],
    portfolio: structuredClone(portfolio),
  });
}

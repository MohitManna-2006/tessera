import {
  DRAFT_FIELD_KEYS,
  type DraftFieldKey,
  type DraftFieldReferenceV1,
  OpaqueResumeIdSchema,
  RESUME_DRAFT_OPERATION,
  RESUME_EXTRACTION_PROMPT_VERSION,
  ResumeDraftV1Schema,
  type ResumeDraftV1,
  type ResumeEvidenceV1,
  type ResumeReviewSection,
  SafeHttpUrlSchema,
  type ResumeWarningV1,
} from "./contracts";
import {
  ProviderResumeDraftV1Schema,
  type ProviderEvidenceClaimV1,
} from "./provider-contract";
import { verifyEvidenceExcerpt } from "./evidence";

type TrustedIdPrefix =
  | "draft"
  | "link"
  | "experience"
  | "achievement"
  | "project"
  | "technology"
  | "skill"
  | "education"
  | "honor"
  | "evidence"
  | "warning";

export type TrustedIdFactory = (prefix: TrustedIdPrefix) => string;

export const createTrustedResumeId: TrustedIdFactory = (prefix) =>
  `${prefix}_${crypto.randomUUID()}`;

type ProviderFact<Value> = {
  value: Value;
  evidence: ProviderEvidenceClaimV1 | null;
};

type EntryMaps = {
  links: string[];
  experience: string[];
  achievements: string[][];
  projects: string[];
  technologies: string[][];
  skills: string[];
  education: string[];
  honors: string[][];
};

const STREET_ADDRESS_PATTERN =
  /\b\d{1,6}\s+[\p{L}\d.'-]+(?:\s+[\p{L}\d.'-]+){0,4}\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way)\b/iu;

function assertTrustedId(id: string): string {
  return OpaqueResumeIdSchema.parse(id);
}

function trimNullable(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeUrl(value: string | null): string | null {
  const trimmed = trimNullable(value);
  if (trimmed === null) {
    return null;
  }
  SafeHttpUrlSchema.parse(trimmed);
  return new URL(trimmed).toString();
}

function wordCount(text: string): number {
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}.'’@:/+-]*/gu)?.length ?? 0;
}

function sectionForField(field: DraftFieldKey): ResumeReviewSection {
  if (field.startsWith("profile.")) {
    return "profile";
  }
  if (field.startsWith("experience.")) {
    return "experience";
  }
  if (field.startsWith("projects.")) {
    return "projects";
  }
  if (field.startsWith("skills.")) {
    return "skills";
  }
  return "education";
}

function fieldLabel(field: DraftFieldKey): string {
  const labels: Record<DraftFieldKey, string> = {
    "profile.name": "name",
    "profile.sourceTitle": "resume title",
    "profile.location": "location",
    "profile.email": "email",
    "profile.phone": "phone",
    "profile.links.label": "link label",
    "profile.links.url": "link URL",
    "profile.links.kind": "link type",
    "experience.company": "employer",
    "experience.role": "role",
    "experience.location": "experience location",
    "experience.employmentType": "employment type",
    "experience.startDate": "experience start date",
    "experience.endDate": "experience end date",
    "experience.current": "current-role status",
    "experience.achievements.text": "achievement",
    "projects.name": "project name",
    "projects.description": "project description",
    "projects.role": "project role",
    "projects.technologies.name": "project technology",
    "projects.startDate": "project start date",
    "projects.endDate": "project end date",
    "projects.repositoryUrl": "repository URL",
    "projects.liveUrl": "live URL",
    "skills.name": "skill",
    "skills.group": "skill group",
    "education.institution": "institution",
    "education.degree": "degree",
    "education.field": "field of study",
    "education.location": "education location",
    "education.startDate": "education start date",
    "education.endDate": "education end date",
    "education.expected": "expected-graduation status",
    "education.gpa": "GPA",
    "education.honors.text": "honor",
  };
  return labels[field];
}

function resolveReference(
  field: DraftFieldKey,
  maps: EntryMaps,
  entryIndex: number | null,
  itemIndex: number | null,
): DraftFieldReferenceV1 | null {
  const section = sectionForField(field);
  let entryId: string | null = null;
  let itemId: string | null = null;

  if (field.startsWith("profile.links.")) {
    entryId = entryIndex === null ? null : (maps.links[entryIndex] ?? null);
  } else if (field.startsWith("experience.")) {
    entryId =
      entryIndex === null ? null : (maps.experience[entryIndex] ?? null);
    if (field === "experience.achievements.text") {
      itemId =
        entryIndex === null || itemIndex === null
          ? null
          : (maps.achievements[entryIndex]?.[itemIndex] ?? null);
    }
  } else if (field.startsWith("projects.")) {
    entryId = entryIndex === null ? null : (maps.projects[entryIndex] ?? null);
    if (field === "projects.technologies.name") {
      itemId =
        entryIndex === null || itemIndex === null
          ? null
          : (maps.technologies[entryIndex]?.[itemIndex] ?? null);
    }
  } else if (field.startsWith("skills.")) {
    entryId = entryIndex === null ? null : (maps.skills[entryIndex] ?? null);
  } else if (field.startsWith("education.")) {
    entryId = entryIndex === null ? null : (maps.education[entryIndex] ?? null);
    if (field === "education.honors.text") {
      itemId =
        entryIndex === null || itemIndex === null
          ? null
          : (maps.honors[entryIndex]?.[itemIndex] ?? null);
    }
  }

  const requiresEntry =
    field.startsWith("profile.links.") ||
    field.startsWith("experience.") ||
    field.startsWith("projects.") ||
    field.startsWith("skills.") ||
    field.startsWith("education.");
  const requiresItem =
    field === "experience.achievements.text" ||
    field === "projects.technologies.name" ||
    field === "education.honors.text";

  if (
    (requiresEntry && entryId === null) ||
    (requiresItem && itemId === null)
  ) {
    return null;
  }

  return {
    section,
    field,
    entryId,
    itemId,
  };
}

function comparePartialDates(
  start: { year: number; month: number | null },
  end: { year: number; month: number | null },
): number | null {
  if (start.year !== end.year) {
    return start.year - end.year;
  }
  if (start.month === null || end.month === null) {
    return null;
  }
  return start.month - end.month;
}

type NormalizeProviderDraftOptions = {
  providerOutput: unknown;
  sourceText: string;
  source: {
    filename: string;
    pageCount: number;
  };
  now?: () => Date;
  createId?: TrustedIdFactory;
};

export function normalizeProviderResumeDraft({
  providerOutput,
  sourceText,
  source,
  now = () => new Date(),
  createId = createTrustedResumeId,
}: NormalizeProviderDraftOptions): ResumeDraftV1 {
  const provider = ProviderResumeDraftV1Schema.parse(providerOutput);
  const id = (prefix: TrustedIdPrefix) => assertTrustedId(createId(prefix));
  const evidence: ResumeEvidenceV1[] = [];
  const warnings: ResumeWarningV1[] = [];
  const maps: EntryMaps = {
    links: [],
    experience: [],
    achievements: [],
    projects: [],
    technologies: [],
    skills: [],
    education: [],
    honors: [],
  };

  const addWarning = (
    section: ResumeReviewSection,
    target: DraftFieldReferenceV1 | null,
    severity: ResumeWarningV1["severity"],
    category: ResumeWarningV1["category"],
    message: string,
  ) => {
    warnings.push({
      id: id("warning"),
      section,
      target,
      severity,
      category,
      message,
    });
  };

  const addEvidence = (
    fact: ProviderFact<unknown>,
    field: DraftFieldKey,
    entryIndex: number | null,
    itemIndex: number | null,
    isSubstantive: (value: unknown) => boolean,
  ) => {
    if (!isSubstantive(fact.value)) {
      return;
    }

    const target = resolveReference(field, maps, entryIndex, itemIndex);
    if (target === null) {
      return;
    }
    if (fact.evidence === null) {
      addWarning(
        target.section,
        target,
        "review",
        "provider_omission",
        `Review the ${fieldLabel(field)} because no supporting resume excerpt was provided.`,
      );
      return;
    }

    const excerpt = fact.evidence.sourceExcerpt;
    const match =
      excerpt === null
        ? { matched: false, normalization: "none" as const }
        : verifyEvidenceExcerpt(sourceText, excerpt);
    const needsVerifiedExcerpt =
      fact.evidence.support === "direct" ||
      fact.evidence.support === "reformatted";
    const matched = excerpt !== null && match.matched;
    const support =
      needsVerifiedExcerpt && !matched
        ? ("unsupported" as const)
        : fact.evidence.support;
    const transformation =
      match.normalization === "none"
        ? fact.evidence.transformation
        : match.normalization;

    evidence.push({
      id: id("evidence"),
      target,
      sourceExcerpt: excerpt,
      support,
      transformation,
      matched,
    });

    if (needsVerifiedExcerpt && !matched) {
      addWarning(
        target.section,
        target,
        "review",
        "evidence_mismatch",
        `Tessera could not verify the ${fieldLabel(field)} in the extracted resume text. Confirm or edit it.`,
      );
    } else if (
      support === "ambiguous" ||
      support === "unsupported" ||
      !matched
    ) {
      addWarning(
        target.section,
        target,
        "review",
        support === "ambiguous" ? "ambiguous_source" : "unsupported_claim",
        `Confirm the ${fieldLabel(field)} because the resume evidence is incomplete or ambiguous.`,
      );
    }
  };

  const profileLocation = trimNullable(provider.profile.location.value);
  const streetAddressOmitted =
    profileLocation !== null && STREET_ADDRESS_PATTERN.test(profileLocation);

  const links = provider.profile.links.map((link, linkIndex) => {
    const linkId = id("link");
    maps.links[linkIndex] = linkId;
    return {
      id: linkId,
      label: trimNullable(link.label.value) ?? "Other",
      url: normalizeUrl(link.url.value) ?? "",
      kind: link.kind.value,
      public: false as const,
    };
  });

  const experience = provider.experience.map((entry, entryIndex) => {
    const entryId = id("experience");
    maps.experience[entryIndex] = entryId;
    maps.achievements[entryIndex] = [];
    return {
      id: entryId,
      company: trimNullable(entry.company.value),
      role: trimNullable(entry.role.value),
      location: trimNullable(entry.location.value),
      employmentType: trimNullable(entry.employmentType.value),
      startDate: entry.startDate.value,
      endDate: entry.endDate.value,
      current: entry.current.value,
      achievements: entry.achievements
        .map((achievement, itemIndex) => {
          const text = trimNullable(achievement.text.value);
          if (text === null) {
            return null;
          }
          const achievementId = id("achievement");
          maps.achievements[entryIndex][itemIndex] = achievementId;
          return { id: achievementId, text };
        })
        .filter((value) => value !== null),
    };
  });

  const projects = provider.projects.map((project, entryIndex) => {
    const entryId = id("project");
    maps.projects[entryIndex] = entryId;
    maps.technologies[entryIndex] = [];
    return {
      id: entryId,
      name: trimNullable(project.name.value),
      description: trimNullable(project.description.value),
      role: trimNullable(project.role.value),
      technologies: project.technologies
        .map((technology, itemIndex) => {
          const name = trimNullable(technology.name.value);
          if (name === null) {
            return null;
          }
          const technologyId = id("technology");
          maps.technologies[entryIndex][itemIndex] = technologyId;
          return { id: technologyId, name };
        })
        .filter((value) => value !== null),
      startDate: project.startDate.value,
      endDate: project.endDate.value,
      repositoryUrl: normalizeUrl(project.repositoryUrl.value),
      liveUrl: normalizeUrl(project.liveUrl.value),
    };
  });

  const seenSkills = new Map<string, string>();
  const skills = provider.skills
    .map((skill, entryIndex) => {
      const name = trimNullable(skill.name.value);
      if (name === null) {
        return null;
      }
      const normalizedName = name.toLocaleLowerCase("en-US");
      const existingId = seenSkills.get(normalizedName);
      if (existingId) {
        maps.skills[entryIndex] = existingId;
        addWarning(
          "skills",
          {
            section: "skills",
            field: "skills.name",
            entryId: existingId,
            itemId: null,
          },
          "review",
          "duplicate_entry",
          `${name} appeared more than once and was kept once. Review the retained skill.`,
        );
        return null;
      }
      const skillId = id("skill");
      seenSkills.set(normalizedName, skillId);
      maps.skills[entryIndex] = skillId;
      return {
        id: skillId,
        name,
        group: trimNullable(skill.group.value) ?? "Other",
      };
    })
    .filter((value) => value !== null);

  const education = provider.education.map((entry, entryIndex) => {
    const entryId = id("education");
    maps.education[entryIndex] = entryId;
    maps.honors[entryIndex] = [];
    return {
      id: entryId,
      institution: trimNullable(entry.institution.value),
      degree: trimNullable(entry.degree.value),
      field: trimNullable(entry.field.value),
      location: trimNullable(entry.location.value),
      startDate: entry.startDate.value,
      endDate: entry.endDate.value,
      expected: entry.expected.value,
      gpa: trimNullable(entry.gpa.value),
      gpaPublic: false as const,
      honors: entry.honors
        .map((honor, itemIndex) => {
          const text = trimNullable(honor.text.value);
          if (text === null) {
            return null;
          }
          const honorId = id("honor");
          maps.honors[entryIndex][itemIndex] = honorId;
          return { id: honorId, text };
        })
        .filter((value) => value !== null),
    };
  });

  const profile = {
    name: trimNullable(provider.profile.name.value),
    sourceTitle: trimNullable(provider.profile.sourceTitle.value),
    location: streetAddressOmitted ? null : profileLocation,
    email: trimNullable(provider.profile.email.value),
    emailPublic: false as const,
    phone: trimNullable(provider.profile.phone.value),
    phonePublic: false as const,
    links,
  };

  addEvidence(
    provider.profile.name,
    "profile.name",
    null,
    null,
    (value) => value !== null,
  );
  addEvidence(
    provider.profile.sourceTitle,
    "profile.sourceTitle",
    null,
    null,
    (value) => value !== null,
  );
  if (!streetAddressOmitted) {
    addEvidence(
      provider.profile.location,
      "profile.location",
      null,
      null,
      (value) => value !== null,
    );
  }
  addEvidence(
    provider.profile.email,
    "profile.email",
    null,
    null,
    (value) => value !== null,
  );
  addEvidence(
    provider.profile.phone,
    "profile.phone",
    null,
    null,
    (value) => value !== null,
  );
  provider.profile.links.forEach((link, index) => {
    addEvidence(
      link.label,
      "profile.links.label",
      index,
      null,
      (value) => value !== null,
    );
    addEvidence(
      link.url,
      "profile.links.url",
      index,
      null,
      (value) => value !== null,
    );
    addEvidence(link.kind, "profile.links.kind", index, null, () => true);
  });

  provider.experience.forEach((entry, entryIndex) => {
    const fields = [
      ["company", "experience.company"],
      ["role", "experience.role"],
      ["location", "experience.location"],
      ["employmentType", "experience.employmentType"],
      ["startDate", "experience.startDate"],
      ["endDate", "experience.endDate"],
    ] as const;
    fields.forEach(([key, field]) => {
      addEvidence(
        entry[key],
        field,
        entryIndex,
        null,
        (value) => value !== null,
      );
    });
    addEvidence(
      entry.current,
      "experience.current",
      entryIndex,
      null,
      (value) => value === true,
    );
    entry.achievements.forEach((achievement, itemIndex) => {
      addEvidence(
        achievement.text,
        "experience.achievements.text",
        entryIndex,
        itemIndex,
        (value) => value !== null,
      );
    });
  });

  provider.projects.forEach((project, entryIndex) => {
    const fields = [
      ["name", "projects.name"],
      ["description", "projects.description"],
      ["role", "projects.role"],
      ["startDate", "projects.startDate"],
      ["endDate", "projects.endDate"],
      ["repositoryUrl", "projects.repositoryUrl"],
      ["liveUrl", "projects.liveUrl"],
    ] as const;
    fields.forEach(([key, field]) => {
      addEvidence(
        project[key],
        field,
        entryIndex,
        null,
        (value) => value !== null,
      );
    });
    project.technologies.forEach((technology, itemIndex) => {
      addEvidence(
        technology.name,
        "projects.technologies.name",
        entryIndex,
        itemIndex,
        (value) => value !== null,
      );
    });
  });

  provider.skills.forEach((skill, entryIndex) => {
    addEvidence(
      skill.name,
      "skills.name",
      entryIndex,
      null,
      (value) => value !== null,
    );
    addEvidence(
      skill.group,
      "skills.group",
      entryIndex,
      null,
      (value) => value !== null,
    );
  });

  provider.education.forEach((entry, entryIndex) => {
    const fields = [
      ["institution", "education.institution"],
      ["degree", "education.degree"],
      ["field", "education.field"],
      ["location", "education.location"],
      ["startDate", "education.startDate"],
      ["endDate", "education.endDate"],
      ["gpa", "education.gpa"],
    ] as const;
    fields.forEach(([key, field]) => {
      addEvidence(
        entry[key],
        field,
        entryIndex,
        null,
        (value) => value !== null,
      );
    });
    addEvidence(
      entry.expected,
      "education.expected",
      entryIndex,
      null,
      (value) => value === true,
    );
    entry.honors.forEach((honor, itemIndex) => {
      addEvidence(
        honor.text,
        "education.honors.text",
        entryIndex,
        itemIndex,
        (value) => value !== null,
      );
    });
  });

  provider.warnings.forEach((warning) => {
    const target =
      warning.field === null
        ? null
        : resolveReference(
            warning.field,
            maps,
            warning.entryIndex,
            warning.itemIndex,
          );
    warnings.push({
      id: id("warning"),
      section: warning.section,
      target,
      severity: warning.severity,
      category: warning.category,
      message: warning.message,
    });
  });

  if (profile.name === null) {
    addWarning(
      "profile",
      {
        section: "profile",
        field: "profile.name",
        entryId: null,
        itemId: null,
      },
      "blocking",
      "missing_required_value",
      "Add the name you want displayed before confirming this draft.",
    );
  }
  if (profile.email !== null) {
    addWarning(
      "profile",
      {
        section: "profile",
        field: "profile.email",
        entryId: null,
        itemId: null,
      },
      "info",
      "contact_hidden_by_default",
      "Email is private by default and will not be published without a later explicit choice.",
    );
  }
  if (profile.phone !== null) {
    addWarning(
      "profile",
      {
        section: "profile",
        field: "profile.phone",
        entryId: null,
        itemId: null,
      },
      "info",
      "contact_hidden_by_default",
      "Phone is private by default and will not be published without a later explicit choice.",
    );
  }
  if (streetAddressOmitted) {
    addWarning(
      "profile",
      {
        section: "profile",
        field: "profile.location",
        entryId: null,
        itemId: null,
      },
      "info",
      "street_address_omitted",
      "A street address was omitted for privacy. Add only a broad location if you want one in the draft.",
    );
  }

  experience.forEach((entry) => {
    if (entry.company === null || entry.role === null) {
      const field =
        entry.company === null ? "experience.company" : "experience.role";
      addWarning(
        "experience",
        {
          section: "experience",
          field,
          entryId: entry.id,
          itemId: null,
        },
        "blocking",
        "missing_required_value",
        `Add the missing ${fieldLabel(field)} before confirming this draft.`,
      );
    }
    if (entry.current && entry.endDate !== null) {
      addWarning(
        "experience",
        {
          section: "experience",
          field: "experience.endDate",
          entryId: entry.id,
          itemId: null,
        },
        "review",
        "conflicting_dates",
        "This role is marked current but also has an end date. Confirm which is correct.",
      );
    }
    if (
      entry.startDate !== null &&
      entry.endDate !== null &&
      (comparePartialDates(entry.startDate, entry.endDate) ?? 0) > 0
    ) {
      addWarning(
        "experience",
        {
          section: "experience",
          field: "experience.endDate",
          entryId: entry.id,
          itemId: null,
        },
        "blocking",
        "invalid_date_order",
        "The experience end date is before its start date.",
      );
    }
  });

  projects.forEach((project) => {
    if (project.name === null) {
      addWarning(
        "projects",
        {
          section: "projects",
          field: "projects.name",
          entryId: project.id,
          itemId: null,
        },
        "blocking",
        "missing_required_value",
        "Add a project name before confirming this draft.",
      );
    }
    if (
      project.startDate !== null &&
      project.endDate !== null &&
      (comparePartialDates(project.startDate, project.endDate) ?? 0) > 0
    ) {
      addWarning(
        "projects",
        {
          section: "projects",
          field: "projects.endDate",
          entryId: project.id,
          itemId: null,
        },
        "blocking",
        "invalid_date_order",
        "The project end date is before its start date.",
      );
    }
  });

  education.forEach((entry) => {
    if (entry.institution === null) {
      addWarning(
        "education",
        {
          section: "education",
          field: "education.institution",
          entryId: entry.id,
          itemId: null,
        },
        "blocking",
        "missing_required_value",
        "Add an institution before confirming this draft.",
      );
    }
    if (
      entry.startDate !== null &&
      entry.endDate !== null &&
      (comparePartialDates(entry.startDate, entry.endDate) ?? 0) > 0
    ) {
      addWarning(
        "education",
        {
          section: "education",
          field: "education.endDate",
          entryId: entry.id,
          itemId: null,
        },
        "blocking",
        "invalid_date_order",
        "The education end date is before its start date.",
      );
    }
  });

  const draft: ResumeDraftV1 = {
    schemaVersion: 1,
    operation: RESUME_DRAFT_OPERATION,
    promptVersion: RESUME_EXTRACTION_PROMPT_VERSION,
    draftId: id("draft"),
    source: {
      filename: source.filename.trim(),
      pageCount: source.pageCount,
      characterCount: sourceText.length,
      wordCount: wordCount(sourceText),
    },
    draft: {
      profile,
      experience,
      projects,
      skills,
      education,
    },
    evidence,
    warnings,
    generatedAt: now().toISOString(),
  };

  return ResumeDraftV1Schema.parse(draft);
}

export function isKnownDraftField(value: string): value is DraftFieldKey {
  return DRAFT_FIELD_KEYS.some((field) => field === value);
}

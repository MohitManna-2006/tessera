import { z } from "zod";

export const RESUME_DRAFT_SCHEMA_VERSION = 1 as const;
export const RESUME_DRAFT_OPERATION = "extract_resume" as const;
export const RESUME_EXTRACTION_PROMPT_VERSION = "resume-extract-v1" as const;

export const RESUME_DRAFT_LIMITS = Object.freeze({
  minInputCharacters: 80,
  maxInputCharacters: 60_000,
  maxFilenameCharacters: 255,
  maxNameCharacters: 160,
  maxTitleCharacters: 200,
  maxLocationCharacters: 200,
  maxPhoneCharacters: 40,
  maxLabelCharacters: 100,
  maxUrlCharacters: 2_048,
  maxCompanyCharacters: 200,
  maxRoleCharacters: 200,
  maxEmploymentTypeCharacters: 80,
  maxAchievementCharacters: 1_000,
  maxProjectNameCharacters: 200,
  maxProjectDescriptionCharacters: 2_000,
  maxTechnologyCharacters: 100,
  maxSkillCharacters: 100,
  maxSkillGroupCharacters: 100,
  maxInstitutionCharacters: 240,
  maxDegreeCharacters: 200,
  maxFieldCharacters: 200,
  maxGpaCharacters: 40,
  maxHonorCharacters: 300,
  maxDateSourceCharacters: 80,
  maxEvidenceExcerptCharacters: 500,
  maxWarningMessageCharacters: 500,
  maxLinks: 12,
  maxExperiences: 20,
  maxAchievementsPerExperience: 24,
  maxProjects: 20,
  maxTechnologiesPerProject: 32,
  maxSkills: 120,
  maxEducationEntries: 12,
  maxHonorsPerEducation: 24,
  maxEvidenceRecords: 1_000,
  maxWarnings: 240,
});

const NullableTrimmedTextSchema = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable();

export const OpaqueResumeIdSchema = z
  .string()
  .min(10)
  .max(100)
  .regex(/^[a-z]+_[A-Za-z0-9_-]+$/u);

export const SafeHttpUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(RESUME_DRAFT_LIMITS.maxUrlCharacters)
  .superRefine((value, context) => {
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        context.addIssue({
          code: "custom",
          message: "Enter a full URL beginning with http:// or https://.",
        });
      }
    } catch {
      context.addIssue({
        code: "custom",
        message: "Enter a full URL beginning with http:// or https://.",
      });
    }
  });

export const PartialDatePrecisionSchema = z.enum(["year", "month"]);

export const PartialDateV1Schema = z
  .strictObject({
    precision: PartialDatePrecisionSchema,
    year: z.number().int().min(1900).max(2100),
    month: z.number().int().min(1).max(12).nullable(),
    sourceText: z
      .string()
      .trim()
      .min(1)
      .max(RESUME_DRAFT_LIMITS.maxDateSourceCharacters),
  })
  .superRefine((date, context) => {
    if (date.precision === "year" && date.month !== null) {
      context.addIssue({
        code: "custom",
        path: ["month"],
        message: "A year-only date cannot include a month.",
      });
    }
    if (date.precision === "month" && date.month === null) {
      context.addIssue({
        code: "custom",
        path: ["month"],
        message: "A month-precision date must include a month.",
      });
    }
  });

export const ResumeLinkKindSchema = z.enum([
  "github",
  "linkedin",
  "personal",
  "other",
]);

export const ResumeLinkV1Schema = z.strictObject({
  id: OpaqueResumeIdSchema,
  label: z.string().trim().min(1).max(RESUME_DRAFT_LIMITS.maxLabelCharacters),
  url: SafeHttpUrlSchema,
  kind: ResumeLinkKindSchema,
  public: z.literal(false),
});

export const ResumeProfileV1Schema = z.strictObject({
  name: NullableTrimmedTextSchema(RESUME_DRAFT_LIMITS.maxNameCharacters),
  sourceTitle: NullableTrimmedTextSchema(
    RESUME_DRAFT_LIMITS.maxTitleCharacters,
  ),
  location: NullableTrimmedTextSchema(
    RESUME_DRAFT_LIMITS.maxLocationCharacters,
  ),
  email: z.string().trim().max(254).email().nullable(),
  emailPublic: z.literal(false),
  phone: NullableTrimmedTextSchema(RESUME_DRAFT_LIMITS.maxPhoneCharacters),
  phonePublic: z.literal(false),
  links: z.array(ResumeLinkV1Schema).max(RESUME_DRAFT_LIMITS.maxLinks),
});

export const ResumeAchievementV1Schema = z.strictObject({
  id: OpaqueResumeIdSchema,
  text: z
    .string()
    .trim()
    .min(1)
    .max(RESUME_DRAFT_LIMITS.maxAchievementCharacters),
});

export const ResumeExperienceV1Schema = z.strictObject({
  id: OpaqueResumeIdSchema,
  company: NullableTrimmedTextSchema(RESUME_DRAFT_LIMITS.maxCompanyCharacters),
  role: NullableTrimmedTextSchema(RESUME_DRAFT_LIMITS.maxRoleCharacters),
  location: NullableTrimmedTextSchema(
    RESUME_DRAFT_LIMITS.maxLocationCharacters,
  ),
  employmentType: NullableTrimmedTextSchema(
    RESUME_DRAFT_LIMITS.maxEmploymentTypeCharacters,
  ),
  startDate: PartialDateV1Schema.nullable(),
  endDate: PartialDateV1Schema.nullable(),
  current: z.boolean(),
  achievements: z
    .array(ResumeAchievementV1Schema)
    .max(RESUME_DRAFT_LIMITS.maxAchievementsPerExperience),
});

export const ResumeTechnologyV1Schema = z.strictObject({
  id: OpaqueResumeIdSchema,
  name: z
    .string()
    .trim()
    .min(1)
    .max(RESUME_DRAFT_LIMITS.maxTechnologyCharacters),
});

export const ResumeProjectV1Schema = z.strictObject({
  id: OpaqueResumeIdSchema,
  name: NullableTrimmedTextSchema(RESUME_DRAFT_LIMITS.maxProjectNameCharacters),
  description: NullableTrimmedTextSchema(
    RESUME_DRAFT_LIMITS.maxProjectDescriptionCharacters,
  ),
  role: NullableTrimmedTextSchema(RESUME_DRAFT_LIMITS.maxRoleCharacters),
  technologies: z
    .array(ResumeTechnologyV1Schema)
    .max(RESUME_DRAFT_LIMITS.maxTechnologiesPerProject),
  startDate: PartialDateV1Schema.nullable(),
  endDate: PartialDateV1Schema.nullable(),
  repositoryUrl: SafeHttpUrlSchema.nullable(),
  liveUrl: SafeHttpUrlSchema.nullable(),
});

export const ResumeSkillV1Schema = z.strictObject({
  id: OpaqueResumeIdSchema,
  name: z.string().trim().min(1).max(RESUME_DRAFT_LIMITS.maxSkillCharacters),
  group: z
    .string()
    .trim()
    .min(1)
    .max(RESUME_DRAFT_LIMITS.maxSkillGroupCharacters),
});

export const ResumeHonorV1Schema = z.strictObject({
  id: OpaqueResumeIdSchema,
  text: z.string().trim().min(1).max(RESUME_DRAFT_LIMITS.maxHonorCharacters),
});

export const ResumeEducationV1Schema = z.strictObject({
  id: OpaqueResumeIdSchema,
  institution: NullableTrimmedTextSchema(
    RESUME_DRAFT_LIMITS.maxInstitutionCharacters,
  ),
  degree: NullableTrimmedTextSchema(RESUME_DRAFT_LIMITS.maxDegreeCharacters),
  field: NullableTrimmedTextSchema(RESUME_DRAFT_LIMITS.maxFieldCharacters),
  location: NullableTrimmedTextSchema(
    RESUME_DRAFT_LIMITS.maxLocationCharacters,
  ),
  startDate: PartialDateV1Schema.nullable(),
  endDate: PartialDateV1Schema.nullable(),
  expected: z.boolean(),
  gpa: NullableTrimmedTextSchema(RESUME_DRAFT_LIMITS.maxGpaCharacters),
  gpaPublic: z.literal(false),
  honors: z
    .array(ResumeHonorV1Schema)
    .max(RESUME_DRAFT_LIMITS.maxHonorsPerEducation),
});

export const ResumePortfolioDraftDataV1Schema = z.strictObject({
  profile: ResumeProfileV1Schema,
  experience: z
    .array(ResumeExperienceV1Schema)
    .max(RESUME_DRAFT_LIMITS.maxExperiences),
  projects: z.array(ResumeProjectV1Schema).max(RESUME_DRAFT_LIMITS.maxProjects),
  skills: z.array(ResumeSkillV1Schema).max(RESUME_DRAFT_LIMITS.maxSkills),
  education: z
    .array(ResumeEducationV1Schema)
    .max(RESUME_DRAFT_LIMITS.maxEducationEntries),
});

export const RESUME_REVIEW_SECTIONS = [
  "profile",
  "experience",
  "projects",
  "skills",
  "education",
] as const;

export const ResumeReviewSectionSchema = z.enum(RESUME_REVIEW_SECTIONS);

export const DRAFT_FIELD_KEYS = [
  "profile.name",
  "profile.sourceTitle",
  "profile.location",
  "profile.email",
  "profile.phone",
  "profile.links.label",
  "profile.links.url",
  "profile.links.kind",
  "experience.company",
  "experience.role",
  "experience.location",
  "experience.employmentType",
  "experience.startDate",
  "experience.endDate",
  "experience.current",
  "experience.achievements.text",
  "projects.name",
  "projects.description",
  "projects.role",
  "projects.technologies.name",
  "projects.startDate",
  "projects.endDate",
  "projects.repositoryUrl",
  "projects.liveUrl",
  "skills.name",
  "skills.group",
  "education.institution",
  "education.degree",
  "education.field",
  "education.location",
  "education.startDate",
  "education.endDate",
  "education.expected",
  "education.gpa",
  "education.honors.text",
] as const;

export const DraftFieldKeySchema = z.enum(DRAFT_FIELD_KEYS);

export const DraftFieldReferenceV1Schema = z.strictObject({
  section: ResumeReviewSectionSchema,
  field: DraftFieldKeySchema,
  entryId: OpaqueResumeIdSchema.nullable(),
  itemId: OpaqueResumeIdSchema.nullable(),
});

export const ResumeEvidenceSupportSchema = z.enum([
  "direct",
  "reformatted",
  "ambiguous",
  "unsupported",
  "user_entered",
  "user_edited",
]);

export const ResumeEvidenceTransformationSchema = z.enum([
  "none",
  "whitespace",
  "date_normalization",
  "list_split",
  "safe_reformat",
  "user_change",
]);

export const ResumeEvidenceV1Schema = z.strictObject({
  id: OpaqueResumeIdSchema,
  target: DraftFieldReferenceV1Schema,
  sourceExcerpt: z
    .string()
    .min(1)
    .max(RESUME_DRAFT_LIMITS.maxEvidenceExcerptCharacters)
    .nullable(),
  support: ResumeEvidenceSupportSchema,
  transformation: ResumeEvidenceTransformationSchema,
  matched: z.boolean(),
});

export const ResumeWarningSeveritySchema = z.enum([
  "blocking",
  "review",
  "info",
]);

export const ResumeWarningCategorySchema = z.enum([
  "unsupported_claim",
  "ambiguous_source",
  "conflicting_dates",
  "invalid_date_order",
  "missing_required_value",
  "duplicate_entry",
  "unverified_url",
  "contact_hidden_by_default",
  "street_address_omitted",
  "truncated_source",
  "provider_omission",
  "evidence_mismatch",
]);

export const ResumeWarningV1Schema = z.strictObject({
  id: OpaqueResumeIdSchema,
  section: ResumeReviewSectionSchema,
  target: DraftFieldReferenceV1Schema.nullable(),
  severity: ResumeWarningSeveritySchema,
  category: ResumeWarningCategorySchema,
  message: z
    .string()
    .trim()
    .min(1)
    .max(RESUME_DRAFT_LIMITS.maxWarningMessageCharacters),
});

export const ResumeSourceMetadataV1Schema = z.strictObject({
  filename: z
    .string()
    .trim()
    .min(1)
    .max(RESUME_DRAFT_LIMITS.maxFilenameCharacters),
  pageCount: z.number().int().min(1).max(100),
  characterCount: z
    .number()
    .int()
    .min(1)
    .max(RESUME_DRAFT_LIMITS.maxInputCharacters),
  wordCount: z.number().int().min(1).max(50_000),
});

export const ResumeDraftV1Schema = z.strictObject({
  schemaVersion: z.literal(RESUME_DRAFT_SCHEMA_VERSION),
  operation: z.literal(RESUME_DRAFT_OPERATION),
  promptVersion: z.literal(RESUME_EXTRACTION_PROMPT_VERSION),
  draftId: OpaqueResumeIdSchema,
  source: ResumeSourceMetadataV1Schema,
  draft: ResumePortfolioDraftDataV1Schema,
  evidence: z
    .array(ResumeEvidenceV1Schema)
    .max(RESUME_DRAFT_LIMITS.maxEvidenceRecords),
  warnings: z.array(ResumeWarningV1Schema).max(RESUME_DRAFT_LIMITS.maxWarnings),
  generatedAt: z.iso.datetime(),
});

export const ResumeExtractionRequestV1Schema = z.strictObject({
  operation: z.literal(RESUME_DRAFT_OPERATION),
  text: z
    .string()
    .trim()
    .min(RESUME_DRAFT_LIMITS.minInputCharacters)
    .max(RESUME_DRAFT_LIMITS.maxInputCharacters),
  source: z.strictObject({
    filename: z
      .string()
      .trim()
      .min(1)
      .max(RESUME_DRAFT_LIMITS.maxFilenameCharacters),
    pageCount: z.number().int().min(1).max(100),
    characterCount: z
      .number()
      .int()
      .min(1)
      .max(RESUME_DRAFT_LIMITS.maxInputCharacters),
  }),
});

export const ResumeAiErrorCodeSchema = z.enum([
  "FEATURE_DISABLED",
  "INVALID_INPUT",
  "INPUT_TOO_SHORT",
  "INPUT_TOO_LARGE",
  "PROVIDER_TIMEOUT",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_RATE_LIMITED",
  "INVALID_PROVIDER_OUTPUT",
  "EVIDENCE_VALIDATION_FAILED",
  "CLIENT_ABORTED",
  "UNKNOWN_ERROR",
]);

export const ResumeExtractionSuccessV1Schema = z.strictObject({
  ok: z.literal(true),
  data: ResumeDraftV1Schema,
});

export const ResumeExtractionFailureV1Schema = z.strictObject({
  ok: z.literal(false),
  error: z.strictObject({
    code: ResumeAiErrorCodeSchema,
    message: z.string().trim().min(1).max(300),
    retryable: z.boolean(),
  }),
});

export const ResumeExtractionResponseV1Schema = z.discriminatedUnion("ok", [
  ResumeExtractionSuccessV1Schema,
  ResumeExtractionFailureV1Schema,
]);

export const ResumeReviewStateV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  sections: z.strictObject({
    profile: z.boolean(),
    experience: z.boolean(),
    projects: z.boolean(),
    skills: z.boolean(),
    education: z.boolean(),
  }),
  resolvedWarningIds: z
    .array(OpaqueResumeIdSchema)
    .max(RESUME_DRAFT_LIMITS.maxWarnings),
  acknowledgedWarningIds: z
    .array(OpaqueResumeIdSchema)
    .max(RESUME_DRAFT_LIMITS.maxWarnings),
  confirmedAt: z.iso.datetime().nullable(),
});

export type PartialDateV1 = z.infer<typeof PartialDateV1Schema>;
export type ResumeLinkV1 = z.infer<typeof ResumeLinkV1Schema>;
export type ResumeProfileV1 = z.infer<typeof ResumeProfileV1Schema>;
export type ResumeExperienceV1 = z.infer<typeof ResumeExperienceV1Schema>;
export type ResumeProjectV1 = z.infer<typeof ResumeProjectV1Schema>;
export type ResumeSkillV1 = z.infer<typeof ResumeSkillV1Schema>;
export type ResumeEducationV1 = z.infer<typeof ResumeEducationV1Schema>;
export type ResumePortfolioDraftDataV1 = z.infer<
  typeof ResumePortfolioDraftDataV1Schema
>;
export type ResumeReviewSection = z.infer<typeof ResumeReviewSectionSchema>;
export type DraftFieldKey = z.infer<typeof DraftFieldKeySchema>;
export type DraftFieldReferenceV1 = z.infer<typeof DraftFieldReferenceV1Schema>;
export type ResumeEvidenceV1 = z.infer<typeof ResumeEvidenceV1Schema>;
export type ResumeWarningV1 = z.infer<typeof ResumeWarningV1Schema>;
export type ResumeDraftV1 = z.infer<typeof ResumeDraftV1Schema>;
export type ResumeExtractionRequestV1 = z.infer<
  typeof ResumeExtractionRequestV1Schema
>;
export type ResumeAiErrorCode = z.infer<typeof ResumeAiErrorCodeSchema>;
export type ResumeExtractionResponseV1 = z.infer<
  typeof ResumeExtractionResponseV1Schema
>;
export type ResumeReviewStateV1 = z.infer<typeof ResumeReviewStateV1Schema>;

export function createInitialResumeReviewState(): ResumeReviewStateV1 {
  return {
    schemaVersion: 1,
    sections: {
      profile: false,
      experience: false,
      projects: false,
      skills: false,
      education: false,
    },
    resolvedWarningIds: [],
    acknowledgedWarningIds: [],
    confirmedAt: null,
  };
}

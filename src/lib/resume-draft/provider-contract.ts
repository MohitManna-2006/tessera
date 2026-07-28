import { z } from "zod";

import {
  DraftFieldKeySchema,
  PartialDateV1Schema,
  RESUME_DRAFT_LIMITS,
  ResumeEvidenceSupportSchema,
  ResumeEvidenceTransformationSchema,
  ResumeLinkKindSchema,
  ResumeReviewSectionSchema,
  ResumeWarningCategorySchema,
  ResumeWarningSeveritySchema,
} from "./contracts";

const ProviderEvidenceClaimV1Schema = z.strictObject({
  sourceExcerpt: z
    .string()
    .min(1)
    .max(RESUME_DRAFT_LIMITS.maxEvidenceExcerptCharacters)
    .nullable(),
  support: ResumeEvidenceSupportSchema.exclude(["user_entered", "user_edited"]),
  transformation: ResumeEvidenceTransformationSchema.exclude(["user_change"]),
});

const providerFact = <Schema extends z.ZodType>(value: Schema) =>
  z.strictObject({
    value,
    evidence: ProviderEvidenceClaimV1Schema.nullable(),
  });

const ProviderTextFactSchema = providerFact(
  z.string().trim().min(1).max(2_048).nullable(),
);
const ProviderBooleanFactSchema = providerFact(z.boolean());
const ProviderDateFactSchema = providerFact(PartialDateV1Schema.nullable());

export const ProviderResumeDraftV1Schema = z.strictObject({
  profile: z.strictObject({
    name: ProviderTextFactSchema,
    sourceTitle: ProviderTextFactSchema,
    location: ProviderTextFactSchema,
    email: ProviderTextFactSchema,
    phone: ProviderTextFactSchema,
    links: z
      .array(
        z.strictObject({
          label: ProviderTextFactSchema,
          url: ProviderTextFactSchema,
          kind: providerFact(ResumeLinkKindSchema),
        }),
      )
      .max(RESUME_DRAFT_LIMITS.maxLinks),
  }),
  experience: z
    .array(
      z.strictObject({
        company: ProviderTextFactSchema,
        role: ProviderTextFactSchema,
        location: ProviderTextFactSchema,
        employmentType: ProviderTextFactSchema,
        startDate: ProviderDateFactSchema,
        endDate: ProviderDateFactSchema,
        current: ProviderBooleanFactSchema,
        achievements: z
          .array(
            z.strictObject({
              text: ProviderTextFactSchema,
            }),
          )
          .max(RESUME_DRAFT_LIMITS.maxAchievementsPerExperience),
      }),
    )
    .max(RESUME_DRAFT_LIMITS.maxExperiences),
  projects: z
    .array(
      z.strictObject({
        name: ProviderTextFactSchema,
        description: ProviderTextFactSchema,
        role: ProviderTextFactSchema,
        technologies: z
          .array(
            z.strictObject({
              name: ProviderTextFactSchema,
            }),
          )
          .max(RESUME_DRAFT_LIMITS.maxTechnologiesPerProject),
        startDate: ProviderDateFactSchema,
        endDate: ProviderDateFactSchema,
        repositoryUrl: ProviderTextFactSchema,
        liveUrl: ProviderTextFactSchema,
      }),
    )
    .max(RESUME_DRAFT_LIMITS.maxProjects),
  skills: z
    .array(
      z.strictObject({
        name: ProviderTextFactSchema,
        group: ProviderTextFactSchema,
      }),
    )
    .max(RESUME_DRAFT_LIMITS.maxSkills),
  education: z
    .array(
      z.strictObject({
        institution: ProviderTextFactSchema,
        degree: ProviderTextFactSchema,
        field: ProviderTextFactSchema,
        location: ProviderTextFactSchema,
        startDate: ProviderDateFactSchema,
        endDate: ProviderDateFactSchema,
        expected: ProviderBooleanFactSchema,
        gpa: ProviderTextFactSchema,
        honors: z
          .array(
            z.strictObject({
              text: ProviderTextFactSchema,
            }),
          )
          .max(RESUME_DRAFT_LIMITS.maxHonorsPerEducation),
      }),
    )
    .max(RESUME_DRAFT_LIMITS.maxEducationEntries),
  warnings: z
    .array(
      z.strictObject({
        section: ResumeReviewSectionSchema,
        field: DraftFieldKeySchema.nullable(),
        entryIndex: z.number().int().min(0).max(119).nullable(),
        itemIndex: z.number().int().min(0).max(31).nullable(),
        severity: ResumeWarningSeveritySchema,
        category: ResumeWarningCategorySchema,
        message: z
          .string()
          .trim()
          .min(1)
          .max(RESUME_DRAFT_LIMITS.maxWarningMessageCharacters),
      }),
    )
    .max(RESUME_DRAFT_LIMITS.maxWarnings),
});

export type ProviderEvidenceClaimV1 = z.infer<
  typeof ProviderEvidenceClaimV1Schema
>;
export type ProviderResumeDraftV1 = z.infer<typeof ProviderResumeDraftV1Schema>;

import { z } from "zod";

export const GITHUB_USERNAME_REGEX =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/u;

export const GitHubUsernameSchema = z
  .string()
  .trim()
  .min(1, "Enter a GitHub username.")
  .max(39, "Username must be 39 characters or fewer.")
  .regex(
    GITHUB_USERNAME_REGEX,
    "Enter a valid GitHub username (letters, numbers, hyphens, max 39).",
  );

export const GitHubProfileV1Schema = z.strictObject({
  login: GitHubUsernameSchema,
  name: z.string().trim().max(100).nullable(),
  avatarUrl: z.string().trim().url().nullable(),
  bio: z.string().trim().max(500).nullable(),
  htmlUrl: z.string().trim().url(),
  publicRepos: z.number().int().min(0).max(1_000_000),
  followers: z.number().int().min(0).max(10_000_000),
});

export type GitHubProfileV1 = z.infer<typeof GitHubProfileV1Schema>;

export const GitHubRepoV1Schema = z.strictObject({
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  fullName: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable(),
  htmlUrl: z.string().trim().url(),
  stargazersCount: z.number().int().min(0).max(10_000_000),
  forksCount: z.number().int().min(0).max(10_000_000),
  primaryLanguage: z.string().trim().max(50).nullable(),
  topics: z.array(z.string().trim().min(1).max(50)).max(32),
  updatedAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  isFork: z.boolean(),
  isArchived: z.boolean(),
});

export type GitHubRepoV1 = z.infer<typeof GitHubRepoV1Schema>;

export const GitHubReadmeV1Schema = z.strictObject({
  repo: z.string().trim().min(1).max(100),
  size: z.number().int().min(0).max(10_000_000),
  truncated: z.boolean(),
  content: z.string().max(1_000_000),
});

export type GitHubReadmeV1 = z.infer<typeof GitHubReadmeV1Schema>;

export const GitHubSelectionV1Schema = z.strictObject({
  username: GitHubUsernameSchema,
  selectedRepoIds: z.array(z.string().trim().min(1).max(100)).max(10),
});

export type GitHubSelectionV1 = z.infer<typeof GitHubSelectionV1Schema>;

// API request schemas
export const GitHubProfileRequestSchema = z.strictObject({
  username: GitHubUsernameSchema,
});

export const GitHubReposRequestSchema = z.strictObject({
  username: GitHubUsernameSchema,
  page: z.number().int().min(1).max(100).optional().default(1),
  perPage: z.number().int().min(1).max(1000).optional().default(30),
});

export const GitHubReadmeRequestSchema = z.strictObject({
  username: GitHubUsernameSchema,
  repo: z.string().trim().min(1).max(100),
});

export const GitHubUsernameValidation = {
  regex: GITHUB_USERNAME_REGEX,
  maxLength: 39,
} as const;

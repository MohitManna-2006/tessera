import { z } from "zod";

import {
  GitHubProfileV1Schema,
  GitHubRepoV1Schema,
  GitHubReadmeV1Schema,
} from "./contracts";

export const GITHUB_STORAGE_KEY = "tessera.github.v1";
export const GITHUB_TTL_MS = 30 * 60 * 1000;

export const GitHubEnvelopeV1Schema = z
  .strictObject({
    version: z.literal(1),
    createdAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
    username: z.string().trim().min(1).max(39),
    profile: GitHubProfileV1Schema.nullable(),
    repos: z.array(GitHubRepoV1Schema).max(100),
    selectedRepoIds: z.array(z.string().trim().min(1).max(100)).max(10),
    readmes: z.record(z.string(), GitHubReadmeV1Schema),
  })
  .superRefine((value, context) => {
    if (value.expiresAt <= value.createdAt) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Expiry must follow creation.",
      });
    }
    // Client-side: allow up to hard max 10 (server enforces actual limit via config)
    if (value.selectedRepoIds.length > 10) {
      context.addIssue({
        code: "custom",
        path: ["selectedRepoIds"],
        message: "Cannot select more than 10 repos.",
      });
    }
  });

export type GitHubEnvelopeV1 = z.infer<typeof GitHubEnvelopeV1Schema>;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createGitHubEnvelope(
  data: Omit<GitHubEnvelopeV1, "version" | "createdAt" | "expiresAt"> & {
    now?: number;
  },
): GitHubEnvelopeV1 {
  const now = data.now ?? Date.now();
  return GitHubEnvelopeV1Schema.parse({
    version: 1,
    createdAt: now,
    expiresAt: now + GITHUB_TTL_MS,
    username: data.username,
    profile: data.profile,
    repos: data.repos,
    selectedRepoIds: data.selectedRepoIds,
    readmes: data.readmes,
  });
}

export function writeGitHubEnvelope(
  storage: StorageLike,
  envelope: GitHubEnvelopeV1,
): boolean {
  const parsed = GitHubEnvelopeV1Schema.safeParse(envelope);
  if (!parsed.success) return false;
  try {
    storage.setItem(GITHUB_STORAGE_KEY, JSON.stringify(parsed.data));
    return true;
  } catch {
    return false;
  }
}

export function readGitHubEnvelope(
  storage: StorageLike,
  now = Date.now(),
): GitHubEnvelopeV1 | null {
  let serialized: string | null;
  try {
    serialized = storage.getItem(GITHUB_STORAGE_KEY);
  } catch {
    return null;
  }
  if (serialized === null) return null;
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(serialized);
  } catch {
    clearGitHubEnvelope(storage);
    return null;
  }
  const parsed = GitHubEnvelopeV1Schema.safeParse(parsedJson);
  if (!parsed.success || parsed.data.expiresAt <= now) {
    clearGitHubEnvelope(storage);
    return null;
  }
  return parsed.data;
}

export function clearGitHubEnvelope(storage: StorageLike): void {
  try {
    storage.removeItem(GITHUB_STORAGE_KEY);
  } catch {
    // best-effort
  }
}

export function toggleRepoSelection(
  envelope: GitHubEnvelopeV1,
  repoId: string,
  maxSelected: number,
): GitHubEnvelopeV1 | null {
  const isSelected = envelope.selectedRepoIds.includes(repoId);
  let nextSelected: string[];
  if (isSelected) {
    nextSelected = envelope.selectedRepoIds.filter((id) => id !== repoId);
  } else {
    if (envelope.selectedRepoIds.length >= maxSelected) return null;
    nextSelected = [...envelope.selectedRepoIds, repoId];
  }
  return GitHubEnvelopeV1Schema.parse({
    ...envelope,
    selectedRepoIds: nextSelected,
  });
}

import { z } from "zod";

import {
  createInitialResumeReviewState,
  RESUME_DRAFT_LIMITS,
  ResumeDraftV1Schema,
  ResumeReviewStateV1Schema,
  type ResumeDraftV1,
  type ResumeReviewStateV1,
} from "@/lib/resume-draft/contracts";

export const RESUME_TRANSFER_STORAGE_KEY = "tessera.resume-review.v1";
export const RESUME_TRANSFER_TTL_MS = 30 * 60 * 1_000;

export const ResumeTransferEnvelopeV1Schema = z
  .strictObject({
    storageVersion: z.literal(1),
    createdAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
    extractedText: z
      .string()
      .min(1)
      .max(RESUME_DRAFT_LIMITS.maxInputCharacters),
    draft: ResumeDraftV1Schema,
    review: ResumeReviewStateV1Schema,
  })
  .superRefine((value, context) => {
    if (value.expiresAt <= value.createdAt) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Expiry must follow creation.",
      });
    }
    if (value.extractedText.length !== value.draft.source.characterCount) {
      context.addIssue({
        code: "custom",
        path: ["extractedText"],
        message: "Stored text metadata does not match.",
      });
    }
  });

export type ResumeTransferEnvelopeV1 = z.infer<
  typeof ResumeTransferEnvelopeV1Schema
>;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createResumeTransferEnvelope({
  extractedText,
  draft,
  review = createInitialResumeReviewState(),
  now = Date.now(),
}: {
  extractedText: string;
  draft: ResumeDraftV1;
  review?: ResumeReviewStateV1;
  now?: number;
}): ResumeTransferEnvelopeV1 {
  return ResumeTransferEnvelopeV1Schema.parse({
    storageVersion: 1,
    createdAt: now,
    expiresAt: now + RESUME_TRANSFER_TTL_MS,
    extractedText,
    draft,
    review,
  });
}

export function writeResumeTransferState(
  storage: StorageLike,
  envelope: ResumeTransferEnvelopeV1,
): boolean {
  const parsed = ResumeTransferEnvelopeV1Schema.safeParse(envelope);
  if (!parsed.success) {
    return false;
  }
  try {
    storage.setItem(RESUME_TRANSFER_STORAGE_KEY, JSON.stringify(parsed.data));
    return true;
  } catch {
    return false;
  }
}

export function readResumeTransferState(
  storage: StorageLike,
  now = Date.now(),
): ResumeTransferEnvelopeV1 | null {
  let serialized: string | null;
  try {
    serialized = storage.getItem(RESUME_TRANSFER_STORAGE_KEY);
  } catch {
    return null;
  }
  if (serialized === null) {
    return null;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(serialized);
  } catch {
    clearResumeTransferState(storage);
    return null;
  }
  const parsed = ResumeTransferEnvelopeV1Schema.safeParse(parsedJson);
  if (!parsed.success || parsed.data.expiresAt <= now) {
    clearResumeTransferState(storage);
    return null;
  }
  return parsed.data;
}

export function clearResumeTransferState(storage: StorageLike): void {
  try {
    storage.removeItem(RESUME_TRANSFER_STORAGE_KEY);
  } catch {
    // Storage cleanup is best-effort when the browser blocks session storage.
  }
}

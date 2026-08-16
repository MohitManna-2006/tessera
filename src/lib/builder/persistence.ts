import { z } from "zod";

import { validatePortfolioExportRequest } from "@/lib/portfolio-validation";
import { PORTFOLIO_SCHEMA_VERSION } from "@/lib/portfolio";
import type { Portfolio } from "@/lib/portfolio";

export const BUILDER_DRAFT_STORAGE_KEY = "tessera.builder-draft.v1";
export const BUILDER_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

const BuilderDraftEnvelopeV1Schema = z.strictObject({
  version: z.literal(1),
  schemaVersion: z.literal(PORTFOLIO_SCHEMA_VERSION),
  updatedAt: z.number().int().nonnegative(),
  portfolio: z.unknown(),
});

export type BuilderDraftEnvelopeV1 = z.infer<
  typeof BuilderDraftEnvelopeV1Schema
>;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isPortfolioValid(portfolio: unknown): portfolio is Portfolio {
  // Reuse export validation which enforces exact shape, lengths, urls, etc.
  // We construct a minimal export request wrapper.
  const candidate = {
    schemaVersion: PORTFOLIO_SCHEMA_VERSION,
    sectionOrder: [
      "profile",
      "links",
      "experience",
      "projects",
      "skills",
      "education",
    ] as const,
    portfolio,
  };
  const result = validatePortfolioExportRequest(candidate);
  return result.success;
}

export function readBuilderDraft(
  storage: StorageLike,
  now = Date.now(),
): Portfolio | null {
  let serialized: string | null;
  try {
    serialized = storage.getItem(BUILDER_DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (serialized === null) return null;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(serialized);
  } catch {
    clearBuilderDraft(storage);
    return null;
  }

  const envelope = BuilderDraftEnvelopeV1Schema.safeParse(parsedJson);
  if (!envelope.success) {
    clearBuilderDraft(storage);
    return null;
  }

  if (envelope.data.updatedAt + BUILDER_DRAFT_TTL_MS <= now) {
    clearBuilderDraft(storage);
    return null;
  }

  if (!isPortfolioValid(envelope.data.portfolio)) {
    clearBuilderDraft(storage);
    return null;
  }

  return envelope.data.portfolio as Portfolio;
}

export function writeBuilderDraft(
  storage: StorageLike,
  portfolio: Portfolio,
  now = Date.now(),
): boolean {
  if (!isPortfolioValid(portfolio)) {
    return false;
  }
  const envelope: BuilderDraftEnvelopeV1 = {
    version: 1,
    schemaVersion: PORTFOLIO_SCHEMA_VERSION,
    updatedAt: now,
    portfolio,
  };
  const parsed = BuilderDraftEnvelopeV1Schema.safeParse(envelope);
  if (!parsed.success) return false;
  try {
    storage.setItem(BUILDER_DRAFT_STORAGE_KEY, JSON.stringify(parsed.data));
    return true;
  } catch {
    return false;
  }
}

export function clearBuilderDraft(storage: StorageLike): void {
  try {
    storage.removeItem(BUILDER_DRAFT_STORAGE_KEY);
  } catch {
    // best-effort
  }
}

export function isDirty(current: Portfolio, fixture: Portfolio): boolean {
  return JSON.stringify(current) !== JSON.stringify(fixture);
}

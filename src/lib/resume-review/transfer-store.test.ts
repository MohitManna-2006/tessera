import { beforeEach, describe, expect, it } from "vitest";

import { normalizeProviderResumeDraft } from "@/lib/resume-draft/normalization";
import {
  experiencedEngineerResumeText,
  validProviderResumeDraft,
} from "../../../tests/fixtures/resume-ai/fixtures";
import {
  clearResumeTransferState,
  createResumeTransferEnvelope,
  readResumeTransferState,
  RESUME_TRANSFER_STORAGE_KEY,
  RESUME_TRANSFER_TTL_MS,
  writeResumeTransferState,
} from "./transfer-store";

function draft() {
  return normalizeProviderResumeDraft({
    providerOutput: structuredClone(validProviderResumeDraft),
    sourceText: experiencedEngineerResumeText,
    source: { filename: "synthetic.pdf", pageCount: 1 },
    now: () => new Date("2026-07-27T12:00:00.000Z"),
  });
}

beforeEach(() => {
  sessionStorage.clear();
});

describe("temporary resume transfer store", () => {
  it("round-trips a validated tab-scoped envelope", () => {
    const envelope = createResumeTransferEnvelope({
      extractedText: experiencedEngineerResumeText,
      draft: draft(),
      now: 1_000,
    });

    expect(writeResumeTransferState(sessionStorage, envelope)).toBe(true);
    expect(readResumeTransferState(sessionStorage, 2_000)).toEqual(envelope);
  });

  it("clears expired, malformed, and future-version data", () => {
    const envelope = createResumeTransferEnvelope({
      extractedText: experiencedEngineerResumeText,
      draft: draft(),
      now: 1_000,
    });
    writeResumeTransferState(sessionStorage, envelope);
    expect(
      readResumeTransferState(sessionStorage, 1_000 + RESUME_TRANSFER_TTL_MS),
    ).toBeNull();
    expect(sessionStorage.getItem(RESUME_TRANSFER_STORAGE_KEY)).toBeNull();

    sessionStorage.setItem(RESUME_TRANSFER_STORAGE_KEY, "{broken");
    expect(readResumeTransferState(sessionStorage)).toBeNull();
    expect(sessionStorage.getItem(RESUME_TRANSFER_STORAGE_KEY)).toBeNull();

    sessionStorage.setItem(
      RESUME_TRANSFER_STORAGE_KEY,
      JSON.stringify({ ...envelope, storageVersion: 2 }),
    );
    expect(readResumeTransferState(sessionStorage)).toBeNull();
    expect(sessionStorage.getItem(RESUME_TRANSFER_STORAGE_KEY)).toBeNull();
  });

  it("rejects mismatched text metadata and supports deliberate cleanup", () => {
    const envelope = createResumeTransferEnvelope({
      extractedText: experiencedEngineerResumeText,
      draft: draft(),
    });

    expect(
      writeResumeTransferState(sessionStorage, {
        ...envelope,
        extractedText: `${envelope.extractedText} changed`,
      }),
    ).toBe(false);
    expect(sessionStorage.getItem(RESUME_TRANSFER_STORAGE_KEY)).toBeNull();

    writeResumeTransferState(sessionStorage, envelope);
    clearResumeTransferState(sessionStorage);
    expect(sessionStorage.getItem(RESUME_TRANSFER_STORAGE_KEY)).toBeNull();
  });
});

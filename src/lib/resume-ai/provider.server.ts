import "server-only";

import type { ProviderResumeDraftV1 } from "@/lib/resume-draft/provider-contract";

export type ResumeAiProviderFailureKind =
  "rate_limit" | "transient" | "unavailable" | "invalid_output";

export class ResumeAiProviderError extends Error {
  readonly kind: ResumeAiProviderFailureKind;

  constructor(kind: ResumeAiProviderFailureKind) {
    super(kind);
    this.name = "ResumeAiProviderError";
    this.kind = kind;
  }
}

export type ResumeAiProviderRequest = Readonly<{
  text: string;
  signal: AbortSignal;
}>;

export interface ResumeAiProvider {
  extractResume(
    request: ResumeAiProviderRequest,
  ): Promise<ProviderResumeDraftV1>;
}

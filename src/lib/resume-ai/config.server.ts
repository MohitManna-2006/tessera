import "server-only";

export const DEFAULT_RESUME_AI_TIMEOUT_MS = 30_000;

export type ResumeAiConfig = Readonly<{
  enabled: boolean;
  apiKey: string | null;
  model: string | null;
  timeoutMs: number;
}>;

function readSecret(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function parseResumeAiConfig(
  environment: Readonly<Record<string, string | undefined>>,
): ResumeAiConfig {
  return Object.freeze({
    enabled: environment.AI_RESUME_EXTRACTION_ENABLED === "true",
    apiKey: readSecret(environment.OPENAI_API_KEY),
    model: readSecret(environment.OPENAI_RESUME_MODEL),
    timeoutMs: DEFAULT_RESUME_AI_TIMEOUT_MS,
  });
}

export function getResumeAiConfig(): ResumeAiConfig {
  return parseResumeAiConfig(process.env);
}

export function isResumeAiAvailable(config = getResumeAiConfig()): boolean {
  return config.enabled && config.apiKey !== null && config.model !== null;
}

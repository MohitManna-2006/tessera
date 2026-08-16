import { GitHubReposRequestSchema } from "@/lib/github/contracts";
import {
  fetchGitHubRepos,
  GitHubClientError,
} from "@/lib/github/client.server";
import { getGitHubLimits } from "@/lib/github/server-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;

const MAX_JSON_BYTES = 10_000;

function failure(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return Response.json(
    { message, ...extra },
    { status, headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: Request) {
  const contentType =
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ??
    "";
  if (contentType !== "application/json") {
    return failure("Content-Type must be application/json.", 415);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    return failure("Request is too large.", 413);
  }

  let body: unknown;
  try {
    const serialized = await request.text();
    if (new TextEncoder().encode(serialized).byteLength > MAX_JSON_BYTES) {
      return failure("Request is too large.", 413);
    }
    body = JSON.parse(serialized);
  } catch {
    return failure("Request is not valid JSON.", 400);
  }

  const parsed = GitHubReposRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return failure(first?.message ?? "Invalid request.", 400);
  }

  const limits = getGitHubLimits();
  const perPage = Math.min(parsed.data.perPage ?? 30, limits.maxRepos);
  const page = parsed.data.page ?? 1;

  try {
    const repos = await fetchGitHubRepos(parsed.data.username, page, perPage);
    return Response.json({ repos }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof GitHubClientError) {
      if (error.kind === "not_found") {
        return failure("GitHub user not found.", 404);
      }
      if (error.kind === "rate_limited") {
        return failure(
          "GitHub is rate-limited. Try again in a moment.",
          429,
          error.retryAfterMs ? { retryAfterMs: error.retryAfterMs } : undefined,
        );
      }
      if (error.kind === "timeout") {
        return failure("GitHub request timed out. Try again.", 504);
      }
      return failure("GitHub is temporarily unavailable. Try again.", 503);
    }
    return failure("Could not fetch repositories.", 500);
  }
}

import { GitHubProfileRequestSchema } from "@/lib/github/contracts";
import {
  fetchGitHubProfile,
  GitHubClientError,
} from "@/lib/github/client.server";

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

  const parsed = GitHubProfileRequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return failure(first?.message ?? "Invalid username.", 400);
  }

  try {
    const profile = await fetchGitHubProfile(parsed.data.username);
    return Response.json({ profile }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof GitHubClientError) {
      if (error.kind === "not_found") {
        return failure(
          "GitHub user not found. Check the username and try again.",
          404,
        );
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
      if (error.kind === "unauthorized") {
        return failure("GitHub authorization failed. Check server token.", 500);
      }
      return failure("GitHub is temporarily unavailable. Try again.", 503);
    }
    return failure("Could not fetch GitHub profile.", 500);
  }
}

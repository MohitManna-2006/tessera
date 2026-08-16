import {
  generateStandaloneProject,
  packageStandaloneProject,
  verifyGeneratedProject,
  verifyPackagedArchive,
} from "@/lib/export/generator";
import { EXPORT_FILENAME, EXPORT_MIME_TYPE } from "@/lib/export/constants";
import type {
  ExportStreamEvent,
  ServerExportStage,
} from "@/lib/export/protocol";
import { validatePortfolioExportRequest } from "@/lib/portfolio-validation";

export const runtime = "nodejs";

const encoder = new TextEncoder();
const MAX_REQUEST_LENGTH = 100_000;

function jsonLine(event: ExportStreamEvent) {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

function failureResponse(
  message: string,
  status: number,
  issues?: readonly {
    path: string;
    message: string;
    section?: string;
    fieldId?: string;
  }[],
) {
  return Response.json(issues ? { message, issues } : { message }, { status });
}

export async function POST(request: Request) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return failureResponse("The export request could not be read.", 400);
  }
  if (body.length > MAX_REQUEST_LENGTH) {
    return failureResponse("The portfolio is too large to export.", 413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return failureResponse("The export request is not valid JSON.", 400);
  }

  const validation = validatePortfolioExportRequest(payload);
  if (!validation.success) {
    return failureResponse(
      "Correct the portfolio validation errors before exporting.",
      400,
      validation.issues,
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let currentStage: ServerExportStage = "generating";
      try {
        controller.enqueue(
          jsonLine({
            type: "stage",
            completed: "preparing",
            current: "generating",
          }),
        );

        const project = await generateStandaloneProject(validation.data);
        currentStage = "verifying";
        controller.enqueue(
          jsonLine({
            type: "stage",
            completed: "generating",
            current: "verifying",
          }),
        );

        verifyGeneratedProject(project);
        currentStage = "packaging";
        controller.enqueue(
          jsonLine({
            type: "stage",
            completed: "verifying",
            current: "packaging",
          }),
        );

        const archive = packageStandaloneProject(project);
        verifyPackagedArchive(archive, project);
        controller.enqueue(
          jsonLine({
            type: "archive",
            archiveBase64: Buffer.from(archive).toString("base64"),
            filename: EXPORT_FILENAME,
            mimeType: EXPORT_MIME_TYPE,
          }),
        );
        controller.close();
      } catch (error) {
        console.error("Portfolio export failed.", {
          stage: currentStage,
          error: error instanceof Error ? error.name : "UnknownError",
        });
        controller.enqueue(
          jsonLine({
            type: "failure",
            stage: currentStage,
            message: "We couldn't package your portfolio. Your draft is safe.",
          }),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const EXPORT_STAGE_ORDER = [
  "preparing",
  "generating",
  "verifying",
  "packaging",
  "download-started",
] as const;

export type ExportStage = (typeof EXPORT_STAGE_ORDER)[number];
export type ServerExportStage = Exclude<ExportStage, "download-started">;

export type ExportStreamEvent =
  | {
      type: "stage";
      completed: ServerExportStage;
      current: ServerExportStage;
    }
  | {
      type: "archive";
      archiveBase64: string;
      filename: string;
      mimeType: string;
    }
  | {
      type: "failure";
      stage: ServerExportStage;
      message: string;
    };

export function parseExportStreamEvent(value: unknown): ExportStreamEvent {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid export stream event.");
  }

  const event = value as Record<string, unknown>;
  if (
    event.type === "stage" &&
    isServerStage(event.completed) &&
    isServerStage(event.current)
  ) {
    return {
      type: "stage",
      completed: event.completed,
      current: event.current,
    };
  }
  if (
    event.type === "archive" &&
    typeof event.archiveBase64 === "string" &&
    typeof event.filename === "string" &&
    typeof event.mimeType === "string"
  ) {
    return {
      type: "archive",
      archiveBase64: event.archiveBase64,
      filename: event.filename,
      mimeType: event.mimeType,
    };
  }
  if (
    event.type === "failure" &&
    isServerStage(event.stage) &&
    typeof event.message === "string"
  ) {
    return {
      type: "failure",
      stage: event.stage,
      message: event.message,
    };
  }

  throw new Error("Invalid export stream event.");
}

function isServerStage(value: unknown): value is ServerExportStage {
  return (
    value === "preparing" ||
    value === "generating" ||
    value === "verifying" ||
    value === "packaging"
  );
}

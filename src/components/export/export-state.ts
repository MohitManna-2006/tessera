import {
  EXPORT_STAGE_ORDER,
  type ExportStage,
  type ServerExportStage,
} from "@/lib/export/protocol";

export type ExportStatus =
  "idle" | ServerExportStage | "ready" | "download-started" | "failed";

export type ExportState = {
  status: ExportStatus;
  completedStages: readonly ExportStage[];
  failedStage?: ServerExportStage;
  failureMessage?: string;
};

export type ExportAction =
  | { type: "start" }
  | { type: "server-stage"; stage: ServerExportStage }
  | { type: "ready" }
  | { type: "download-started" }
  | {
      type: "failed";
      stage: ServerExportStage;
      message: string;
    }
  | { type: "close" };

export const INITIAL_EXPORT_STATE: ExportState = {
  status: "idle",
  completedStages: [],
};

const NEXT_SERVER_STAGE: Partial<Record<ServerExportStage, ServerExportStage>> =
  {
    preparing: "generating",
    generating: "verifying",
    verifying: "packaging",
  };

function completedBefore(stage: ServerExportStage): ExportStage[] {
  return EXPORT_STAGE_ORDER.slice(0, EXPORT_STAGE_ORDER.indexOf(stage));
}

export function exportReducer(
  state: ExportState,
  action: ExportAction,
): ExportState {
  switch (action.type) {
    case "start":
      if (state.status !== "idle" && state.status !== "failed") {
        return state;
      }
      return {
        status: "preparing",
        completedStages: [],
      };
    case "server-stage":
      if (
        state.status !== "preparing" &&
        state.status !== "generating" &&
        state.status !== "verifying"
      ) {
        return state;
      }
      if (NEXT_SERVER_STAGE[state.status] !== action.stage) {
        return state;
      }
      return {
        status: action.stage,
        completedStages: completedBefore(action.stage),
      };
    case "ready":
      if (state.status !== "packaging") {
        return state;
      }
      return {
        status: "ready",
        completedStages: EXPORT_STAGE_ORDER.slice(0, 4),
      };
    case "download-started":
      if (state.status !== "ready") {
        return state;
      }
      return {
        status: "download-started",
        completedStages: [...EXPORT_STAGE_ORDER],
      };
    case "failed":
      if (
        state.status === "idle" ||
        state.status === "download-started" ||
        state.status === "failed"
      ) {
        return state;
      }
      return {
        status: "failed",
        completedStages: completedBefore(action.stage),
        failedStage: action.stage,
        failureMessage: action.message,
      };
    case "close":
      if (state.status !== "failed" && state.status !== "download-started") {
        return state;
      }
      return INITIAL_EXPORT_STATE;
  }
}

export function isExportRunning(status: ExportStatus) {
  return (
    status === "preparing" ||
    status === "generating" ||
    status === "verifying" ||
    status === "packaging" ||
    status === "ready"
  );
}

export function getCurrentExportStage(
  state: ExportState,
): ExportStage | undefined {
  if (
    state.status === "preparing" ||
    state.status === "generating" ||
    state.status === "verifying" ||
    state.status === "packaging" ||
    state.status === "download-started"
  ) {
    return state.status;
  }
  return state.failedStage;
}

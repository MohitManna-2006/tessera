import { describe, expect, it } from "vitest";

import {
  exportReducer,
  INITIAL_EXPORT_STATE,
  isExportRunning,
} from "./export-state";

describe("export state machine", () => {
  it("accepts only the ordered export transitions", () => {
    const preparing = exportReducer(INITIAL_EXPORT_STATE, { type: "start" });
    expect(preparing.status).toBe("preparing");
    expect(isExportRunning(preparing.status)).toBe(true);

    expect(
      exportReducer(preparing, {
        type: "server-stage",
        stage: "packaging",
      }),
    ).toBe(preparing);

    const generating = exportReducer(preparing, {
      type: "server-stage",
      stage: "generating",
    });
    const verifying = exportReducer(generating, {
      type: "server-stage",
      stage: "verifying",
    });
    const packaging = exportReducer(verifying, {
      type: "server-stage",
      stage: "packaging",
    });
    const ready = exportReducer(packaging, { type: "ready" });
    const complete = exportReducer(ready, { type: "download-started" });

    expect(complete).toEqual({
      status: "download-started",
      completedStages: [
        "preparing",
        "generating",
        "verifying",
        "packaging",
        "download-started",
      ],
    });
    expect(isExportRunning(complete.status)).toBe(false);
    expect(exportReducer(complete, { type: "download-started" })).toBe(
      complete,
    );
  });

  it("preserves completed work at the real failed stage and supports retry", () => {
    const preparing = exportReducer(INITIAL_EXPORT_STATE, { type: "start" });
    const generating = exportReducer(preparing, {
      type: "server-stage",
      stage: "generating",
    });
    const verifying = exportReducer(generating, {
      type: "server-stage",
      stage: "verifying",
    });
    const failed = exportReducer(verifying, {
      type: "failed",
      stage: "verifying",
      message: "Draft is safe.",
    });

    expect(failed).toEqual({
      status: "failed",
      completedStages: ["preparing", "generating"],
      failedStage: "verifying",
      failureMessage: "Draft is safe.",
    });
    expect(exportReducer(failed, { type: "start" })).toEqual({
      status: "preparing",
      completedStages: [],
    });
    expect(exportReducer(failed, { type: "close" })).toEqual(
      INITIAL_EXPORT_STATE,
    );
  });
});

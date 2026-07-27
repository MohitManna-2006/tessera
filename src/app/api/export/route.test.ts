// @vitest-environment node

import { describe, expect, it } from "vitest";

import { inspectDeterministicZip } from "@/lib/export/zip";
import { EXPORT_ARCHIVE_ROOT } from "@/lib/export/constants";
import { createPortfolioDraft } from "@/lib/portfolio";
import { createPortfolioExportSnapshot } from "@/lib/portfolio-validation";

import { POST } from "./route";

describe("portfolio export route", () => {
  it("streams real stages in order and returns a verified archive", async () => {
    const snapshot = createPortfolioExportSnapshot(createPortfolioDraft());
    if (!snapshot.success) {
      throw new Error("Fixture should be valid.");
    }

    const response = await POST(
      new Request("http://localhost/api/export", {
        method: "POST",
        body: JSON.stringify(snapshot.data),
      }),
    );
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, string>);

    expect(response.status).toBe(200);
    expect(events.slice(0, 3)).toEqual([
      {
        type: "stage",
        completed: "preparing",
        current: "generating",
      },
      {
        type: "stage",
        completed: "generating",
        current: "verifying",
      },
      {
        type: "stage",
        completed: "verifying",
        current: "packaging",
      },
    ]);

    const archiveEvent = events[3];
    expect(archiveEvent).toMatchObject({
      type: "archive",
      filename: "tessera-portfolio.zip",
      mimeType: "application/zip",
    });
    const entries = inspectDeterministicZip(
      Buffer.from(archiveEvent.archiveBase64, "base64"),
    );
    expect(entries.has(`${EXPORT_ARCHIVE_ROOT}/tessera-export.json`)).toBe(
      true,
    );
  });

  it("rejects invalid data before opening an export stream", async () => {
    const response = await POST(
      new Request("http://localhost/api/export", {
        method: "POST",
        body: JSON.stringify({
          schemaVersion: 1,
          sectionOrder: [],
          portfolio: {},
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
  });
});

import { execFile, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { afterAll, describe, expect, it } from "vitest";

import { EXPORT_ARCHIVE_ROOT, EXPORT_DATA_PATH } from "@/lib/export/constants";
import {
  generateStandaloneProject,
  packageStandaloneProject,
  verifyPackagedArchive,
} from "@/lib/export/generator";
import { createPortfolioDraft } from "@/lib/portfolio";
import { createPortfolioExportSnapshot } from "@/lib/portfolio-validation";

const execFileAsync = promisify(execFile);
let temporaryDirectory = "";

async function getAvailablePort() {
  return new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a test port."));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

async function waitForPage(url: string, server: ChildProcess) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error("Exported project server stopped before it was ready.");
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.text();
      }
    } catch {
      // The server is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error("Exported project server did not become ready.");
}

afterAll(async () => {
  if (!temporaryDirectory) {
    return;
  }
  const resolved = resolve(temporaryDirectory);
  if (
    !resolved.startsWith(`${resolve(tmpdir())}${sep}`) ||
    !basename(resolved).startsWith("tessera-export-build-")
  ) {
    throw new Error("Refusing to remove an unsafe build-test path.");
  }
  await rm(resolved, { recursive: true, force: true });
});

describe("exported portfolio project", () => {
  it("extracts, installs, checks, builds, and renders independently", async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "tessera-export-build-"));
    const snapshot = createPortfolioExportSnapshot(createPortfolioDraft());
    if (!snapshot.success) {
      throw new Error("Fixture should be valid.");
    }
    snapshot.data.portfolio.profile.fullName = "Independent Build";
    snapshot.data.portfolio.projects[0].name = "Exported Project";

    const project = await generateStandaloneProject(snapshot.data);
    const archive = packageStandaloneProject(project);
    verifyPackagedArchive(archive, project);

    const archivePath = join(temporaryDirectory, "portfolio.zip");
    const extractPath = join(temporaryDirectory, "extracted");
    await writeFile(archivePath, archive);
    await execFileAsync("unzip", ["-q", archivePath, "-d", extractPath]);

    const projectRoot = join(extractPath, EXPORT_ARCHIVE_ROOT);
    expect(
      resolve(projectRoot, ...EXPORT_DATA_PATH.split("/")).startsWith(
        `${resolve(projectRoot)}${sep}`,
      ),
    ).toBe(true);

    const commandOptions = {
      cwd: projectRoot,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      maxBuffer: 10 * 1024 * 1024,
      timeout: 180_000,
    };
    await execFileAsync("npm", ["ci", "--ignore-scripts"], commandOptions);
    await execFileAsync("npm", ["run", "format:check"], commandOptions);
    await execFileAsync("npm", ["run", "typecheck"], commandOptions);
    await execFileAsync("npm", ["run", "build"], commandOptions);

    const port = await getAvailablePort();
    const server = spawn(
      "npm",
      ["run", "start", "--", "-p", String(port), "-H", "127.0.0.1"],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          NEXT_TELEMETRY_DISABLED: "1",
        },
        stdio: "ignore",
      },
    );

    try {
      const html = await waitForPage(`http://127.0.0.1:${port}`, server);
      expect(html).toContain("Independent Build");
      expect(html).toContain("Exported Project");
      expect(html).toContain("Experience");
      expect(html.indexOf("Experience")).toBeLessThan(
        html.indexOf("Selected work"),
      );
    } finally {
      server.kill("SIGTERM");
    }
  });
});

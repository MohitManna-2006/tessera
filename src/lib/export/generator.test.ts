// @vitest-environment node

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { createPortfolioDraft, PORTFOLIO_SECTION_ORDER } from "../portfolio";
import { createPortfolioExportSnapshot } from "../portfolio-validation";
import {
  ALLOWED_PROJECT_PATHS,
  EXPORT_ARCHIVE_ROOT,
  EXPORT_DATA_PATH,
  EXPORT_MANIFEST_PATH,
} from "./constants";
import {
  generateStandaloneProject,
  packageStandaloneProject,
  verifyGeneratedProject,
  verifyPackagedArchive,
} from "./generator";
import { inspectDeterministicZip } from "./zip";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    const resolved = resolve(directory);
    const temporaryRoot = `${resolve(tmpdir())}${sep}`;
    if (
      !resolved.startsWith(temporaryRoot) ||
      !resolved.split(sep).at(-1)?.startsWith("tessera-export-test-")
    ) {
      throw new Error("Refusing to remove an unsafe test path.");
    }
    await rm(resolved, { recursive: true, force: true });
  }
});

function validRequest() {
  const result = createPortfolioExportSnapshot(createPortfolioDraft());
  if (!result.success) {
    throw new Error("Fixture should be valid.");
  }
  return result.data;
}

describe("standalone portfolio generator", () => {
  it("generates only allowed files with current data, versions, and ordering", async () => {
    const request = validRequest();
    request.portfolio.profile.fullName = "Casey Chen";
    request.portfolio.experience[0].organization = "First role";
    request.portfolio.experience[1].organization = "Second role";

    const project = await generateStandaloneProject(request);
    verifyGeneratedProject(project);

    expect(project.files.map((file) => file.path)).toEqual(
      ALLOWED_PROJECT_PATHS,
    );
    expect(project.manifest).toMatchObject({
      formatVersion: 1,
      schemaVersion: 1,
      templateVersion: "1.0.0",
      archiveRoot: `${EXPORT_ARCHIVE_ROOT}/`,
      sectionOrder: [...PORTFOLIO_SECTION_ORDER],
      dataPath: EXPORT_DATA_PATH,
    });

    const data = JSON.parse(
      new TextDecoder().decode(
        project.files.find((file) => file.path === EXPORT_DATA_PATH)?.content,
      ),
    ) as {
      profile: { fullName: string };
      experience: { organization: string }[];
    };
    expect(data.profile.fullName).toBe("Casey Chen");
    expect(data.experience.map((entry) => entry.organization)).toEqual([
      "First role",
      "Second role",
    ]);

    const paths = project.files.map((file) => file.path);
    expect(paths.filter((path) => path === EXPORT_MANIFEST_PATH)).toHaveLength(
      1,
    );
    expect(paths.some((path) => path.includes(".env"))).toBe(false);
    expect(paths.some((path) => path.includes(".git"))).toBe(false);
    expect(paths.some((path) => path.includes("builder"))).toBe(false);
    expect(paths.some((path) => path.includes("node_modules"))).toBe(false);
  });

  it("rejects invalid shape, links, schema versions, and unexpected fields", async () => {
    const malformed = {
      ...validRequest(),
      schemaVersion: 2,
      executablePath: "../../run.js",
      portfolio: {
        ...validRequest().portfolio,
        links: {
          ...validRequest().portfolio.links,
          email: "not-an-email",
        },
      },
    };

    await expect(generateStandaloneProject(malformed as never)).rejects.toThrow(
      "failed export validation",
    );
  });

  it("produces byte-identical ZIPs for identical input and different bytes for changed input", async () => {
    const request = validRequest();
    const firstProject = await generateStandaloneProject(request);
    const secondProject = await generateStandaloneProject(validRequest());
    const firstArchive = packageStandaloneProject(firstProject);
    const secondArchive = packageStandaloneProject(secondProject);

    expect(Buffer.from(firstArchive).equals(Buffer.from(secondArchive))).toBe(
      true,
    );

    const changedRequest = validRequest();
    changedRequest.portfolio.profile.fullName = "Different person";
    const changedArchive = packageStandaloneProject(
      await generateStandaloneProject(changedRequest),
    );
    expect(Buffer.from(firstArchive).equals(Buffer.from(changedArchive))).toBe(
      false,
    );
  });

  it("keeps user content out of paths and reopens and extracts a safe ZIP", async () => {
    const request = validRequest();
    request.portfolio.profile.fullName = "../../.env";
    request.portfolio.profile.biography = "Path-like text ../notes";
    const project = await generateStandaloneProject(request);
    const archive = packageStandaloneProject(project);

    verifyPackagedArchive(archive, project);
    const entries = inspectDeterministicZip(archive);
    expect([...entries.keys()]).toEqual(
      ALLOWED_PROJECT_PATHS.map(
        (projectPath) => `${EXPORT_ARCHIVE_ROOT}/${projectPath}`,
      ),
    );

    const directory = await mkdtemp(join(tmpdir(), "tessera-export-test-"));
    temporaryDirectories.push(directory);
    const archivePath = join(directory, "portfolio.zip");
    const extractPath = join(directory, "extracted");
    await writeFile(archivePath, archive);
    await execFileAsync("unzip", ["-q", archivePath, "-d", extractPath]);

    const exportedData = await readFile(
      join(extractPath, EXPORT_ARCHIVE_ROOT, ...EXPORT_DATA_PATH.split("/")),
      "utf8",
    );
    expect(exportedData).toContain("../../.env");
    expect(exportedData).toContain("Path-like text ../notes");
  });
});

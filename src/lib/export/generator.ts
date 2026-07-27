import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  PORTFOLIO_SCHEMA_VERSION,
  PORTFOLIO_SECTION_ORDER,
} from "../portfolio";
import {
  validatePortfolioExportRequest,
  type PortfolioExportRequest,
} from "../portfolio-validation";
import {
  assertAllowedProjectPaths,
  assertSafeProjectPath,
  toArchivePath,
} from "./archive-safety";
import {
  EXPORT_ARCHIVE_ROOT,
  EXPORT_DATA_PATH,
  EXPORT_FILENAME,
  EXPORT_FORMAT_VERSION,
  EXPORT_MANIFEST_PATH,
  EXPORT_TEMPLATE_VERSION,
  TEMPLATE_FILE_MAP,
} from "./constants";
import { createDeterministicZip, inspectDeterministicZip } from "./zip";

export type GeneratedProjectFile = {
  path: string;
  content: Uint8Array;
};

export type ExportManifest = {
  formatVersion: typeof EXPORT_FORMAT_VERSION;
  schemaVersion: typeof PORTFOLIO_SCHEMA_VERSION;
  templateVersion: string;
  archiveRoot: string;
  sectionOrder: readonly string[];
  dataPath: string;
  files: readonly {
    path: string;
    sha256: string;
  }[];
};

export type GeneratedProject = {
  files: readonly GeneratedProjectFile[];
  manifest: ExportManifest;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function comparePaths(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function hashContent(content: Uint8Array) {
  return createHash("sha256").update(content).digest("hex");
}

async function loadTemplateFiles(): Promise<GeneratedProjectFile[]> {
  const templateRoot = join(process.cwd(), "templates", "standalone-portfolio");

  return Promise.all(
    TEMPLATE_FILE_MAP.map(async ([outputPath, templatePath]) => {
      assertSafeProjectPath(outputPath);
      const content = await readFile(join(templateRoot, templatePath));
      return {
        path: outputPath,
        content: new Uint8Array(content),
      };
    }),
  );
}

export async function generateStandaloneProject(
  request: PortfolioExportRequest,
): Promise<GeneratedProject> {
  const validated = validatePortfolioExportRequest(request);
  if (!validated.success) {
    throw new Error("Portfolio data failed export validation.");
  }

  const files = await loadTemplateFiles();
  files.push({
    path: EXPORT_DATA_PATH,
    content: encoder.encode(stableJson(validated.data.portfolio)),
  });
  files.sort((left, right) => comparePaths(left.path, right.path));

  const manifest: ExportManifest = {
    formatVersion: EXPORT_FORMAT_VERSION,
    schemaVersion: PORTFOLIO_SCHEMA_VERSION,
    templateVersion: EXPORT_TEMPLATE_VERSION,
    archiveRoot: `${EXPORT_ARCHIVE_ROOT}/`,
    sectionOrder: [...PORTFOLIO_SECTION_ORDER],
    dataPath: EXPORT_DATA_PATH,
    files: files.map((file) => ({
      path: file.path,
      sha256: hashContent(file.content),
    })),
  };

  files.push({
    path: EXPORT_MANIFEST_PATH,
    content: encoder.encode(stableJson(manifest)),
  });
  files.sort((left, right) => comparePaths(left.path, right.path));

  return { files, manifest };
}

export function verifyGeneratedProject(project: GeneratedProject) {
  const paths = project.files.map((file) => file.path);
  for (const projectPath of paths) {
    assertSafeProjectPath(projectPath);
  }
  if (new Set(paths).size !== paths.length) {
    throw new Error("Generated project contains duplicate files.");
  }
  assertAllowedProjectPaths(paths);

  if (
    project.manifest.formatVersion !== EXPORT_FORMAT_VERSION ||
    project.manifest.schemaVersion !== PORTFOLIO_SCHEMA_VERSION ||
    project.manifest.templateVersion !== EXPORT_TEMPLATE_VERSION ||
    project.manifest.archiveRoot !== `${EXPORT_ARCHIVE_ROOT}/` ||
    project.manifest.dataPath !== EXPORT_DATA_PATH ||
    project.manifest.sectionOrder.length !== PORTFOLIO_SECTION_ORDER.length ||
    project.manifest.sectionOrder.some(
      (section, index) => section !== PORTFOLIO_SECTION_ORDER[index],
    )
  ) {
    throw new Error("Export manifest is incompatible.");
  }

  const filesByPath = new Map(
    project.files.map((file) => [file.path, file.content]),
  );
  const manifestFile = filesByPath.get(EXPORT_MANIFEST_PATH);
  const dataFile = filesByPath.get(EXPORT_DATA_PATH);
  const packageFile = filesByPath.get("package.json");
  if (!manifestFile || !dataFile || !packageFile) {
    throw new Error("Generated project is missing required files.");
  }

  if (decoder.decode(manifestFile) !== stableJson(project.manifest)) {
    throw new Error("Export manifest content does not match.");
  }
  for (const entry of project.manifest.files) {
    const content = filesByPath.get(entry.path);
    if (!content || hashContent(content) !== entry.sha256) {
      throw new Error("Export manifest file hash does not match.");
    }
  }

  const portfolio = JSON.parse(decoder.decode(dataFile)) as unknown;
  const validation = validatePortfolioExportRequest({
    schemaVersion: project.manifest.schemaVersion,
    sectionOrder: project.manifest.sectionOrder,
    portfolio,
  });
  if (!validation.success) {
    throw new Error("Exported portfolio data is invalid.");
  }

  const packageManifest = JSON.parse(decoder.decode(packageFile)) as {
    dependencies?: Record<string, string>;
  };
  if (packageManifest.dependencies?.tessera) {
    throw new Error("Exported project depends on Tessera.");
  }

  return project;
}

export function packageStandaloneProject(project: GeneratedProject) {
  verifyGeneratedProject(project);
  return createDeterministicZip(
    project.files.map((file) => ({
      path: toArchivePath(file.path),
      content: file.content,
    })),
  );
}

export function verifyPackagedArchive(
  archive: Uint8Array,
  project: GeneratedProject,
) {
  const entries = inspectDeterministicZip(archive);
  if (entries.size !== project.files.length) {
    throw new Error("ZIP entry count does not match the project.");
  }

  for (const file of project.files) {
    const archiveContent = entries.get(toArchivePath(file.path));
    if (
      !archiveContent ||
      !Buffer.from(archiveContent).equals(Buffer.from(file.content))
    ) {
      throw new Error("ZIP entry content does not match the project.");
    }
  }

  const manifestContent = entries.get(toArchivePath(EXPORT_MANIFEST_PATH));
  if (
    !manifestContent ||
    decoder.decode(manifestContent) !== stableJson(project.manifest)
  ) {
    throw new Error("ZIP manifest is missing or invalid.");
  }

  return archive;
}

export async function generatePortfolioZip(request: PortfolioExportRequest) {
  const project = await generateStandaloneProject(request);
  verifyGeneratedProject(project);
  const archive = packageStandaloneProject(project);
  verifyPackagedArchive(archive, project);
  return {
    archive,
    filename: EXPORT_FILENAME,
    project,
  };
}

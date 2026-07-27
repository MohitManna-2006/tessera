import { ALLOWED_PROJECT_PATHS, EXPORT_ARCHIVE_ROOT } from "./constants";

const FORBIDDEN_SEGMENTS = new Set([
  ".git",
  ".next",
  "node_modules",
  "playwright-report",
  "test-results",
]);

export function assertSafeProjectPath(projectPath: string) {
  if (
    !projectPath ||
    projectPath.startsWith("/") ||
    projectPath.startsWith("\\") ||
    /^[A-Za-z]:/.test(projectPath) ||
    projectPath.includes("\\") ||
    projectPath.includes("\0")
  ) {
    throw new Error("Unsafe project path.");
  }

  const segments = projectPath.split("/");
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        FORBIDDEN_SEGMENTS.has(segment) ||
        segment.toLowerCase().startsWith(".env"),
    )
  ) {
    throw new Error("Forbidden project path.");
  }
}

export function toArchivePath(projectPath: string) {
  assertSafeProjectPath(projectPath);
  return `${EXPORT_ARCHIVE_ROOT}/${projectPath}`;
}

export function assertSafeArchivePath(archivePath: string) {
  if (!archivePath.startsWith(`${EXPORT_ARCHIVE_ROOT}/`)) {
    throw new Error("Archive entry is outside the fixed root.");
  }

  const projectPath = archivePath.slice(EXPORT_ARCHIVE_ROOT.length + 1);
  assertSafeProjectPath(projectPath);
  if (toArchivePath(projectPath) !== archivePath) {
    throw new Error("Archive path is not normalized.");
  }
}

export function assertAllowedProjectPaths(paths: readonly string[]) {
  const sorted = [...paths].sort();
  if (
    sorted.length !== ALLOWED_PROJECT_PATHS.length ||
    sorted.some((projectPath, index) => {
      return projectPath !== ALLOWED_PROJECT_PATHS[index];
    })
  ) {
    throw new Error("Generated project files do not match the allowlist.");
  }
}

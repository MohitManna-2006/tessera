export const EXPORT_ARCHIVE_ROOT = "tessera-portfolio";
export const EXPORT_FILENAME = "tessera-portfolio.zip";
export const EXPORT_MIME_TYPE = "application/zip";
export const EXPORT_MANIFEST_PATH = "tessera-export.json";
export const EXPORT_DATA_PATH = "src/data/portfolio.json";
export const EXPORT_TEMPLATE_VERSION = "1.0.0";
export const EXPORT_FORMAT_VERSION = 1;

export const TEMPLATE_FILE_MAP = [
  ["README.md", "README.md.template"],
  ["package-lock.json", "package-lock.json.template"],
  ["package.json", "package.json.template"],
  ["next.config.ts", "next.config.ts.template"],
  ["tsconfig.json", "tsconfig.json.template"],
  ["src/app/globals.css", "src/app/globals.css.template"],
  ["src/app/layout.tsx", "src/app/layout.tsx.template"],
  ["src/app/page.tsx", "src/app/page.tsx.template"],
  ["src/components/portfolio.tsx", "src/components/portfolio.tsx.template"],
  ["src/lib/portfolio.ts", "src/lib/portfolio.ts.template"],
] as const;

export const ALLOWED_PROJECT_PATHS = [
  ...TEMPLATE_FILE_MAP.map(([outputPath]) => outputPath),
  EXPORT_DATA_PATH,
  EXPORT_MANIFEST_PATH,
].sort();

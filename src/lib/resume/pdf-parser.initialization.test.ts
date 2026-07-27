// @vitest-environment node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const canvasGlobalNames = ["DOMMatrix", "ImageData", "Path2D"] as const;
const fixture = fileURLToPath(
  new URL("../../../tests/fixtures/resume/valid-resume.pdf", import.meta.url),
);
const limits = {
  maxUploadBytes: 5 * 1024 * 1024,
  maxPages: 20,
  maxTextCharacters: 200_000,
  minMeaningfulAlphanumericCharacters: 40,
};

let pdfJsWorkerDescriptor: PropertyDescriptor | undefined;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();

  if (pdfJsWorkerDescriptor === undefined) {
    Reflect.deleteProperty(globalThis, "pdfjsWorker");
  } else {
    Object.defineProperty(globalThis, "pdfjsWorker", pdfJsWorkerDescriptor);
  }
});

it("installs the official canvas globals before cold-loading real PDF.js", async () => {
  vi.resetModules();
  pdfJsWorkerDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "pdfjsWorker",
  );
  Reflect.deleteProperty(globalThis, "pdfjsWorker");
  for (const name of canvasGlobalNames) {
    vi.stubGlobal(name, undefined);
  }

  const consoleWarn = vi
    .spyOn(console, "warn")
    .mockImplementation(() => undefined);
  const { parsePdfText } = await import("./pdf-parser.server");

  for (const name of canvasGlobalNames) {
    expect(Reflect.get(globalThis, name)).toBeUndefined();
  }

  const result = await parsePdfText(
    new Uint8Array(await readFile(fixture)),
    limits,
  );
  const canvas = await import("@napi-rs/canvas");

  expect(result).toMatchObject({
    pageCount: 1,
    hasImages: false,
  });
  expect(result.pageTexts.join("\n")).toContain("FICTIONAL RESUME");
  expect(Reflect.get(globalThis, "DOMMatrix")).toBe(canvas.DOMMatrix);
  expect(Reflect.get(globalThis, "ImageData")).toBe(canvas.ImageData);
  expect(Reflect.get(globalThis, "Path2D")).toBe(canvas.Path2D);
  expect(Reflect.get(globalThis, "pdfjsWorker")).toMatchObject({
    WorkerMessageHandler: expect.any(Function),
  });
  expect(consoleWarn.mock.calls.flat().join("\n")).not.toMatch(
    /Cannot polyfill (DOMMatrix|ImageData|Path2D)/u,
  );
});

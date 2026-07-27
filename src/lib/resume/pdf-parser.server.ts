import "server-only";

import type { ResumeProcessingLimits } from "./contracts";
import { ResumeProcessingError } from "./errors";
import { hasPdfFileSignature } from "./selection";

type CanvasModule = typeof import("@napi-rs/canvas");
type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

type PdfTextItem = {
  str: string;
  hasEOL: boolean;
};

export type ParsedPdfText = {
  pageCount: number;
  pageTexts: string[];
  hasImages: boolean;
};

export type PdfTextParser = (
  data: Uint8Array,
  limits: ResumeProcessingLimits,
) => Promise<ParsedPdfText>;

const PASSWORD_RESPONSE_CODES = {
  needPassword: 1,
  incorrectPassword: 2,
} as const;

let pdfJsModulePromise: Promise<PdfJsModule> | undefined;

function installCanvasGlobals(canvas: CanvasModule) {
  const implementations = {
    DOMMatrix: canvas.DOMMatrix,
    ImageData: canvas.ImageData,
    Path2D: canvas.Path2D,
  };

  for (const [name, implementation] of Object.entries(implementations)) {
    if (typeof Reflect.get(globalThis, name) === "undefined") {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: implementation,
        writable: true,
      });
    }
  }
}

async function initializePdfJs(): Promise<PdfJsModule> {
  const canvas = await import("@napi-rs/canvas");
  installCanvasGlobals(canvas);

  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  Object.defineProperty(globalThis, "pdfjsWorker", {
    configurable: true,
    value: { WorkerMessageHandler: worker.WorkerMessageHandler },
    writable: true,
  });

  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

function loadPdfJs(): Promise<PdfJsModule> {
  pdfJsModulePromise ??= initializePdfJs();
  return pdfJsModulePromise;
}

function isPdfTextItem(value: unknown): value is PdfTextItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "str" in value &&
    typeof value.str === "string" &&
    "hasEOL" in value &&
    typeof value.hasEOL === "boolean"
  );
}

function shouldInsertSpace(current: string, next: string): boolean {
  if (!current || /\s$/u.test(current) || /^\s/u.test(next)) {
    return false;
  }
  if (/^[,.;:!?%)\]}]/u.test(next) || /[(\[{/@#$]$/u.test(current)) {
    return false;
  }
  return true;
}

function joinTextItems(items: readonly unknown[], rawCharacterLimit: number) {
  let text = "";

  for (const item of items) {
    if (!isPdfTextItem(item)) {
      continue;
    }

    if (item.str) {
      if (shouldInsertSpace(text, item.str)) {
        text += " ";
      }
      text += item.str;
    }
    if (item.hasEOL && !text.endsWith("\n")) {
      text += "\n";
    }

    if (text.length > rawCharacterLimit) {
      throw new ResumeProcessingError("text_limit_exceeded");
    }
  }

  return text;
}

function hasImageOperator(
  operators: { fnArray: readonly number[] },
  pdfJs: PdfJsModule,
): boolean {
  const imageOperators = new Set<number>([
    pdfJs.OPS.paintImageMaskXObject,
    pdfJs.OPS.paintImageXObject,
    pdfJs.OPS.paintInlineImageXObject,
    pdfJs.OPS.paintImageXObjectRepeat,
    pdfJs.OPS.paintImageMaskXObjectRepeat,
    pdfJs.OPS.paintSolidColorImageMask,
  ]);

  return operators.fnArray.some((operator) => imageOperators.has(operator));
}

function getErrorName(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    return error.name;
  }
  return "";
}

function getPasswordErrorCode(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "number"
  ) {
    return error.code;
  }
  return undefined;
}

export function classifyPdfParserError(
  error: unknown,
  pdfJs?: PdfJsModule,
): "encrypted_pdf" | "corrupted_pdf" | "unreadable_pdf" | null {
  const name = getErrorName(error);
  const passwordCode = getPasswordErrorCode(error);

  if (
    name === "PasswordException" &&
    (passwordCode === undefined ||
      passwordCode === PASSWORD_RESPONSE_CODES.needPassword ||
      passwordCode === PASSWORD_RESPONSE_CODES.incorrectPassword)
  ) {
    return "encrypted_pdf";
  }
  if (
    (pdfJs !== undefined && error instanceof pdfJs.InvalidPDFException) ||
    name === "InvalidPDFException" ||
    name === "XRefParseException" ||
    name === "FormatError"
  ) {
    return "corrupted_pdf";
  }
  if (
    (pdfJs !== undefined && error instanceof pdfJs.ResponseException) ||
    name === "ResponseException" ||
    name === "MissingPDFException" ||
    name === "UnexpectedResponseException" ||
    name === "UnknownErrorException"
  ) {
    return "unreadable_pdf";
  }
  return null;
}

export const parsePdfText: PdfTextParser = async (data, limits) => {
  if (!hasPdfFileSignature(data)) {
    throw new ResumeProcessingError("unreadable_pdf");
  }

  const pdfJs = await loadPdfJs();
  const loadingTask = pdfJs.getDocument({
    data,
    disableFontFace: true,
    isEvalSupported: false,
    stopAtErrors: true,
    useSystemFonts: false,
    useWasm: false,
    verbosity: pdfJs.VerbosityLevel.ERRORS,
  });

  try {
    const document = await loadingTask.promise;
    if (document.numPages === 0) {
      throw new ResumeProcessingError("empty_pdf");
    }
    if (document.numPages > limits.maxPages) {
      throw new ResumeProcessingError("page_limit_exceeded");
    }

    const pageTexts: string[] = [];
    let hasImages = false;
    const rawCharacterLimit = limits.maxTextCharacters * 2;

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent({
        disableNormalization: false,
        includeMarkedContent: false,
      });
      const pageText = joinTextItems(textContent.items, rawCharacterLimit);
      pageTexts.push(pageText);

      if (!/[\p{L}\p{N}]/u.test(pageText)) {
        const operators = await page.getOperatorList();
        hasImages ||= hasImageOperator(operators, pdfJs);
      }
    }

    return {
      pageCount: document.numPages,
      pageTexts,
      hasImages,
    };
  } catch (error) {
    if (error instanceof ResumeProcessingError) {
      throw error;
    }

    const classifiedCode = classifyPdfParserError(error, pdfJs);
    if (classifiedCode) {
      throw new ResumeProcessingError(classifiedCode);
    }
    throw error;
  } finally {
    await loadingTask.destroy();
  }
};

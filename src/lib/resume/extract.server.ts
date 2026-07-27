import "server-only";

import type {
  ResumeExtractionResult,
  ResumeProcessingLimits,
} from "./contracts";
import { createResumeExtractionFailure, ResumeProcessingError } from "./errors";
import {
  analyzeMeaningfulResumeText,
  normalizeResumeText,
} from "./normalization";
import { parsePdfText, type PdfTextParser } from "./pdf-parser.server";

type ExtractResumeTextOptions = {
  data: Uint8Array;
  filename: string;
  limits: ResumeProcessingLimits;
  parser?: PdfTextParser;
};

export async function extractResumeText({
  data,
  filename,
  limits,
  parser = parsePdfText,
}: ExtractResumeTextOptions): Promise<ResumeExtractionResult> {
  try {
    const parsed = await parser(data, limits);
    const text = normalizeResumeText(parsed.pageTexts.join("\n\n"));

    if (text.length > limits.maxTextCharacters) {
      throw new ResumeProcessingError("text_limit_exceeded");
    }
    if (!text) {
      throw new ResumeProcessingError(
        parsed.hasImages ? "image_only_pdf" : "empty_pdf",
      );
    }

    const meaningfulText = analyzeMeaningfulResumeText(
      text,
      limits.minMeaningfulAlphanumericCharacters,
    );
    if (!meaningfulText.meaningful) {
      throw new ResumeProcessingError("no_meaningful_text");
    }

    return {
      ok: true,
      status: "success",
      data: {
        filename,
        pageCount: parsed.pageCount,
        characterCount: text.length,
        text,
        warnings: [
          {
            code: "plain_text_layout",
            message:
              "PDF layout was converted to plain text; review line breaks and spacing.",
          },
        ],
      },
    };
  } catch (error) {
    if (error instanceof ResumeProcessingError) {
      return createResumeExtractionFailure(error.code, limits);
    }

    const errorName =
      error instanceof Error && /^[A-Za-z][A-Za-z0-9]*$/u.test(error.name)
        ? error.name.slice(0, 40)
        : "UnknownError";
    console.error("Resume extraction failed unexpectedly.", { errorName });
    return createResumeExtractionFailure("internal_extraction_failure", limits);
  }
}

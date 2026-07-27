// @vitest-environment node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST } from "./route";

const fixture = (name: string) =>
  fileURLToPath(
    new URL("../../../../../tests/fixtures/resume/" + name, import.meta.url),
  );

async function uploadRequest(
  name: string,
  options: {
    field?: string;
    filename?: string;
    type?: string;
    bytes?: Uint8Array;
  } = {},
) {
  const bytes = options.bytes ?? new Uint8Array(await readFile(fixture(name)));
  const fileBytes = Uint8Array.from(bytes).buffer;
  const formData = new FormData();
  formData.append(
    options.field ?? "resume",
    new File([fileBytes], options.filename ?? name, {
      type: options.type ?? "application/pdf",
    }),
  );
  return new Request("http://localhost/api/resume/extract", {
    method: "POST",
    body: formData,
  });
}

async function responseBody(response: Response) {
  return (await response.json()) as {
    ok: boolean;
    status: string;
    data?: {
      pageCount: number;
      characterCount: number;
      text: string;
    };
    error?: { code: string; message: string };
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("resume extraction route", () => {
  it("extracts a real PDF in memory with no-store security headers", async () => {
    const consoleLog = vi.spyOn(console, "log");
    const consoleWarn = vi.spyOn(console, "warn");
    const consoleError = vi.spyOn(console, "error");
    const externalFetch = vi.fn();
    vi.stubGlobal("fetch", externalFetch);

    const response = await POST(await uploadRequest("valid-resume.pdf"));
    const body = await responseBody(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(body).toMatchObject({
      ok: true,
      status: "success",
      data: { pageCount: 1 },
    });
    expect(body.data?.characterCount).toBe(body.data?.text.length);
    expect(body.data?.text).toContain("FICTIONAL RESUME");
    expect(externalFetch).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("extracts a real multi-page PDF in source order", async () => {
    const response = await POST(await uploadRequest("multi-page-resume.pdf"));
    const body = await responseBody(response);

    expect(response.status).toBe(200);
    expect(body.data?.pageCount).toBe(2);
    expect(body.data?.text.indexOf("FICTIONAL RESUME")).toBeLessThan(
      body.data?.text.indexOf("FICTIONAL EXPERIENCE CONTINUED") ?? -1,
    );
  });

  it("rejects a missing file, malformed multipart body, and ambiguous fields", async () => {
    const emptyForm = new FormData();
    const missingResponse = await POST(
      new Request("http://localhost/api/resume/extract", {
        method: "POST",
        body: emptyForm,
      }),
    );
    const malformedResponse = await POST(
      new Request("http://localhost/api/resume/extract", {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data; boundary=broken",
        },
        body: "not a multipart body",
      }),
    );
    const multipleForm = new FormData();
    multipleForm.append(
      "resume",
      new File(["%PDF-one"], "one.pdf", { type: "application/pdf" }),
    );
    multipleForm.append(
      "resume",
      new File(["%PDF-two"], "two.pdf", { type: "application/pdf" }),
    );
    const multipleResponse = await POST(
      new Request("http://localhost/api/resume/extract", {
        method: "POST",
        body: multipleForm,
      }),
    );
    const unexpectedResponse = await POST(
      await uploadRequest("valid-resume.pdf", { field: "file" }),
    );

    expect(missingResponse.status).toBe(400);
    expect(await responseBody(missingResponse)).toMatchObject({
      error: { code: "missing_file" },
    });
    for (const response of [
      malformedResponse,
      multipleResponse,
      unexpectedResponse,
    ]) {
      expect(response.status).toBe(400);
      expect(await responseBody(response)).toMatchObject({
        error: { code: "invalid_upload" },
      });
    }
  });

  it.each([
    {
      name: "empty-resume.pdf",
      status: 400,
      code: "empty_file",
    },
    {
      name: "renamed-text.pdf",
      status: 415,
      code: "unsupported_file_type",
    },
    {
      name: "encrypted-resume.pdf",
      status: 422,
      code: "encrypted_pdf",
    },
    {
      name: "corrupted-resume.pdf",
      status: 422,
      code: "corrupted_pdf",
    },
    {
      name: "blank-resume.pdf",
      status: 422,
      code: "empty_pdf",
    },
    {
      name: "image-only-resume.pdf",
      status: 422,
      code: "image_only_pdf",
    },
    {
      name: "symbols-only-resume.pdf",
      status: 422,
      code: "no_meaningful_text",
    },
  ])(
    "maps $name to $code without parser leakage",
    async ({ name, status, code }) => {
      const response = await POST(await uploadRequest(name));
      const body = await responseBody(response);

      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(body).toMatchObject({ ok: false, error: { code } });
      expect(body.error?.message).not.toMatch(
        /Invalid PDF|stack|node_modules|\/Users\//u,
      );
    },
  );

  it("rejects unsupported declared metadata before parsing", async () => {
    const wrongExtension = await POST(
      await uploadRequest("valid-resume.pdf", {
        filename: "resume.txt",
      }),
    );
    const wrongMime = await POST(
      await uploadRequest("valid-resume.pdf", {
        type: "text/plain",
      }),
    );

    for (const response of [wrongExtension, wrongMime]) {
      expect(response.status).toBe(415);
      expect(await responseBody(response)).toMatchObject({
        error: { code: "unsupported_file_type" },
      });
    }
  });

  it("enforces upload, page, and normalized text limits with small fixtures", async () => {
    vi.stubEnv("RESUME_MAX_UPLOAD_BYTES", "1024");
    const oversizedResponse = await POST(
      await uploadRequest("valid-resume.pdf", {
        bytes: new Uint8Array(1025),
      }),
    );

    vi.stubEnv("RESUME_MAX_UPLOAD_BYTES", "5242880");
    vi.stubEnv("RESUME_MAX_PAGES", "1");
    const pageLimitResponse = await POST(
      await uploadRequest("multi-page-resume.pdf"),
    );

    vi.stubEnv("RESUME_MAX_PAGES", "20");
    vi.stubEnv("RESUME_MAX_TEXT_CHARACTERS", "1000");
    const textLimitResponse = await POST(
      await uploadRequest("long-text-resume.pdf"),
    );

    expect(oversizedResponse.status).toBe(413);
    expect(await responseBody(oversizedResponse)).toMatchObject({
      error: { code: "file_too_large" },
    });
    expect(pageLimitResponse.status).toBe(422);
    expect(await responseBody(pageLimitResponse)).toMatchObject({
      error: { code: "page_limit_exceeded" },
    });
    expect(textLimitResponse.status).toBe(422);
    expect(await responseBody(textLimitResponse)).toMatchObject({
      error: { code: "text_limit_exceeded" },
    });
  });

  it("uses content length to reject an obviously oversized multipart body early", async () => {
    const response = await POST(
      new Request("http://localhost/api/resume/extract", {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data; boundary=unused",
          "Content-Length": String(5 * 1024 * 1024 + 64 * 1024 + 1),
        },
        body: "--unused--",
      }),
    );

    expect(response.status).toBe(413);
    expect(await responseBody(response)).toMatchObject({
      error: { code: "file_too_large" },
    });
  });
});

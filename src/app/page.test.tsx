import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EXPORT_STAGE_MINIMUM_MS } from "@/components/export/use-portfolio-export";
import {
  PORTFOLIO_SECTION_ORDER,
  type PortfolioSectionId,
} from "@/lib/portfolio";

import Home from "./page";

const SECTION_TITLES: Record<PortfolioSectionId, string> = {
  profile: "Profile",
  links: "Links",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  education: "Education",
};

function useCompactViewport() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 1024px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function getSectionButton(action: "Collapse" | "Expand", title: string) {
  return screen.getByRole("button", {
    name: `${action} ${title} section`,
  });
}

function getRenderedSectionOrder(attribute: string) {
  return Array.from(document.querySelectorAll(`[${attribute}]`), (element) =>
    element.getAttribute(attribute),
  );
}

function successfulExportResponse() {
  const events = [
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
    {
      type: "archive",
      archiveBase64: Buffer.from("deterministic zip").toString("base64"),
      filename: "tessera-portfolio.zip",
      mimeType: "application/zip",
    },
  ];
  const body = `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
  const encoded = new TextEncoder().encode(body);

  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoded);
        controller.close();
      },
    }),
    {
      headers: {
        "Content-Type": "application/x-ndjson",
      },
    },
  );
}

function mockDownloadApis() {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:tessera-export"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  return vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => undefined);
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function advanceExportTime(duration = EXPORT_STAGE_MINIMUM_MS) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(duration);
  });
}

function expectCurrentExportStage(label: string) {
  const stage = screen.getByText(label).closest("li");
  expect(stage).not.toBeNull();
  expect(within(stage as HTMLElement).getByText("Current")).toBeVisible();
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("Tessera portfolio builder", () => {
  it("renders the fixture and keeps editor and preview sections in canonical order", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Edit portfolio" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("Avery Morgan");
    expect(
      screen.getByRole("heading", { level: 2, name: "Avery Morgan" }),
    ).toBeInTheDocument();

    expect(getRenderedSectionOrder("data-editor-section")).toEqual([
      ...PORTFOLIO_SECTION_ORDER,
    ]);
    expect(getRenderedSectionOrder("data-portfolio-section")).toEqual([
      ...PORTFOLIO_SECTION_ORDER,
    ]);

    const experienceSection = document.querySelector(
      '[data-portfolio-section="experience"]',
    );
    const projectsSection = document.querySelector(
      '[data-portfolio-section="projects"]',
    );
    const skillsSection = document.querySelector(
      '[data-portfolio-section="skills"]',
    );
    const educationSection = document.querySelector(
      '[data-portfolio-section="education"]',
    );

    expect(experienceSection).toBeInstanceOf(HTMLElement);
    expect(projectsSection).toBeInstanceOf(HTMLElement);
    expect(skillsSection).toBeInstanceOf(HTMLElement);
    expect(educationSection).toBeInstanceOf(HTMLElement);
    expect(
      within(experienceSection as HTMLElement).getByRole("heading", {
        name: "Northstar Systems",
      }),
    ).toBeInTheDocument();
    expect(
      within(projectsSection as HTMLElement).getByRole("heading", {
        name: "Patchwork",
      }),
    ).toBeInTheDocument();
    expect(
      within(skillsSection as HTMLElement).getByRole("heading", {
        name: "Languages",
      }),
    ).toBeInTheDocument();
    expect(
      within(educationSection as HTMLElement).getByRole("heading", {
        name: "Oregon State University",
      }),
    ).toBeInTheDocument();
  });

  it("collapses and reopens Profile without losing draft data or exposing hidden fields to Tab", async () => {
    const user = userEvent.setup();
    render(<Home />);

    const nameInput = screen.getByLabelText("Full name");
    await user.clear(nameInput);
    await user.type(nameInput, "Jordan Lee");
    expect(
      screen.getByRole("heading", { level: 2, name: "Jordan Lee" }),
    ).toBeInTheDocument();

    const collapseProfile = getSectionButton("Collapse", "Profile");
    expect(collapseProfile).toHaveAttribute("aria-expanded", "true");
    expect(collapseProfile).toHaveAttribute("aria-controls", "profile-panel");
    collapseProfile.focus();
    await user.keyboard("{Enter}");

    const expandProfile = getSectionButton("Expand", "Profile");
    expect(expandProfile).toHaveAttribute("aria-expanded", "false");
    expect(nameInput).not.toBeVisible();
    expect(screen.getByText("Profile")).toBeVisible();

    expandProfile.focus();
    await user.tab();
    expect(getSectionButton("Expand", "Links")).toHaveFocus();

    expandProfile.focus();
    await user.keyboard(" ");
    expect(nameInput).toBeVisible();
    expect(nameInput).toHaveValue("Jordan Lee");
    expect(
      screen.getByRole("heading", { level: 2, name: "Jordan Lee" }),
    ).toBeInTheDocument();
  });

  it("supports multiple open sections and a valid all-sections-collapsed state", async () => {
    const user = userEvent.setup();
    render(<Home />);

    for (const section of PORTFOLIO_SECTION_ORDER.slice(1)) {
      await user.click(getSectionButton("Expand", SECTION_TITLES[section]));
    }

    for (const section of PORTFOLIO_SECTION_ORDER) {
      expect(
        getSectionButton("Collapse", SECTION_TITLES[section]),
      ).toHaveAttribute("aria-expanded", "true");
    }

    await user.click(getSectionButton("Collapse", "Profile"));
    for (const section of PORTFOLIO_SECTION_ORDER.slice(1)) {
      expect(
        getSectionButton("Collapse", SECTION_TITLES[section]),
      ).toHaveAttribute("aria-expanded", "true");
    }

    for (const section of PORTFOLIO_SECTION_ORDER.slice(1)) {
      await user.click(getSectionButton("Collapse", SECTION_TITLES[section]));
    }

    for (const section of PORTFOLIO_SECTION_ORDER) {
      const button = getSectionButton("Expand", SECTION_TITLES[section]);
      expect(button).toBeVisible();
      expect(button).toHaveAttribute("aria-expanded", "false");
    }
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);

    await user.click(getSectionButton("Expand", "Education"));
    expect(screen.getByLabelText("Institution")).toBeVisible();
    for (const section of PORTFOLIO_SECTION_ORDER.slice(0, -1)) {
      expect(
        getSectionButton("Expand", SECTION_TITLES[section]),
      ).toHaveAttribute("aria-expanded", "false");
    }
    await user.click(getSectionButton("Collapse", "Education"));
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("preserves invalid values and validation while their section is collapsed", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(getSectionButton("Expand", "Links"));
    const emailInput = screen.getByLabelText("Email");
    await user.clear(emailInput);
    await user.type(emailInput, "avery@");

    const emailError = screen.getByText("Enter a complete email address.");
    expect(emailError).toBeVisible();
    expect(screen.getByText("avery@", { selector: "span" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "avery@" })).toBeNull();

    await user.click(getSectionButton("Collapse", "Links"));
    expect(emailInput).not.toBeVisible();
    expect(emailError).not.toBeVisible();
    expect(getSectionButton("Collapse", "Profile")).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await user.click(getSectionButton("Expand", "Links"));
    expect(emailInput).toBeVisible();
    expect(emailInput).toHaveValue("avery@");
    expect(emailError).toBeVisible();

    const githubInput = screen.getByLabelText("GitHub URL");
    await user.clear(githubInput);
    await user.type(githubInput, "github dot com");
    expect(
      screen.getByText("github dot com", { selector: "span" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "github dot com" })).toBeNull();
    expect(githubInput).toHaveAccessibleDescription(
      "Enter a full URL beginning with http:// or https://.",
    );
  });

  it("updates the preview immediately as representative fields change", async () => {
    const user = userEvent.setup();
    render(<Home />);

    const headlineInput = screen.getByLabelText("Professional headline");
    await user.clear(headlineInput);
    await user.type(headlineInput, "Frontend engineer for public data tools");
    expect(
      screen.getByText("Frontend engineer for public data tools"),
    ).toBeInTheDocument();

    await user.click(getSectionButton("Expand", "Experience"));
    const roleInputs = screen.getAllByLabelText("Role");
    await user.clear(roleInputs[0]);
    await user.type(roleInputs[0], "Product Engineering Intern");
    expect(screen.getByText("Product Engineering Intern")).toBeInTheDocument();
  });

  it("restores the exact fixture without rewriting disclosure preferences", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Home />);

    await user.click(getSectionButton("Collapse", "Profile"));
    await user.click(getSectionButton("Expand", "Links"));
    const emailInput = screen.getByLabelText("Email");
    await user.clear(emailInput);
    await user.type(emailInput, "invalid");

    await user.click(screen.getByRole("button", { name: "Reset draft" }));

    expect(screen.getByLabelText("Full name")).toHaveValue("Avery Morgan");
    expect(emailInput).toHaveValue("avery.morgan@example.com");
    expect(getSectionButton("Expand", "Profile")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(getSectionButton("Collapse", "Links")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.queryByText("Enter a complete email address.")).toBeNull();
  });

  it("preserves disclosure state across keyboard-operated compact tabs", async () => {
    useCompactViewport();
    const user = userEvent.setup();
    render(<Home />);

    await waitFor(() =>
      expect(screen.getByRole("tabpanel", { name: "Edit" })).toBeVisible(),
    );
    await user.click(getSectionButton("Collapse", "Profile"));
    await user.click(getSectionButton("Expand", "Links"));

    const editTab = screen.getByRole("tab", { name: "Edit" });
    const previewTab = screen.getByRole("tab", { name: "Preview" });
    editTab.focus();
    fireEvent.keyDown(editTab, { key: "ArrowRight" });

    expect(previewTab).toHaveAttribute("aria-selected", "true");
    expect(previewTab).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "Preview" })).toBeVisible();
    expect(
      screen.getByRole("heading", { level: 1, name: "Avery Morgan" }),
    ).toBeVisible();

    await user.click(editTab);
    expect(getSectionButton("Expand", "Profile")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(getSectionButton("Collapse", "Links")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByLabelText("Email")).toBeVisible();
  });

  it("blocks an invalid draft before export and focuses its existing error", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<Home />);

    await user.click(getSectionButton("Expand", "Links"));
    const emailInput = screen.getByLabelText("Email");
    await user.clear(emailInput);
    await user.type(emailInput, "avery@");
    await user.click(screen.getByRole("button", { name: "Download code" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByText(
        "Correct the highlighted email or URL fields before downloading.",
      ),
    ).toBeVisible();
    expect(emailInput).toHaveFocus();
    expect(emailInput).toHaveValue("avery@");
  });

  it("paces every ordinary development stage while starting real work immediately", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.useFakeTimers();
    const anchorClick = mockDownloadApis();
    const fetchMock = vi.fn().mockResolvedValue(successfulExportResponse());
    vi.stubGlobal("fetch", fetchMock);
    render(<Home />);

    const downloadButton = screen.getByRole("button", {
      name: "Download code",
    });
    fireEvent.click(downloadButton);
    fireEvent.click(downloadButton);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toHaveFocus();
    expect(downloadButton).toBeDisabled();
    expect(screen.queryByText("UI preview mode")).toBeNull();
    expectCurrentExportStage("Preparing");
    expect(anchorClick).not.toHaveBeenCalled();

    await flushAsyncWork();
    await advanceExportTime(EXPORT_STAGE_MINIMUM_MS - 1);
    expectCurrentExportStage("Preparing");
    expect(anchorClick).not.toHaveBeenCalled();

    await advanceExportTime(1);
    expectCurrentExportStage("Generating");
    expect(anchorClick).not.toHaveBeenCalled();

    await advanceExportTime();
    expectCurrentExportStage("Verifying");
    expect(anchorClick).not.toHaveBeenCalled();

    await advanceExportTime();
    expectCurrentExportStage("Packaging");
    expect(anchorClick).not.toHaveBeenCalled();

    await advanceExportTime(EXPORT_STAGE_MINIMUM_MS - 1);
    expectCurrentExportStage("Packaging");
    expect(anchorClick).not.toHaveBeenCalled();

    await advanceExportTime(1);
    expect(
      screen.getByRole("heading", { name: "Your portfolio is ready" }),
    ).toBeVisible();
    expect(screen.getByText("The ZIP download has started.")).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: "Export progress: 5 of 5 stages complete",
      }),
    ).toBeVisible();
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Full name")).toHaveValue("Avery Morgan");

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await flushAsyncWork();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(downloadButton).toHaveFocus();
  });

  it("uses the same paced flow in production and ignores preview parameters", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.useFakeTimers();
    window.history.replaceState(
      null,
      "",
      "/?exportDemo=1&failStage=generating",
    );
    const anchorClick = mockDownloadApis();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(successfulExportResponse()),
    );
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Download code" }));
    await flushAsyncWork();

    expectCurrentExportStage("Preparing");
    expect(screen.queryByText("UI preview mode")).toBeNull();
    await advanceExportTime();
    expectCurrentExportStage("Generating");
    expect(anchorClick).not.toHaveBeenCalled();

    await advanceExportTime();
    await advanceExportTime();
    await advanceExportTime();

    expect(
      screen.getByRole("heading", { name: "Your portfolio is ready" }),
    ).toBeVisible();
    expect(anchorClick).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["generating", "Generating", 1],
    ["verifying", "Verifying", 2],
    ["packaging", "Packaging", 3],
  ] as const)(
    "injects a development-only %s failure and preserves completed stages",
    async (failStage, label, completedStageCount) => {
      vi.stubEnv("NODE_ENV", "development");
      vi.useFakeTimers();
      window.history.replaceState(null, "", `/?failStage=${failStage}`);
      const anchorClick = mockDownloadApis();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(successfulExportResponse()),
      );
      render(<Home />);

      fireEvent.click(screen.getByRole("button", { name: "Download code" }));
      await flushAsyncWork();
      for (let index = 0; index < completedStageCount; index += 1) {
        await advanceExportTime();
      }

      expect(
        screen.getByRole("heading", { name: "Export couldn't finish" }),
      ).toBeVisible();
      expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Close" })).toBeVisible();
      const failedStageItem = screen.getByText(label).closest("li");
      expect(failedStageItem).not.toBeNull();
      expect(
        within(failedStageItem as HTMLElement).getByText("Stopped"),
      ).toBeVisible();
      expect(screen.getAllByText("Done")).toHaveLength(completedStageCount);
      expect(anchorClick).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Full name")).toHaveValue("Avery Morgan");
    },
  );

  it("preserves ZIP bytes, filename, and MIME type and downloads exactly once", async () => {
    vi.useFakeTimers();
    const anchorClick = mockDownloadApis();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(successfulExportResponse()),
    );
    const view = render(
      <StrictMode>
        <Home />
      </StrictMode>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Download code" }));
    await flushAsyncWork();
    for (let index = 0; index < 4; index += 1) {
      await advanceExportTime();
    }

    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const [downloadBlob] = vi.mocked(URL.createObjectURL).mock.calls[0];
    expect((downloadBlob as Blob).type).toBe("application/zip");
    await expect((downloadBlob as Blob).text()).resolves.toBe(
      "deterministic zip",
    );
    const clickedAnchor = anchorClick.mock.instances[0] as HTMLAnchorElement;
    expect(clickedAnchor.download).toBe("tessera-portfolio.zip");

    view.rerender(
      <StrictMode>
        <Home />
      </StrictMode>,
    );
    await flushAsyncWork();
    expect(anchorClick).toHaveBeenCalledTimes(1);
  });

  it("lets a slow real request authorize progress without adding another preparing delay", async () => {
    vi.useFakeTimers();
    const anchorClick = mockDownloadApis();
    let resolveFetch: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Download code" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advanceExportTime(EXPORT_STAGE_MINIMUM_MS * 5);
    expectCurrentExportStage("Preparing");
    expect(anchorClick).not.toHaveBeenCalled();

    resolveFetch(successfulExportResponse());
    await flushAsyncWork();
    expectCurrentExportStage("Generating");

    await advanceExportTime();
    expectCurrentExportStage("Verifying");
    await advanceExportTime();
    expectCurrentExportStage("Packaging");
    await advanceExportTime();
    expect(anchorClick).toHaveBeenCalledTimes(1);
  });

  it("never lets presentation timers authorize a download before the archive is ready", async () => {
    vi.useFakeTimers();
    const encoder = new TextEncoder();
    let streamController:
      ReadableStreamDefaultController<Uint8Array> | undefined;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller;
          controller.enqueue(
            encoder.encode(
              [
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
              ]
                .map((event) => JSON.stringify(event))
                .join("\n") + "\n",
            ),
          );
        },
      }),
    );
    const anchorClick = mockDownloadApis();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Download code" }));
    await flushAsyncWork();
    await advanceExportTime();
    await advanceExportTime();
    await advanceExportTime();
    expectCurrentExportStage("Packaging");

    await advanceExportTime(EXPORT_STAGE_MINIMUM_MS * 5);
    expectCurrentExportStage("Packaging");
    expect(anchorClick).not.toHaveBeenCalled();

    await act(async () => {
      streamController?.enqueue(
        encoder.encode(
          `${JSON.stringify({
            type: "archive",
            archiveBase64: Buffer.from("deterministic zip").toString("base64"),
            filename: "tessera-portfolio.zip",
            mimeType: "application/zip",
          })}\n`,
        ),
      );
      streamController?.close();
      await Promise.resolve();
    });

    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("heading", { name: "Your portfolio is ready" }),
    ).toBeVisible();
  });

  it("interrupts paced success at a real failure and never downloads", async () => {
    vi.useFakeTimers();
    const encoder = new TextEncoder();
    const events = [
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
        type: "failure",
        stage: "verifying",
        message: "Controlled verification failure.",
      },
    ];
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
            ),
          );
          controller.close();
        },
      }),
    );
    const anchorClick = mockDownloadApis();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Download code" }));
    await flushAsyncWork();
    await advanceExportTime();
    expectCurrentExportStage("Generating");
    await advanceExportTime();

    expect(
      screen.getByRole("heading", { name: "Export couldn't finish" }),
    ).toBeVisible();
    expect(screen.getByText("Controlled verification failure.")).toBeVisible();
    expect(screen.getAllByText("Done")).toHaveLength(2);
    expect(anchorClick).not.toHaveBeenCalled();
  });

  it("retries once with a fresh snapshot and preserves the draft", async () => {
    vi.useFakeTimers();
    const anchorClick = mockDownloadApis();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ message: "Controlled failure" }, { status: 500 }),
      )
      .mockResolvedValueOnce(successfulExportResponse());
    vi.stubGlobal("fetch", fetchMock);
    render(<Home />);

    const nameInput = screen.getByLabelText("Full name");
    fireEvent.change(nameInput, { target: { value: "Retry Person" } });
    fireEvent.click(screen.getByRole("button", { name: "Download code" }));
    await flushAsyncWork();

    expect(
      screen.getByRole("heading", { name: "Export couldn't finish" }),
    ).toBeVisible();
    expect(anchorClick).not.toHaveBeenCalled();
    expect(nameInput).toHaveValue("Retry Person");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (let index = 0; index < 4; index += 1) {
      await advanceExportTime();
    }

    expect(
      screen.getByRole("heading", { name: "Your portfolio is ready" }),
    ).toBeVisible();
    expect(anchorClick).toHaveBeenCalledTimes(1);
    const retryRequest = fetchMock.mock.calls[1][1] as RequestInit;
    expect(
      JSON.parse(retryRequest.body as string).portfolio.profile.fullName,
    ).toBe("Retry Person");
    expect(nameInput).toHaveValue("Retry Person");
  });

  it("cancels pending presentation timers on unmount without downloading", async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const anchorClick = mockDownloadApis();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(successfulExportResponse()),
    );
    const view = render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Download code" }));
    await flushAsyncWork();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    view.unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    await advanceExportTime(EXPORT_STAGE_MINIMUM_MS * 5);
    expect(anchorClick).not.toHaveBeenCalled();
  });
});

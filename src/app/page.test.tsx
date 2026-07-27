import { StrictMode } from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ASSEMBLY_TIMING } from "@/components/onboarding/tessera-assembly-timing";
import HomePage from "./page";

const navigationState = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

function mockMotionPreference(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

afterEach(() => {
  cleanup();
  navigationState.pathname = "/";
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Tessera onboarding", () => {
  it("renders the required entry paths and workflow in order", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Turn your experience into a portfolio you own.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Build from my resume" }),
    ).toHaveAttribute("href", "/resume");
    expect(
      screen.getByRole("link", { name: "Explore a sample" }),
    ).toHaveAttribute("href", "/builder?source=sample");
    expect(screen.getByRole("link", { name: "Open builder" })).toHaveAttribute(
      "href",
      "/builder",
    );

    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(within(steps[0]).getByText("01")).toBeInTheDocument();
    expect(
      within(steps[0]).getByRole("heading", {
        name: "Import your experience",
      }),
    ).toBeInTheDocument();
    expect(within(steps[1]).getByText("02")).toBeInTheDocument();
    expect(
      within(steps[1]).getByRole("heading", {
        name: "Review and personalize",
      }),
    ).toBeInTheDocument();
    expect(within(steps[2]).getByText("03")).toBeInTheDocument();
    expect(
      within(steps[2]).getByRole("heading", {
        name: "Download what you own",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "No account required. Your exported portfolio remains yours.",
      ),
    ).toBeInTheDocument();
  });

  it("exposes one concise assembly description without interactive decoration", () => {
    render(<HomePage />);

    const assembly = screen.getByRole("img", {
      name: "Five experience pieces assembling into a miniature portfolio.",
    });
    expect(assembly).toBeInTheDocument();
    expect(within(assembly).queryAllByRole("link")).toHaveLength(0);
    expect(within(assembly).queryAllByRole("button")).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: "Replay assembly" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Structured from your experience. Editable by you. Exported as code.",
      ),
    ).toBeInTheDocument();
  });

  it("runs the automatic phase cycle and clears its timer on unmount", () => {
    vi.useFakeTimers();
    mockMotionPreference(false);
    const view = render(<HomePage />);

    expect(
      Array.from(document.querySelectorAll("[data-assembly-piece]"), (piece) =>
        piece.getAttribute("data-assembly-piece"),
      ),
    ).toEqual(["profile", "experience", "projects", "skills", "education"]);

    const figure = screen.getByRole("figure");
    expect(figure).toHaveAttribute("data-assembly-cycle", "0");
    expect(figure).toHaveAttribute("data-assembly-phase", "entering");

    act(() => vi.advanceTimersByTime(ASSEMBLY_TIMING.entering));
    expect(figure).toHaveAttribute("data-assembly-phase", "assembled");

    act(() => vi.advanceTimersByTime(ASSEMBLY_TIMING.assembled));
    expect(figure).toHaveAttribute("data-assembly-phase", "resetting");

    act(() => vi.advanceTimersByTime(ASSEMBLY_TIMING.resetting));
    expect(figure).toHaveAttribute("data-assembly-cycle", "1");
    expect(figure).toHaveAttribute("data-assembly-phase", "preparing");

    act(() => vi.advanceTimersByTime(ASSEMBLY_TIMING.preparing));
    expect(figure).toHaveAttribute("data-assembly-phase", "entering");
    expect(vi.getTimerCount()).toBe(1);

    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps one lifecycle timer under Strict Mode", () => {
    vi.useFakeTimers();
    mockMotionPreference(false);
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const view = render(
      <StrictMode>
        <HomePage />
      </StrictMode>,
    );

    expect(screen.getByRole("figure")).toHaveAttribute(
      "data-assembly-phase",
      "entering",
    );
    const enteringHandles = setTimeoutSpy.mock.calls.flatMap((call, index) =>
      call[1] === ASSEMBLY_TIMING.entering
        ? [setTimeoutSpy.mock.results[index]?.value]
        : [],
    );
    let clearedHandles = new Set(
      clearTimeoutSpy.mock.calls.map(([handle]) => handle),
    );
    expect(
      enteringHandles.filter((handle) => !clearedHandles.has(handle)),
    ).toHaveLength(1);

    view.unmount();
    clearedHandles = new Set(
      clearTimeoutSpy.mock.calls.map(([handle]) => handle),
    );
    expect(
      enteringHandles.filter((handle) => !clearedHandles.has(handle)),
    ).toHaveLength(0);
  });

  it("suspends while hidden and resumes with one fresh cycle", () => {
    vi.useFakeTimers();
    mockMotionPreference(false);
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const visibilityState = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("visible");
    render(<HomePage />);
    const figure = screen.getByRole("figure");

    const enteringHandle = setTimeoutSpy.mock.calls.flatMap((call, index) =>
      call[1] === ASSEMBLY_TIMING.entering
        ? [setTimeoutSpy.mock.results[index]?.value]
        : [],
    )[0];
    visibilityState.mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(clearTimeoutSpy).toHaveBeenCalledWith(enteringHandle);

    visibilityState.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(figure).toHaveAttribute("data-assembly-cycle", "1");
    expect(figure).toHaveAttribute("data-assembly-phase", "preparing");
    expect(
      setTimeoutSpy.mock.calls.filter(
        (call) => call[1] === ASSEMBLY_TIMING.preparing,
      ),
    ).toHaveLength(1);
  });

  it("stops off-route and restarts a cached onboarding instance on return", () => {
    vi.useFakeTimers();
    mockMotionPreference(false);
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const view = render(<HomePage />);
    const figure = screen.getByRole("figure");
    const enteringHandle = setTimeoutSpy.mock.calls.flatMap((call, index) =>
      call[1] === ASSEMBLY_TIMING.entering
        ? [setTimeoutSpy.mock.results[index]?.value]
        : [],
    )[0];

    navigationState.pathname = "/builder";
    view.rerender(<HomePage />);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(enteringHandle);

    navigationState.pathname = "/";
    view.rerender(<HomePage />);
    act(() => vi.advanceTimersByTime(0));

    expect(figure).toHaveAttribute("data-assembly-cycle", "1");
    expect(figure).toHaveAttribute("data-assembly-phase", "preparing");
  });

  it("renders the finished composition without scheduling a reduced-motion loop", () => {
    vi.useFakeTimers();
    mockMotionPreference(true);
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    render(<HomePage />);

    expect(screen.getByRole("figure")).toHaveAttribute(
      "data-assembly-phase",
      "assembled",
    );
    expect(
      setTimeoutSpy.mock.calls.filter((call) =>
        Object.values(ASSEMBLY_TIMING).some((duration) => duration === call[1]),
      ),
    ).toHaveLength(0);
  });
});

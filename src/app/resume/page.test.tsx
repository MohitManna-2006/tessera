import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ResumeBoundaryPage from "./page";

describe("Resume boundary", () => {
  it("honestly identifies resume import as a later stage", () => {
    render(<ResumeBoundaryPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Resume import is coming next.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no file is uploaded or processed here/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Tessera" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getAllByRole("link", { name: "Open builder" })[0],
    ).toHaveAttribute("href", "/builder");
  });
});

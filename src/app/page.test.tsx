import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("identifies Tessera as an early development portfolio platform", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Tessera" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("AI-Powered Developer Portfolio Platform"),
    ).toBeInTheDocument();
    expect(screen.getByText("Early development")).toBeInTheDocument();
  });
});

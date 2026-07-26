import { expect, test } from "@playwright/test";

test("shows the Tessera foundation page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Tessera" }),
  ).toBeVisible();
  await expect(
    page.getByText("AI-Powered Developer Portfolio Platform"),
  ).toBeVisible();
  await expect(page.getByText("Early development")).toBeVisible();
});

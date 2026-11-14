import { expect, test } from "@playwright/test";

test("home page loads with the main navigation and theme control", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /ショートカットを、/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "メインナビゲーション" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ダークモードに切替" }),
  ).toBeVisible();
});

test("theme can be toggled and is retained after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ダークモードに切替" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

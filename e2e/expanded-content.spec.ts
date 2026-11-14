import { expect, test } from "@playwright/test";

test("new Windows question supports guided keyboard practice", async ({ page }) => {
  await page.goto("/#/practice?question=standard-windows-text-select-all-text");
  await page.getByRole("button", { name: "セッション開始" }).click();
  await expect(page.getByRole("heading", { name: "文書内のすべての文字を選択する" })).toBeVisible();
  await page.getByRole("region", { name: "ショートカット回答欄" }).focus();
  await page.keyboard.press("Control+A");
  await expect(page.getByRole("status")).toContainText("正解");
});

test("new Chrome question supports quiz alternative and persists in analytics", async ({ page }) => {
  await page.goto("/#/practice?question=standard-chrome-windows-close-tab");
  await page.getByRole("combobox", { name: "モード" }).selectOption("quiz");
  await page.getByRole("combobox", { name: "採点方法", exact: true }).selectOption("multiple_choice");
  await page.getByRole("button", { name: "セッション開始" }).click();
  await expect(page.getByRole("heading", { name: "現在のタブを閉じる" })).toBeVisible();
  await page.getByRole("button", { name: "Ctrl + W", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("正解");
  await page.getByRole("link", { name: "分析", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "現在のタブを閉じる" }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "現在のタブを閉じる" }).first()).toBeVisible();
});

test("new keyboard quiz question becomes available for review", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-03-01T10:00:00Z") });
  await page.goto("/#/practice?question=standard-windows-text-select-all-text");
  await page.getByRole("combobox", { name: "モード" }).selectOption("quiz");
  await page.getByRole("button", { name: "セッション開始" }).click();
  await page.getByRole("region", { name: "ショートカット回答欄" }).focus();
  await page.keyboard.press("Control+A");
  await expect(page.getByRole("status")).toContainText("正解");
  await page.getByRole("link", { name: "分析", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "文書内のすべての文字を選択する" }).first()).toBeVisible();
  await page.clock.fastForward(86_400_001);
  await page.getByRole("link", { name: "復習一覧を見る" }).click();
  await expect(page.getByRole("heading", { name: "復習一覧" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "文書内のすべての文字を選択する" })).toBeVisible();
});

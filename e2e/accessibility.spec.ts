import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";

declare global {
  interface Window { axe: typeof axe }
}

async function checkAccessibility(page: Page) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
    return result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
  });
  expect(violations).toEqual([]);
}

test("keyboard focus, settings and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "メインコンテンツへ移動" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await expect(page.getByRole("heading", { name: /ショートカットを、/ })).toBeVisible();
  await page.getByRole("link", { name: "設定", exact: true }).click();
  await page.getByLabel("テーマ").selectOption("dark");
  await page.getByLabel("文字サイズ").selectOption("large");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-font-size", "large");
  const transition = await page.getByRole("link", { name: "練習", exact: true }).evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(transition).toBe("1e-05s");
  await checkAccessibility(page);
  await page.reload();
  await expect(page.getByLabel("文字サイズ")).toHaveValue("large");
});

test("mobile quiz, feedback and analytics remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/#/practice?question=windows-copy");
  await page.getByRole("combobox", { name: "モード" }).selectOption("quiz");
  await page.getByRole("combobox", { name: "採点方法", exact: true }).selectOption("multiple_choice");
  await page.getByRole("button", { name: "セッション開始" }).click();
  await expect(page.getByRole("heading", { name: "選択した項目をコピーする" })).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await checkAccessibility(page);
  await page.getByRole("button", { name: "Ctrl + C", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("正解");
  await checkAccessibility(page);
  await expect(page.getByRole("button", { name: "次へ" })).toBeFocused();
  await expect(page.getByText("獲得 10 XP", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByRole("heading", { name: "選択した項目をコピーする" })).toBeFocused();
  await page.goto("/#/analytics");
  await expect(page.getByRole("heading", { name: "学習分析" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await checkAccessibility(page);
  await page.goto("/#/review");
  await expect(page.getByRole("heading", { name: "復習一覧" })).toBeVisible();
  await checkAccessibility(page);
  await page.goto("/#/help");
  await expect(page.getByRole("heading", { name: "ヘルプ" })).toBeVisible();
  await checkAccessibility(page);
});

test("light and dark home meet automated accessibility checks", async ({ page }) => {
  await page.goto("/");
  await checkAccessibility(page);
  await page.getByRole("button", { name: "ダークモードに切替" }).click();
  await checkAccessibility(page);
  await page.goto("/#/questions");
  await expect(page.getByRole("heading", { name: "問題管理" })).toBeVisible();
  await checkAccessibility(page);
});

test("XP and streak persist without awarding retry or skip", async ({ page }) => {
  await page.goto("/#/practice?question=windows-copy");
  await page.getByRole("button", { name: "セッション開始" }).click();
  const area = page.getByRole("region", { name: "ショートカット回答欄" });
  await area.focus();
  await page.keyboard.press("Control+X");
  await expect(page.getByRole("alert")).toContainText("不正解");
  await area.focus();
  await page.keyboard.press("Control+C");
  await expect(page.getByRole("status")).toContainText("正解");
  await expect(page.getByText("獲得 0 XP / 連続初回正解 0 問")).toBeVisible();
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("region", { name: "ショートカット回答欄" }).focus();
  await page.keyboard.press("Control+C");
  await expect(page.getByText("獲得 10 XP / 連続初回正解 1 問")).toBeVisible();
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: "スキップ" }).click();
  await expect(page.getByText("獲得 10 XP / 連続初回正解 0 問")).toBeVisible();
  await page.goto("/");
  await expect(page.getByLabel("学習進捗")).toContainText("10 XP");
  await page.reload();
  await expect(page.getByLabel("学習進捗")).toContainText("10 XP");
});

import { expect, test } from "@playwright/test";

test("records quiz mastery, separates methods and retains analytics after reload", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-03-01T10:00:00Z") });
  await page.goto("/#/practice?category=windows&question=windows-copy");
  await page.getByRole("combobox", { name: "モード" }).selectOption("quiz");
  await page.getByRole("button", { name: "セッション開始" }).click();
  const area = page.getByRole("region", { name: "ショートカット回答欄" });
  await area.focus();
  await page.keyboard.press("Control+C");
  await expect(page.getByRole("status")).toContainText("正解");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByLabel("採点方法を切替").selectOption("multiple_choice");
  await page.getByRole("button", { name: "Ctrl + C", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("正解");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: "スキップ" }).click();
  await expect(page.getByRole("status")).toContainText("スキップ");
  await page.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("link", { name: "分析" }).click();
  await expect(page.getByRole("heading", { name: "学習分析" })).toBeVisible();
  await expect(page.getByText(/スキップ 1 件/)).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "キーボード" })).toContainText("1/1");
  await expect(page.getByRole("row").filter({ hasText: "4択" })).toContainText("対象なし");
  await expect(page.getByText("Windows: 1 / 30 問")).toBeVisible();
  await expect(page.getByRole("heading", { name: "問題別習熟度・弱点順" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "習熟度" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Windows: 1 / 30 問")).toBeVisible();
  await page.clock.fastForward(86_400_001);
  await page.getByRole("link", { name: "復習一覧を見る" }).click();
  await expect(page.getByRole("heading", { name: "復習一覧" })).toBeVisible();
  await expect(page.getByText("選択した項目をコピーする")).toBeVisible();
  await page.getByRole("link", { name: "この問題を練習" }).click();
  await expect(page.getByText(/復習対象: 選択した項目をコピーする/)).toBeVisible();
  await page.getByRole("button", { name: "セッション開始" }).click();
  await expect(page.getByRole("heading", { name: "選択した項目をコピーする" })).toBeVisible();
});

test("adaptive sessions choose a different question after an answer", async ({ page }) => {
  await page.goto("/#/practice");
  await page.getByLabel("出題順").selectOption("adaptive");
  await page.getByRole("button", { name: "セッション開始" }).click();
  const first = await page.locator("main h1").textContent();
  await page.getByRole("button", { name: "スキップ" }).click();
  await expect(page.getByRole("status")).toContainText("スキップ");
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.locator("main h1")).not.toHaveText(first ?? "");
});

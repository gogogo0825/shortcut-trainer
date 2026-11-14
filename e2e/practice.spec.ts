import { expect, test } from "@playwright/test";

test("guide retries until correct, records attempts and completes five questions", async ({ page }) => {
  await page.goto("/#/practice?category=windows&question=windows-copy");
  await expect(page.getByLabel("カテゴリ")).toHaveValue("windows");
  await page.getByRole("button", { name: "セッション開始" }).click();
  await expect(page.getByText("正解キー:", { exact: false })).toContainText("Ctrl + C");
  const area = page.getByRole("region", { name: "ショートカット回答欄" });
  await area.focus();
  await page.keyboard.press("Control+X");
  await expect(page.getByRole("alert")).toContainText("再挑戦");
  await area.focus();
  await page.keyboard.press("Control+C");
  await expect(page.getByRole("status")).toContainText("正解");
  for (let i = 1; i < 5; i++) {
    await page.getByRole("button", { name: "次へ" }).click();
    await page.getByRole("region", { name: "ショートカット回答欄" }).focus();
    await page.keyboard.press("Control+C");
    await expect(page.getByRole("status")).toContainText("正解");
  }
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByRole("heading", { name: "セッション結果" })).toBeVisible();
  await expect(page.getByText(/完了 5 問/)).toContainText("回答記録 6 件");
  const records = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("shortcut-trainer");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<{ correct: boolean; firstTry: boolean; gradingMethod: string; outcome: string; mode: string }[]>((resolve, reject) => {
      const request = db.transaction("attempts").objectStore("attempts").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
  expect(records).toHaveLength(6);
  expect(records.filter((a) => !a.firstTry && a.correct)).toHaveLength(1);
  expect(records.filter((a) => a.firstTry && !a.correct && a.outcome === "answered")).toHaveLength(1);
  expect(records.filter((a) => a.firstTry && a.correct && a.outcome === "answered")).toHaveLength(4);
  expect(records.every((a) => a.mode === "practice")).toBe(true);
  await expect(page.getByText("正解 5 件（再挑戦を含む）")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "不正解" })).toHaveCount(1);
  await expect(page.getByRole("listitem").filter({ hasText: ": 正解" })).toHaveCount(5);
  expect(records.every((a) => a.gradingMethod === "keyboard")).toBe(true);
});

test("quiz stores incorrect answers and skips separately and aggregates persisted records", async ({ page }) => {
  await page.goto("/#/practice?category=windows");
  await page.getByRole("combobox", { name: "モード" }).selectOption("quiz");
  await page.getByRole("combobox", { name: "採点方法", exact: true }).selectOption("self_assessment");
  await page.getByRole("button", { name: "セッション開始" }).click();

  await page.getByRole("button", { name: "できなかった" }).click();
  await expect(page.getByRole("status")).toContainText("不正解");
  await expect(page.getByRole("status")).not.toContainText("スキップ");
  await page.getByRole("button", { name: "次へ" }).click();

  await page.getByRole("button", { name: "スキップ" }).click();
  await expect(page.getByRole("status")).toContainText("スキップ");
  await expect(page.getByRole("status")).not.toContainText("不正解");
  await page.getByRole("button", { name: "次へ" }).click();

  for (const response of ["できた", "できなかった", "できた"]) {
    await page.getByRole("button", { name: response, exact: true }).click();
    await expect(page.getByRole("status")).toContainText(response === "できた" ? "正解" : "不正解");
    await page.getByRole("button", { name: "次へ" }).click();
  }
  await expect(page.getByRole("heading", { name: "セッション結果" })).toBeVisible();

  const { attempts, sessions } = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("shortcut-trainer");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = <T>(store: string) => new Promise<T[]>((resolve, reject) => {
      const request = db.transaction(store).objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return {
      attempts: await read<{ sessionId: string; mode: string; gradingMethod: string; outcome: string; correct: boolean; firstTry: boolean; interrupted: boolean }>("attempts"),
      sessions: await read<{ id: string; mode: string; completedCount: number; completedAt?: string }>("sessions"),
    };
  });
  expect(sessions).toHaveLength(1);
  expect(sessions[0]).toMatchObject({ mode: "quiz", completedCount: 5 });
  expect(sessions[0].completedAt).toBeTruthy();
  expect(attempts).toHaveLength(5);
  expect(attempts.every((a) => a.sessionId === sessions[0].id && a.mode === "quiz" && a.firstTry && a.gradingMethod === "self_assessment")).toBe(true);
  expect(attempts.filter((a) => a.outcome === "answered" && !a.correct && !a.interrupted)).toHaveLength(2);
  expect(attempts.filter((a) => a.outcome === "skipped" && !a.correct && a.interrupted)).toHaveLength(1);
  expect(attempts.filter((a) => a.outcome === "answered" && a.correct)).toHaveLength(2);
  await expect(page.getByText(`完了 ${sessions[0].completedCount} 問 / 回答記録 ${attempts.length} 件`)).toBeVisible();
  await expect(page.getByText(`正解 ${attempts.filter((a) => a.correct).length} 件（再挑戦を含む）`)).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "スキップ" })).toHaveCount(1);
  await expect(page.getByRole("listitem").filter({ hasText: "不正解" })).toHaveCount(2);
  await expect(page.getByRole("listitem").filter({ hasText: ": 正解" })).toHaveCount(2);
});

test("quiz grades first answer, keeps answer hidden and supports alternative methods", async ({ page }) => {
  await page.goto("/#/practice?category=windows&question=windows-copy");
  await page.getByRole("combobox", { name: "モード" }).selectOption("quiz");
  await page.getByRole("button", { name: "セッション開始" }).click();
  await expect(page.getByText("正解キー:", { exact: false })).toHaveCount(0);
  const area = page.getByRole("region", { name: "ショートカット回答欄" });
  await area.focus();
  await page.keyboard.press("Control+X");
  await expect(page.getByRole("status")).toContainText("不正解");
  await expect(page.getByRole("status")).toContainText("Ctrl + C");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByLabel("採点方法を切替").selectOption("multiple_choice");
  await expect(page.getByRole("button", { name: "Ctrl + C", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ctrl + C", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("4択");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByLabel("採点方法を切替").selectOption("self_assessment");
  await page.getByRole("button", { name: "できた", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("自己申告");
});

test("keyboard capture does not intercept Tab or keys while a select has focus", async ({ page }) => {
  await page.goto("/#/practice?category=windows");
  await page.getByRole("button", { name: "セッション開始" }).click();
  const select = page.getByLabel("採点方法を切替");
  await select.focus();
  await page.keyboard.press("Control+X");
  await expect(page.getByRole("status")).toHaveCount(0);
  const area = page.getByRole("region", { name: "ショートカット回答欄" });
  await area.focus();
  await page.keyboard.press("Tab");
  await expect(area).not.toBeFocused();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("a timed session ends and records the unanswered question", async ({ page }) => {
  await page.clock.install();
  await page.goto("/#/practice?category=windows");
  await page.getByLabel("セッション長").selectOption("1m");
  await page.getByRole("button", { name: "セッション開始" }).click();
  await expect(page.getByRole("region", { name: "ショートカット回答欄" })).toBeVisible();
  await page.clock.fastForward(60_500);
  await expect(page.getByRole("heading", { name: "セッション結果" })).toBeVisible();
  await expect(page.getByText(/時間切れ/)).toBeVisible();
  await expect(page.getByText(/完了 0 問/)).toBeVisible();
});

test("leaving via app navigation records the unanswered question", async ({ page }) => {
  await page.goto("/#/practice?category=windows");
  await page.getByRole("button", { name: "セッション開始" }).click();
  await expect(page.getByRole("region", { name: "ショートカット回答欄" })).toBeVisible();
  await page.getByRole("navigation", { name: "メインナビゲーション" }).getByRole("link", { name: "ホーム" }).click();
  await expect(page.getByRole("heading", { name: /ショートカットを、/ })).toBeVisible();
  await expect.poll(async () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("shortcut-trainer");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<string[]>((resolve, reject) => {
      const request = db.transaction("attempts").objectStore("attempts").getAll();
      request.onsuccess = () => resolve(request.result.map((record: { outcome: string }) => record.outcome));
      request.onerror = () => reject(request.error);
    });
  })).toContain("abandoned");
});

test("hidden time is excluded and alternative grading remains distinct in stored attempts", async ({ page }) => {
  await page.clock.install();
  await page.goto("/#/practice?category=windows");
  await page.getByRole("combobox", { name: "採点方法", exact: true }).selectOption("multiple_choice");
  await page.getByRole("button", { name: "セッション開始" }).click();
  await expect(page.getByRole("button", { name: "Ctrl + C", exact: true })).toBeVisible();
  await page.clock.fastForward(2_000);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(30_000);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(2_000);
  await page.getByRole("button", { name: "Ctrl + C", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("正解");
  const record = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("shortcut-trainer");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<{ elapsedMs: number; interrupted: boolean; gradingMethod: string }>((resolve, reject) => {
      const request = db.transaction("attempts").objectStore("attempts").getAll();
      request.onsuccess = () => resolve(request.result[0]);
      request.onerror = () => reject(request.error);
    });
  });
  expect(record.gradingMethod).toBe("multiple_choice");
  expect(record.interrupted).toBe(true);
  expect(record.elapsedMs).toBeGreaterThanOrEqual(3_900);
  expect(record.elapsedMs).toBeLessThan(6_000);
});

test("manual pause survives tab visibility changes and stops the session clock", async ({ page }) => {
  await page.clock.install();
  await page.goto("/#/practice?category=windows");
  await page.getByLabel("セッション長").selectOption("1m");
  await page.getByRole("button", { name: "セッション開始" }).click();
  await page.getByRole("button", { name: "一時停止" }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(65_000);
  await expect(page.getByText("一時停止中です。時間は進みません。")).toBeVisible();
  await page.getByRole("button", { name: "再開" }).click();
  await expect(page.getByRole("heading", { name: "選択した項目をコピーする" })).toBeVisible();
  await page.clock.fastForward(60_500);
  await expect(page.getByRole("heading", { name: "セッション結果" })).toBeVisible();
});

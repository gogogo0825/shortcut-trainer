import { expect, test } from "@playwright/test";

test("custom question can be edited, practiced, analysed and retired without losing history", async ({ page }) => {
  await page.goto("/#/questions");
  await page.getByRole("button", { name: "独自問題を追加" }).click();
  const editor = page.getByLabel("問題JSON");
  const question = JSON.parse(await editor.inputValue());
  question.id = "custom-e2e";
  question.action = '<img src=x onerror="window.pwned=1">';
  question.description = "独自問題の説明";
  await editor.fill(JSON.stringify(question));
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("保存");
  const item = page.getByRole("listitem").filter({ hasText: question.action });
  await expect(item).toBeVisible();
  await expect(item.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, "pwned"))).toBeUndefined();
  await item.getByRole("button", { name: "編集" }).click();
  const edited = JSON.parse(await editor.inputValue());
  edited.description = "編集後の説明";
  await editor.fill(JSON.stringify(edited));
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(item).toContainText("revision 2");
  await item.getByRole("link", { name: "この問題を練習" }).click();
  await page.getByRole("combobox", { name: "モード" }).selectOption("quiz");
  await page.getByRole("button", { name: "セッション開始" }).click();
  await page.getByRole("region", { name: "ショートカット回答欄" }).focus();
  await page.keyboard.press("Control+C");
  await expect(page.getByRole("status")).toContainText("正解");
  await page.goto("/#/analytics");
  await expect(page.getByRole("listitem").filter({ hasText: question.action }).first()).toBeVisible();
  await page.goto("/#/questions");
  const retired = page.getByRole("listitem").filter({ hasText: question.action });
  page.once("dialog", (dialog) => dialog.accept());
  await retired.getByRole("button", { name: "削除（無効化）" }).click();
  await expect(retired).toContainText("（無効）");
  await page.goto("/#/analytics");
  await expect(page.getByRole("listitem").filter({ hasText: question.action }).first()).toBeVisible();
});

test("previews JSON import, exports and restores a backup while preserving existing records", async ({ page }) => {
  await page.goto("/#/questions");
  await page.getByRole("button", { name: "独自問題を追加" }).click();
  const question = JSON.parse(await page.getByLabel("問題JSON").inputValue());
  question.id = "import-e2e";
  question.action = "インポートの問題";
  question.description = "説明";
  await page.getByRole("button", { name: "キャンセル" }).click();
  await page.getByLabel("問題ファイル").setInputFiles({ name: "questions.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify([question])) });
  await expect(page.getByText("プレビュー: 1件 / 既存ID 0件")).toBeVisible();
  await page.getByRole("button", { name: "プレビュー内容を取り込む" }).click();
  await expect(page.getByRole("status")).toContainText("追加 1");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "バックアップを保存" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  await page.getByLabel("復元ファイル").setInputFiles(path);
  await expect(page.getByText(/プレビュー: 回答 0 件.*独自問題 1 件/)).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "復元を実行" }).click();
  await expect(page.getByRole("status")).toContainText("追加 0 件、既存を保持");
  await expect(page.getByRole("listitem").filter({ hasText: question.action })).toBeVisible();
});

test("resolves a legacy ID collision without blocking practice, analytics or review", async ({ page }) => {
  await page.goto("/#/questions");
  await page.getByRole("button", { name: "独自問題を追加" }).click();
  const custom = JSON.parse(await page.getByLabel("問題JSON").inputValue());
  custom.id = "windows-copy";
  custom.action = "衝突した独自コピー";
  custom.description = "衝突移行テスト";
  await page.evaluate((question) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("shortcut-trainer");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(["customQuestions", "attempts", "mastery", "sessions"], "readwrite");
      tx.objectStore("customQuestions").add(question);
      tx.objectStore("attempts").add({
        id: "legacy-collision-attempt", questionId: question.id, questionRevision: 1,
        sessionId: "legacy-collision-session", timestamp: "2020-01-01T00:00:00.000Z",
        mode: "quiz", gradingMethod: "keyboard", correct: true, firstTry: true, interrupted: false,
      });
      tx.objectStore("mastery").add({
        questionId: question.id, score: 75, reviewDueAt: "2020-01-02T00:00:00.000Z",
        intervalDays: 1, easeFactor: 2.5, lastReviewedAt: "2020-01-01T00:00:00.000Z",
        lapses: 0, algorithmVersion: 1,
      });
      tx.objectStore("sessions").add({
        id: "legacy-collision-session", mode: "quiz", questionIds: [question.id],
        startedAt: "2020-01-01T00:00:00.000Z", completedCount: 1, xp: 10,
      });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), custom);

  await page.goto("/#/practice?question=windows-copy");
  await page.getByRole("combobox", { name: "モード" }).selectOption("quiz");
  await page.getByRole("button", { name: "セッション開始" }).click();
  await page.getByRole("region", { name: "ショートカット回答欄" }).focus();
  await page.keyboard.press("Control+C");
  await expect(page.getByRole("status")).toContainText("正解");

  await page.goto("/#/questions");
  await expect(page.getByText(/custom-windows-copy/)).toBeVisible();
  await expect(page.getByText("衝突した独自コピー")).toBeVisible();
  await page.goto("/#/analytics");
  await expect(page.getByRole("heading", { name: "学習分析" })).toBeVisible();
  await expect(page.getByText("衝突した独自コピー", { exact: false }).first()).toBeVisible();
  await page.goto("/#/review");
  await expect(page.getByRole("heading", { name: "復習一覧" })).toBeVisible();
  await expect(page.getByText("衝突した独自コピー")).toBeVisible();
});

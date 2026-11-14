import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";

test("production build works under a Pages-like subpath", async ({ page }) => {
  const root = resolve("dist");
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith("/trainer/")) { response.writeHead(404).end(); return; }
    const relative = url.pathname.slice("/trainer/".length) || "index.html";
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      const contentType = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "application/octet-stream";
      response.writeHead(200, { "Content-Type": contentType }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  try {
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/trainer/`;
    const failed: string[] = [];
    page.on("response", (response) => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
    page.on("pageerror", (error) => { failed.push(error.message); });
    await page.goto(origin);
    await expect(page.getByRole("heading", { name: /ショートカットを、/ })).toBeVisible();
    await expect(page.getByText(/β版（試験公開）/)).toBeVisible();
    await page.getByRole("link", { name: "練習", exact: true }).click();
    await page.getByRole("combobox", { name: "モード" }).selectOption("quiz");
    await page.getByRole("combobox", { name: "採点方法", exact: true }).selectOption("multiple_choice");
    await page.getByRole("button", { name: "セッション開始" }).click();
    await page.getByRole("button", { name: "Ctrl + C", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("正解");
    await page.getByRole("link", { name: "分析", exact: true }).click();
    await expect(page.getByRole("heading", { name: "学習分析" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "学習分析" })).toBeVisible();
    await expect(page.getByLabel("学習進捗")).toContainText("10 XP");
    await page.getByRole("link", { name: "復習一覧を見る" }).click();
    await expect(page.getByRole("heading", { name: "復習一覧" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "復習一覧" })).toBeVisible();
    await page.getByRole("link", { name: "実機検証", exact: true }).click();
    await expect(page.getByRole("heading", { name: "標準問題の実機検証" })).toBeVisible();
    await expect(page.getByText(/全 180 問/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "標準問題の実機検証" })).toBeVisible();
    await expect(page.getByText(/全 180 問/)).toBeVisible();
    await page.getByRole("link", { name: "問題管理", exact: true }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "バックアップを保存" }).click();
    const download = await downloadPromise;
    await page.getByLabel("復元ファイル").setInputFiles(await download.path());
    await expect(page.getByText(/プレビュー: 回答 1 件/)).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "復元を実行" }).click();
    await expect(page.getByRole("status")).toContainText("既存を保持");
    expect(failed).toEqual([]);
  } finally {
    await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  }
});

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Question } from "../../data/questionSchema";
import { sampleQuestions } from "../../data/sampleQuestions";
import { formatShortcut } from "../keyboard/engine";
import { makeBackup, parseBackup, restoreBackup, type Backup } from "./backup";
import { importCustomQuestions, loadQuestions, MAX_IMPORT_BYTES, parseQuestionFile, retireCustomQuestion, saveCustomQuestion } from "./questionStore";

export function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editor, setEditor] = useState<string | null>(null);
  const [originalId, setOriginalId] = useState<string>();
  const [preview, setPreview] = useState<Question[] | null>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [policy, setPolicy] = useState<"skip" | "replace">("skip");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const standards = new Set(sampleQuestions.map((q) => q.id));

  async function refresh() { setQuestions(await loadQuestions()); }
  useEffect(() => {
    let active = true;
    loadQuestions().then((items) => { if (active) setQuestions(items); }).catch((reason: unknown) => { if (active) setError(`問題を読み込めませんでした: ${String(reason)}`); });
    return () => { active = false; };
  }, []);

  async function act(task: () => Promise<void>) {
    setError(""); setMessage(""); setBusy(true);
    try { await task(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }

  function newQuestion() {
    const template: Question = {
      id: `custom-${crypto.randomUUID()}`, revision: 1, category: "windows", difficulty: "beginner",
      action: "", description: "", platform: ["Windows"], layout: "any",
      steps: [{ key: "C", code: "KeyC", modifiers: ["Ctrl"] }],
      gradingModes: ["keyboard", "multiple_choice", "self_assessment"], source: { publisher: "未確認" },
      verification: "pending", tags: [], enabled: true,
    };
    setOriginalId(undefined);
    setEditor(JSON.stringify(template, null, 2));
  }

  async function readFile(file: File, kind: "questions" | "backup") {
    setPreview(null); setBackup(null);
    if (file.size > MAX_IMPORT_BYTES) throw new Error("ファイルは2 MiB以下にしてください。");
    const text = await file.text();
    if (kind === "backup") setBackup(parseBackup(text));
    else {
      const extension = file.name.toLowerCase();
      if (!extension.endsWith(".json") && !extension.endsWith(".csv")) throw new Error("JSONまたはCSVを選択してください。");
      setPreview(parseQuestionFile(text, extension.endsWith(".csv") ? "csv" : "json"));
    }
  }

  return <div className="space-y-6">
    <header><h1 className="text-3xl font-bold">問題管理</h1><p className="text-muted">標準問題は読み取り専用です。独自問題を無効化しても学習履歴は保持されます。</p></header>
    {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
    {message && <p role="status">{message}</p>}
    <section className="surface-card space-y-3 p-5">
      <h2 className="text-xl font-bold">独自問題の作成・編集</h2>
      <button className="button-primary" disabled={busy} onClick={newQuestion} type="button">独自問題を追加</button>
      {editor !== null && <div className="space-y-3">
        <p>問題データをJSON形式で編集してください。IDは編集後も維持し、変更時はrevisionを増やします。</p>
        <label className="block">問題JSON<textarea aria-label="問題JSON" className="mt-1 h-80 w-full rounded border border-line bg-panel p-2 font-mono text-sm" value={editor} onChange={(e) => setEditor(e.target.value)} /></label>
        <button className="button-primary" disabled={busy} type="button" onClick={() => void act(async () => { const raw: unknown = JSON.parse(editor); await saveCustomQuestion(raw, originalId); await refresh(); setEditor(null); setMessage("問題を保存しました。"); })}>保存</button>{" "}
        <button className="button-secondary" type="button" onClick={() => setEditor(null)}>キャンセル</button>
      </div>}
    </section>
    <section className="surface-card space-y-3 p-5">
      <h2 className="text-xl font-bold">問題一覧</h2>
      <ul className="space-y-3">{questions.map((q) => <li className="rounded border border-line p-3" key={q.id}>
        <p className="font-semibold">{q.action} {!q.enabled && "（無効）"}</p>
        <p className="text-sm">{q.id} / revision {q.revision} / {q.category} / {q.layout} / {formatShortcut(q.steps)}</p>
        <p className="text-sm">出典: {q.source.publisher} {q.source.url && <a className="underline" href={q.source.url} target="_blank" rel="noreferrer">公式資料</a>} / 対象: {q.platform.join(", ")} {q.appVersions?.join(", ")} / {q.verification === "device_checked" ? "実機確認済み" : q.verification === "docs_checked" ? "出典確認済み・実機未確認" : "未確認"}</p>
        {!standards.has(q.id) && <div className="mt-2 flex gap-2"><button className="button-secondary" type="button" onClick={() => { setOriginalId(q.id); setEditor(JSON.stringify({ ...q, revision: q.revision + 1 }, null, 2)); }}>編集</button>{q.enabled && <button className="button-secondary" disabled={busy} type="button" onClick={() => { if (window.confirm("この独自問題を無効化しますか？履歴は保持されます。")) void act(async () => { await retireCustomQuestion(q.id); await refresh(); setMessage("問題を無効化しました。"); }); }}>削除（無効化）</button>}</div>}
        {q.enabled && <Link className="mt-2 inline-flex underline" to={`/practice?question=${encodeURIComponent(q.id)}`}>この問題を練習</Link>}
      </li>)}</ul>
    </section>
    <section className="surface-card space-y-3 p-5">
      <h2 className="text-xl font-bold">CSV・JSON問題インポート</h2>
      <p>JSONは問題配列、CSVはスキーマの各フィールドを列とし、steps等の配列・オブジェクトはJSON文字列として引用してください。上限2 MiB。</p>
      <label className="block">問題ファイル<input type="file" accept=".json,.csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) void act(() => readFile(file, "questions")); e.currentTarget.value = ""; }} /></label>
      {preview && <div className="space-y-2"><p>プレビュー: {preview.length}件 / 既存ID {preview.filter((q) => questions.some((old) => old.id === q.id)).length}件</p><ul>{preview.map((q) => <li key={q.id}>{q.id}: {q.action} / revision {q.revision}</li>)}</ul><label>衝突時 <select value={policy} onChange={(e) => setPolicy(e.target.value === "replace" ? "replace" : "skip")}><option value="skip">既存を保持</option><option value="replace">新しいrevisionで更新</option></select></label><p>標準IDや履歴に残る未登録IDは取り込めません。</p><button className="button-primary" disabled={busy} onClick={() => void act(async () => { const result = await importCustomQuestions(preview, policy); await refresh(); setPreview(null); setMessage(`追加 ${result.added}、更新 ${result.updated}、保持 ${result.skipped} 件`); })} type="button">プレビュー内容を取り込む</button></div>}
    </section>
    <section className="surface-card space-y-3 p-5">
      <h2 className="text-xl font-bold">JSONバックアップ・復元</h2>
      <p>復元は既存データを保持して追加します。同じIDで内容が異なる履歴はエラーとなり、全件ロールバックします。</p>
      <button className="button-secondary" disabled={busy} type="button" onClick={() => void act(async () => {
        const content = JSON.stringify(await makeBackup(), null, 2);
        const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = "shortcut-trainer-backup.json"; link.click(); URL.revokeObjectURL(url);
        setMessage("バックアップを出力しました。");
      })}>バックアップを保存</button>
      <label className="block">復元ファイル<input type="file" accept=".json" onChange={(e) => { const file = e.target.files?.[0]; if (file) void act(() => readFile(file, "backup")); e.currentTarget.value = ""; }} /></label>
      {backup && <div className="space-y-2"><p>プレビュー: 回答 {backup.attempts.length} 件、セッション {backup.sessions.length} 件、習熟度 {backup.mastery.length} 件、独自問題 {backup.customQuestions.length} 件、設定 {backup.settings.length} 件、実機検証 {backup.deviceVerifications?.length ?? 0} 件</p><p>衝突処理: 既存項目を保持（履歴・独自問題の異内容衝突は中止）。標準IDと重なる独自問題 {backup.customQuestions.filter((question) => standards.has(question.id)).length} 件は、関連履歴とともに独自IDへ再割当します。</p><button className="button-primary" disabled={busy} type="button" onClick={() => { if (window.confirm("プレビューしたバックアップを復元しますか？")) void act(async () => { const result = await restoreBackup(backup); await refresh(); setBackup(null); setMessage(`復元: 追加 ${result.added} 件、既存を保持 ${result.skipped} 件${result.remapped ? `、衝突ID再割当 ${result.remapped} 件` : ""}`); }); }}>復元を実行</button></div>}
    </section>
  </div>;
}

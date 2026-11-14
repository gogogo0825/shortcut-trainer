import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { sampleQuestions } from "../../data/sampleQuestions";
import { captureResultSchema, deviceResultSchema, type DeviceVerification } from "../../data/deviceVerification";
import { categorySchema, difficultySchema, type Question } from "../../data/questionSchema";
import { KeyboardCapture } from "../keyboard/KeyboardCapture";
import { formatShortcut } from "../keyboard/engine";
import { countResults, latestVerifications, listVerifications, resultLabels, saveVerification } from "./verificationStore";

const categories = { windows: "Windows", excel: "Excel", word: "Word", powerpoint: "PowerPoint", vscode: "VS Code", browser: "ブラウザー" } as const;
const difficulties = { beginner: "初級", intermediate: "中級", advanced: "上級" } as const;
const captureLabels = { not_tested: "未実施", detected: "一致を検出", not_detected: "イベントを検出できない", mismatch: "入力不一致" } as const;
const inputClass = "block w-full rounded border border-line bg-panel p-2 text-ink";

function localDateTime(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function VerificationForm({ question, records, onSaved }: { question: Question; records: DeviceVerification[]; onSaved: () => Promise<void> }) {
  const [result, setResult] = useState("unverified");
  const [capture, setCapture] = useState("not_tested");
  const [captureMessage, setCaptureMessage] = useState("未実施");
  const [confirmed, setConfirmed] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState(() => localDateTime(new Date()));
  const [os, setOs] = useState("");
  const [browser, setBrowser] = useState("");
  const [application, setApplication] = useState("");
  const [keyboardLayout, setKeyboardLayout] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const history = records.filter((record) => record.questionId === question.id).slice()
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage(""); setBusy(true);
    let saved = false;
    try {
      const date = new Date(verifiedAt);
      if (Number.isNaN(date.getTime())) throw new Error("検証日時を入力してください。");
      await saveVerification({
        id: crypto.randomUUID(), questionId: question.id, questionRevision: question.revision,
        result: deviceResultSchema.parse(result), confirmedInTarget: result === "success" && confirmed,
        verifiedAt: date.toISOString(), recordedAt: new Date().toISOString(),
        os, browser, application, keyboardLayout, notes, capture: captureResultSchema.parse(capture),
      });
      saved = true;
      setConfirmed(false);
      await onSaved();
      setMessage("実機検証記録を保存しました。学習履歴は変更していません。");
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : String(reason);
      setError(saved ? `記録は保存されましたが画面を更新できませんでした。再読み込みして確認してください: ${detail}` : `保存できませんでした: ${detail}`);
    } finally { setBusy(false); }
  }

  return <section className="surface-card space-y-4 p-5" aria-labelledby="verification-form-heading">
    <h2 className="text-xl font-bold" id="verification-form-heading">検証する: {question.action}（{question.id} / revision {question.revision}）</h2>
    <p>対象アプリの実際の操作を別途確認してください。下の入力検出は、このブラウザーにキーが届いたかの確認であり、対象アプリでの成功を証明しません。予約キーはブラウザーやOSで動作する場合があります。</p>
    <KeyboardCapture question={question} showAnswers disabled={busy} onAnswer={(correct, timeout) => {
      setCapture(correct ? "detected" : "mismatch");
      setCaptureMessage(correct ? "ブラウザーで一致を検出しました。対象アプリの動作は未判定です。" : timeout ? "入力が時間切れになりました。" : "ブラウザーで不一致を検出しました。");
    }} />
    <p role="status">入力検出: {captureMessage}</p>
    <form className="space-y-3" onSubmit={(event) => void submit(event)}>
      <label className="block">ブラウザーでの入力検出
        <select className={inputClass} value={capture} onChange={(event) => setCapture(event.target.value)}>
          {Object.entries(captureLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="block">対象アプリでの実機検証結果
        <select className={inputClass} value={result} onChange={(event) => { setResult(event.target.value); setConfirmed(false); }}>
          {Object.entries(resultLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {result === "success" && <label className="flex items-start gap-2"><input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />対象アプリを実機で操作し、期待した動作を確認しました。</label>}
      <label className="block">検証日時<input className={inputClass} type="datetime-local" required value={verifiedAt} onChange={(event) => setVerifiedAt(event.target.value)} /></label>
      <label className="block">OS・バージョン<input className={inputClass} required maxLength={200} placeholder="例: Windows 11 24H2" value={os} onChange={(event) => setOs(event.target.value)} /></label>
      <label className="block">ブラウザー・バージョン<input className={inputClass} required maxLength={200} placeholder="例: Edge 130" value={browser} onChange={(event) => setBrowser(event.target.value)} /></label>
      <label className="block">対象アプリ・バージョン<input className={inputClass} required maxLength={200} placeholder="例: Excel for Microsoft 365" value={application} onChange={(event) => setApplication(event.target.value)} /></label>
      <label className="block">キーボード配列<input className={inputClass} required maxLength={200} placeholder="例: 日本語JIS" value={keyboardLayout} onChange={(event) => setKeyboardLayout(event.target.value)} /></label>
      <label className="block">備考<textarea className={inputClass} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <button className="button-primary" disabled={busy} type="submit">検証結果を登録</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <h3 className="font-semibold">この問題の検証履歴</h3>
    {history.length === 0 ? <p>記録はありません。</p> : <ul className="space-y-2">{history.map((record) => <li key={record.id} className="rounded border border-line p-2">
      revision {record.questionRevision}{record.questionRevision !== question.revision ? "（現行ではない）" : ""} / {resultLabels[record.result]} / 検証日時 {new Date(record.verifiedAt).toLocaleString("ja-JP")} / 入力検出: {captureLabels[record.capture]}
      <p>{record.os} / {record.browser} / {record.application} / {record.keyboardLayout}</p>{record.notes && <p>備考: {record.notes}</p>}
    </li>)}</ul>}
  </section>;
}

export function DeviceVerificationPage() {
  const [records, setRecords] = useState<DeviceVerification[] | null>(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const formArea = useRef<HTMLDivElement>(null);
  const latest = useMemo(() => latestVerifications(sampleQuestions, records ?? []), [records]);
  const counts = countResults(sampleQuestions, latest);
  const selected = sampleQuestions.find((question) => question.id === selectedId);
  const visible = sampleQuestions.filter((question) => (category === "all" || question.category === category) &&
    (difficulty === "all" || question.difficulty === difficulty) &&
    (status === "all" || (latest.get(question.id)?.result ?? "unverified") === status));

  async function refresh() { setRecords(await listVerifications()); }
  useEffect(() => {
    let active = true;
    listVerifications().then((items) => { if (active) setRecords(items); }).catch((reason: unknown) => {
      if (active) setError(`実機検証記録を読み込めませんでした: ${reason instanceof Error ? reason.message : String(reason)}`);
    });
    return () => { active = false; };
  }, []);

  function selectQuestion(id: string) {
    setSelectedId(id);
    requestAnimationFrame(() => { formArea.current?.scrollIntoView({ block: "start" }); formArea.current?.focus(); });
  }

  function nextUnverified() {
    const start = sampleQuestions.findIndex((question) => question.id === selectedId);
    const ordered = [...sampleQuestions.slice(start + 1), ...sampleQuestions.slice(0, start + 1)];
    const next = ordered.find((question) => (latest.get(question.id)?.result ?? "unverified") === "unverified");
    if (next) { setCategory("all"); setDifficulty("all"); setStatus("all"); selectQuestion(next.id); }
  }

  function exportResults() {
    if (!records) return;
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "shortcut-trainer-device-verifications.json"; link.click();
    URL.revokeObjectURL(url);
  }

  if (error) return <p role="alert">{error}</p>;
  if (!records) return <p role="status">実機検証記録を読み込み中です。</p>;
  return <div className="space-y-6">
    <header><h1 className="text-3xl font-bold">標準問題の実機検証</h1><p>この端末に保存する自己申告です。標準問題の出典状態・学習履歴は変更しません。</p></header>
    <section className="surface-card space-y-3 p-5">
      <h2 className="text-xl font-bold">検証進捗</h2>
      <p>全 {sampleQuestions.length} 問 / 確認済み（正常動作）{counts.success} 問</p>
      <p>{Object.entries(resultLabels).map(([key, label]) => `${label} ${counts[key as keyof typeof counts]} 件`).join(" / ")}</p>
      <p>現行revisionの最新登録を集計します。旧revisionの記録は履歴に残ります。</p>
      <ul>{categorySchema.options.map((value) => {
        const questions = sampleQuestions.filter((question) => question.category === value);
        const summary = countResults(questions, latest);
        return <li key={value}>{categories[value]}: 正常 {summary.success} / {questions.length} 問（不一致 {summary.mismatch}、検証不可 {summary.unavailable}、未確認 {summary.unverified}）</li>;
      })}</ul>
      <button className="button-secondary" type="button" disabled={!counts.unverified} onClick={nextUnverified}>次の未確認問題へ</button>{" "}
      <button className="button-secondary" type="button" onClick={exportResults}>検証結果をJSON出力</button>
    </section>
    <div ref={formArea} tabIndex={-1}>{selected && <VerificationForm key={selected.id} question={selected} records={records} onSaved={refresh} />}</div>
    <section className="surface-card space-y-3 p-5">
      <h2 className="text-xl font-bold">標準問題一覧</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>カテゴリ<select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">すべて</option>{categorySchema.options.map((value) => <option key={value} value={value}>{categories[value]}</option>)}</select></label>
        <label>難易度<select className={inputClass} value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">すべて</option>{difficultySchema.options.map((value) => <option key={value} value={value}>{difficulties[value]}</option>)}</select></label>
        <label>実機検証状況<select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">すべて</option>{Object.entries(resultLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <p>表示 {visible.length} 問</p>
      <ul className="space-y-3">{visible.map((question) => <li key={question.id} className="rounded border border-line p-3">
        <h3 className="font-semibold">{question.action}</h3>
        <p>{question.id} / revision {question.revision} / {categories[question.category]} / {difficulties[question.difficulty]}</p>
        <p>{question.description}</p>
        <p>キー: {formatShortcut(question.steps)}</p>
        <p>出典: {question.verification === "pending" ? "未確認" : "出典確認済み"} {question.source.publisher} {question.source.url && <a className="underline" href={question.source.url} target="_blank" rel="noreferrer">公式資料</a>} / 実機: {resultLabels[latest.get(question.id)?.result ?? "unverified"]}</p>
        <p>対象: {question.platform.join(" / ")} / {question.appVersions?.join(" / ") || "バージョン未記録"}</p>
        <p>配列: {question.layout}。JIS実機は記録した環境のみ確認。OS・ブラウザーの予約キーは入力を捕捉できない場合があります。</p>
        <button className="button-secondary mt-2" type="button" onClick={() => selectQuestion(question.id)}>検証する</button>
      </li>)}</ul>
    </section>
  </div>;
}

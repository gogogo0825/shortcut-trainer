import { Link } from "react-router-dom";
import { sampleQuestions } from "../../data/sampleQuestions";

const categories = [
  ["Windows", "OSの基本操作をすばやく", "windows"],
  ["Excel", "表計算の作業を効率よく", "excel"],
  ["Word", "文書編集をスムーズに", "word"],
  ["PowerPoint", "スライド作成をもっと快適に", "powerpoint"],
  ["VS Code", "コーディングの操作を短縮", "vscode"],
  ["ブラウザー", "Web閲覧を軽快に", "browser"],
] as const;

export function HomePage() {
  return (
    <div className="space-y-10">
      <section className="grid gap-8 rounded-3xl bg-gradient-to-br from-brand-700 to-indigo-800 px-6 py-10 text-white sm:px-10 sm:py-14 lg:grid-cols-[1.4fr_0.6fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-100">
            Shortcut Trainer
          </p>
          <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">
            ショートカットを、
            <br className="hidden sm:block" />
            使えるスキルに。
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-blue-100">
            毎日の操作を少しずつ練習して、キーボードでの作業を身につけましょう。
            学習データは端末内に保存されます。
          </p>
          <Link className="mt-8 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-brand-700 transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" to="/practice">
            練習を始める
          </Link>
        </div>
        <div aria-hidden="true" className="hidden justify-center lg:flex">
          <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/20 bg-white/10 p-5 shadow-2xl">
            {["Ctrl", "Shift", "K", "Alt", "Enter", "⌘"].map((key) => (
              <span
                className="flex h-14 min-w-14 items-center justify-center rounded-lg border border-white/30 bg-white/15 px-3 font-mono text-lg font-bold shadow-sm"
                key={key}
              >
                {key}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="categories-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold" id="categories-heading">
              カテゴリから練習
            </h2>
            <p className="mt-1 text-muted">使うアプリに合わせて選べます。</p>
          </div>
          <p className="text-sm text-muted">
            サンプル問題 {sampleQuestions.length} 問
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(([name, description, category], index) => (
            <Link
              className="surface-card group p-5 transition hover:-translate-y-0.5 hover:border-brand-600/40 hover:shadow-md"
              key={name}
              to={`/practice?category=${category}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{name}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {description}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-bold text-brand-700 dark:bg-slate-800 dark:text-brand-100"
                >
                  {index + 1}
                </span>
              </div>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 group-hover:gap-2 dark:text-brand-100">
                問題を見る <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section
        aria-label="学習データの状態"
        className="surface-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="font-semibold">学習を始める準備ができました</h2>
          <p className="mt-1 text-sm text-muted">
            問題の出典と実機検証状況は、確認できるまで未確認として扱います。
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          検証状況は問題ごとに表示
        </span>
      </section>
    </div>
  );
}

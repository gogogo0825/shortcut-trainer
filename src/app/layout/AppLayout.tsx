import { NavLink } from "react-router-dom";
import { ThemeToggle } from "../theme/ThemeToggle";
import { Progress } from "../../features/gamification/Progress";

const navigation = [
  { to: "/", label: "ホーム", end: true },
  { to: "/practice", label: "練習" },
  { to: "/analytics", label: "分析" },
  { to: "/questions", label: "問題管理" },
  { to: "/device-verification", label: "実機検証" },
  { to: "/settings", label: "設定" },
  { to: "/help", label: "ヘルプ" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault();
        document.getElementById("main-content")?.focus();
      }}>
        メインコンテンツへ移動
      </a>
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <NavLink
            aria-label="Shortcut Trainer ホーム"
            className="text-lg font-extrabold tracking-tight text-brand-700 dark:text-brand-100"
            to="/"
          >
            Shortcut Trainer
          </NavLink>
          <div className="flex flex-wrap items-center gap-3">
            <nav aria-label="メインナビゲーション" className="flex flex-wrap gap-1">
              {navigation.map(({ to, label, end }) => (
                <NavLink
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-100"
                        : "text-muted hover:bg-canvas hover:text-ink"
                    }`
                  }
                  end={end}
                  key={to}
                  to={to}
                >
                  {label}
                </NavLink>
              ))}
            </nav>
            <ThemeToggle />
          </div>
          <Progress />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6" id="main-content" tabIndex={-1}>
        <p className="mb-6 rounded-xl border border-line bg-panel p-4">
          β版（試験公開）: ショートカットの実機検証は完了していません。動作は環境や設定により異なる場合があります。
        </p>
        {children}
      </main>
      <footer className="border-t border-line px-4 py-5 text-center text-sm text-muted">
        学習データはこの端末内に保存されます。
      </footer>
    </div>
  );
}

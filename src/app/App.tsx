import { lazy, Suspense, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { initializeDatabase } from "../db/initializeDatabase";
import { HomePage } from "../features/home/HomePage";
import { AppLayout } from "./layout/AppLayout";

const PracticePage = lazy(() => import("../features/sessions/PracticePage").then((module) => ({ default: module.PracticePage })));
const ReviewPage = lazy(() => import("../features/review/ReviewPage").then((module) => ({ default: module.ReviewPage })));
const QuestionsPage = lazy(() => import("../features/questions/QuestionsPage").then((module) => ({ default: module.QuestionsPage })));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const HelpPage = lazy(() => import("../features/help/HelpPage").then((module) => ({ default: module.HelpPage })));
const AnalyticsPage = lazy(() => import("../features/analytics/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage })));
const DeviceVerificationPage = lazy(() => import("../features/deviceVerification/DeviceVerificationPage").then((module) => ({ default: module.DeviceVerificationPage })));

export function App() {
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<"normal" | "large">(() => localStorage.getItem("shortcut-trainer.font-size") === "large" ? "large" : "normal");

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
    localStorage.setItem("shortcut-trainer.font-size", fontSize);
  }, [fontSize]);

  useEffect(() => {
    let active = true;

    initializeDatabase().catch((error: unknown) => {
      if (active) {
        setDatabaseError(
          error instanceof Error
            ? `ローカルデータベースを初期化できませんでした: ${error.message}`
            : "ローカルデータベースを初期化できませんでした。",
        );
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppLayout>
      {databaseError && (
        <p className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100" role="alert">
          {databaseError}
        </p>
      )}
      <Suspense fallback={<p role="status">画面を読み込み中です。</p>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/analytics" element={<Suspense fallback={<p role="status">分析画面を読み込み中です。</p>}><AnalyticsPage /></Suspense>} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/questions" element={<QuestionsPage />} />
        <Route path="/device-verification" element={<DeviceVerificationPage />} />
        <Route path="/settings" element={<SettingsPage fontSize={fontSize} onFontSize={setFontSize} />} />
        <Route path="/help" element={<HelpPage />} />
        <Route
          path="*"
          element={
            <section className="surface-card mx-auto max-w-2xl p-8 text-center">
              <h1 className="text-2xl font-bold">このページは準備中です</h1>
              <p className="mt-3 text-muted">
                この機能は今後のフェーズで追加されます。
              </p>
              <Link className="button-primary mt-6 inline-flex" to="/">
                ホームへ戻る
              </Link>
            </section>
          }
        />
        <Route path="/home" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </AppLayout>
  );
}

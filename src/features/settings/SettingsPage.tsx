import { useTheme } from "../../app/theme/useTheme";

export function SettingsPage({ fontSize, onFontSize }: { fontSize: "normal" | "large"; onFontSize: (size: "normal" | "large") => void }) {
  const { preference, setPreference } = useTheme();
  return <section className="surface-card mx-auto max-w-2xl space-y-5 p-6">
    <h1 className="text-2xl font-bold">設定</h1>
    <label className="block">テーマ
      <select className="mt-1 block w-full rounded-lg border border-line bg-panel p-2 text-ink" value={preference} onChange={(event) => {
        const value = event.target.value;
        if (value === "system" || value === "light" || value === "dark") setPreference(value);
      }}><option value="system">端末の設定に従う</option><option value="light">ライト</option><option value="dark">ダーク</option></select>
    </label>
    <label className="block">文字サイズ
      <select className="mt-1 block w-full rounded-lg border border-line bg-panel p-2 text-ink" value={fontSize} onChange={(event) => onFontSize(event.target.value === "large" ? "large" : "normal")}>
        <option value="normal">標準</option><option value="large">大きい</option>
      </select>
    </label>
    <p className="text-sm text-muted">設定はこのブラウザーに保存されます。端末間の同期やバックアップには含まれません。</p>
  </section>;
}

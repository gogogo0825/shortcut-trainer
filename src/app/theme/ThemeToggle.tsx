import { useTheme } from "./useTheme";

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const nextPreference = preference === "dark" ? "light" : "dark";
  const label = preference === "dark" ? "ライトモードに切替" : "ダークモードに切替";

  return (
    <button
      className="button-secondary whitespace-nowrap"
      onClick={() => setPreference(nextPreference)}
      type="button"
    >
      {label}
    </button>
  );
}

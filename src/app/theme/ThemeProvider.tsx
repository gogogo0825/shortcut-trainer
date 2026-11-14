import { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeContext, type ThemePreference } from "./themeContext";

const STORAGE_KEY = "shortcut-trainer.theme";

function readPreference(): ThemePreference {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(readPreference);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    window.localStorage.setItem(STORAGE_KEY, nextPreference);
    setPreferenceState(nextPreference);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      const isDark =
        preference === "dark" ||
        (preference === "system" && mediaQuery.matches);
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
      document.documentElement.classList.toggle("dark", isDark);
    };

    updateTheme();
    mediaQuery.addEventListener("change", updateTheme);
    return () => mediaQuery.removeEventListener("change", updateTheme);
  }, [preference]);

  const value = useMemo(
    () => ({ preference, setPreference }),
    [preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

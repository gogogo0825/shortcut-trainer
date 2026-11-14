import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: "standard-questions", test: /[\\/]src[\\/]data[\\/]standards[\\/]/ }],
        },
      },
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
    clearMocks: true,
    restoreMocks: true,
  },
});

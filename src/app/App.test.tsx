import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { ThemeProvider } from "./theme/ThemeProvider";

describe("app routes", () => {
  it("renders the home page and navigation", async () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(
      screen.getByRole("heading", { name: /ショートカットを、/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "メインナビゲーション" }),
    ).toBeInTheDocument();
    expect(await screen.findByLabelText("学習進捗")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "練習を始める" })).toHaveAttribute(
      "href",
      "/practice",
    );
  });

  it("shows a clear placeholder for an unimplemented route", async () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/unknown"]}>
          <App />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "このページは準備中です" }),
    ).toBeInTheDocument();
    expect(await screen.findByLabelText("学習進捗")).toBeInTheDocument();
  });
});

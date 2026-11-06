// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";

afterEach(cleanup);

// Read from disk, because Vitest replaces imported CSS with an empty string.
const css = readFileSync(resolve(import.meta.dirname, "../index.css"), "utf8");
const html = readFileSync(resolve(import.meta.dirname, "../../index.html"), "utf8");

// EmptyState and ErrorState keep their approved look on purpose. If one of these tests fails, the
// fix is to restore the value, unless someone has explicitly asked for these two to change.
const reason = "EmptyState and ErrorState are protected designs: see PROJECT_PLAN.md §13.7";

const frozen: Record<string, string> = {
  "--font-sans":
    '"Geist", "Noto Sans Armenian", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  "--font-display": '"Instrument Serif", "Noto Serif Armenian", ui-serif, Georgia, serif',
  "--font-weight-medium": "500",
  "--text-title": "1.5rem",
  "--text-title--line-height": "1.1",
  "--text-title--letter-spacing": "-0.01em",
  "--text-ui": "0.875rem",
  "--text-ui--line-height": "1.125rem",
  "--color-ink": "#17140f",
  "--color-ink-secondary": "#4a453d",
  "--color-ink-muted": "#6f6a60",
  "--color-on-dark": "#fbfaf7",
  "--color-surface-raised": "#ffffff",
  "--color-line": "#e4dfd6",
  "--color-line-strong": "#ddd8ce",
  "--color-fill-slot": "#f1eee8",
  "--color-fill-primary-hover": "#2e2922",
  "--color-error": "#9e2b25",
  "--focus-ring": "#9e2b25",
  "--radius-card": "1rem",
  "--radius-control": "0.625rem",
  "--radius-pill": "999px",
  "--spacing": "0.25rem",
  "--default-transition-timing-function": "ease",
  "--transition-duration-button": "180ms",
  "--animate-spin": "spin 1s linear infinite",
};

function frozenBlock(): string {
  const block = /@utility state-card \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  return block.replace(/\s+/g, " ");
}

describe("the frozen values", () => {
  test.each(Object.entries(frozen))("%s stays %s", (name, value) => {
    expect(frozenBlock(), reason).toContain(`${name}: ${value};`);
  });

  test("the block repeats nothing beyond this list, so the list can't fall behind", () => {
    const names = [...frozenBlock().matchAll(/(--[a-z-]+):/g)].map((match) => match[1]);

    expect(names.sort(), reason).toEqual(Object.keys(frozen).sort());
  });

  test("the card frame is part of the block", () => {
    expect(frozenBlock(), reason).toContain("border: 1px solid var(--color-line);");
    expect(frozenBlock(), reason).toContain("border-radius: var(--radius-card);");
  });

  test("Geist stays in the font link, because the frozen text uses it", () => {
    expect(html, reason).toContain("family=Geist:wght@400;500;600");
  });
});

describe("EmptyState", () => {
  test("it uses the frozen block and stays centered", () => {
    render(<EmptyState title="Nothing here" />);

    const classes = screen.getByText("Nothing here").parentElement?.className ?? "";

    expect(classes, reason).toContain("state-card");
    expect(classes, reason).toContain("items-center");
    expect(classes, reason).toContain("text-center");
  });

  test("its button keeps the classic look, and runs the action", () => {
    const onClick = vi.fn();
    render(<EmptyState title="Nothing here" action={{ label: "Find a table", onClick }} />);
    const button = screen.getByRole("button", { name: "Find a table" });

    button.click();

    expect(button.className, reason).toContain("h-11.5");
    expect(button.className, reason).toContain("hover:bg-fill-primary-hover");
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("ErrorState", () => {
  test("it uses the frozen block and stays centered", () => {
    render(<ErrorState />);

    const classes = screen.getByRole("alert").className;

    expect(classes, reason).toContain("state-card");
    expect(classes, reason).toContain("items-center");
    expect(classes, reason).toContain("text-center");
  });

  test("it keeps its 28px icon", () => {
    render(<ErrorState />);

    const icon = screen.getByRole("alert").querySelector("svg");

    expect(icon?.getAttribute("width"), reason).toBe("28");
    expect(icon?.getAttribute("class"), reason).toContain("text-error");
  });

  test("its retry button keeps the classic ghost look", () => {
    render(<ErrorState onRetry={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Try again" });

    expect(button.className, reason).toContain("h-11.5");
    expect(button.className, reason).toContain("border-line-strong");
  });

  test("while retrying, it keeps the 2px ring", () => {
    render(<ErrorState onRetry={vi.fn()} retrying />);

    const ring = screen.getByRole("button", { name: "Try again" }).querySelector(".animate-spin");

    expect(ring?.className, reason).toContain("border-2");
  });
});

// @vitest-environment jsdom
import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ErrorPage } from "@/pages/ErrorPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NotFoundPage", () => {
  function renderPage(): void {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
  }

  test("it says plainly what happened", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Page not found");
    expect(screen.getByText("404")).toBeDefined();
    expect(
      screen.getByText("The link may be out of date, or the address may have a typo."),
    ).toBeDefined();
  });

  test("the tab title names the page", () => {
    renderPage();

    expect(document.title).toBe("Page not found · Seghan");
  });

  test("it offers one clear way out", () => {
    renderPage();

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
  });

  test("none of the reservation book's wording is left", () => {
    renderPage();

    expect(document.body.textContent).not.toMatch(/in the book|Table \d|guests/);
  });
});

describe("ErrorPage", () => {
  function renderPage(): void {
    render(
      <MemoryRouter>
        <ErrorPage />
      </MemoryRouter>,
    );
  }

  test("screen readers are told at once, in a host's words", () => {
    renderPage();

    const alert = screen.getByRole("alert");

    expect(alert.textContent).toContain("Our apologies");
    expect(alert.textContent).toContain("Something went wrong on our side.");
  });

  test("it uses the protected ErrorState, not a copy of it", () => {
    renderPage();

    expect(screen.getByRole("alert").className).toContain("state-card");
  });

  test("the page still has a heading for screen readers", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Something went wrong");
  });

  test("the tab title names the problem", () => {
    renderPage();

    expect(document.title).toBe("Something went wrong · Seghan");
  });

  test("Try again reloads the page", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reload).toHaveBeenCalledOnce();
  });

  test("the way home is a full page load, as whatever broke may still be in memory", () => {
    // jsdom can't navigate, and says so on the console.
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderPage();
    const link = screen.getByRole("link", { name: "Back to the home page" });
    const click = createEvent.click(link);

    fireEvent(link, click);

    expect(link.getAttribute("href")).toBe("/");
    expect(click.defaultPrevented).toBe(false);
  });
});

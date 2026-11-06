// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { AppLayout } from "@/components/AppLayout";

type TestRouter = ReturnType<typeof createMemoryRouter>;

// jsdom has no scrollTo(), which ScrollRestoration calls.
beforeEach(() => {
  window.scrollTo = vi.fn();
});

afterEach(cleanup);

// StrictMode runs effects twice in development, as main.tsx does, so the tests do too.
function renderApp(path = "/"): TestRouter {
  const router = createMemoryRouter(
    [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <p>The home page</p> },
          { path: "*", element: <p>Another page</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
  return router;
}

test("the page appears inside the shell's main area", () => {
  renderApp();

  const main = screen.getByRole("main");

  expect(main.textContent).toBe("The home page");
});

test("every page has a header and a footer", () => {
  renderApp();

  expect(screen.getByRole("banner")).toBeDefined();
  expect(screen.getByRole("contentinfo")).toBeDefined();
});

test("the skip link is the first stop for the Tab key, and points at the main area", async () => {
  renderApp();

  await userEvent.tab();

  const skip = screen.getByRole("link", { name: "Skip to content" });

  expect(document.activeElement).toBe(skip);
  expect(skip.getAttribute("href")).toBe(`#${screen.getByRole("main").id}`);
});

test("the main area can take focus without adding a Tab stop", () => {
  renderApp();

  expect(screen.getByRole("main").getAttribute("tabindex")).toBe("-1");
});

test("a new page moves focus to its content", async () => {
  const router = renderApp();

  await act(() => router.navigate("/another"));

  expect(screen.getByRole("main").textContent).toBe("Another page");
  expect(document.activeElement).toBe(screen.getByRole("main"));
});

test("the first load leaves focus alone, even when StrictMode runs effects twice", () => {
  renderApp();

  expect(document.activeElement).toBe(document.body);
});

test("a change to only the query string, such as a filter, leaves focus alone", async () => {
  const router = renderApp("/restaurants");
  const logo = screen.getAllByRole("link", { name: "Seghan, home" })[0];
  logo?.focus();

  await act(() => router.navigate("/restaurants?district=KENTRON"));

  expect(document.activeElement).toBe(logo);
});

test("a new page starts at the top", async () => {
  const router = renderApp();
  vi.mocked(window.scrollTo).mockClear();

  await act(() => router.navigate("/another"));

  expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
});

test("going back to a page moves focus again", async () => {
  const router = renderApp();

  await act(() => router.navigate("/another"));
  screen.getByRole("link", { name: "Skip to content" }).focus();
  await act(() => router.navigate("/"));

  expect(document.activeElement).toBe(screen.getByRole("main"));
});

// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import type { RouteObject } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { routes } from "@/router";

beforeEach(() => {
  window.scrollTo = vi.fn();
  // The home page asks the API for its status. A promise that never settles keeps it waiting.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  // React and the router both report a crash on the console, which is expected in these tests.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

function renderRoutes(path: string, table: RouteObject[] = routes): void {
  const router = createMemoryRouter(table, { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function ShellCrash(): never {
  throw new Error("The shell broke");
}

test("the home page says Seghan, in the shell", async () => {
  renderRoutes("/");

  const heading = await screen.findByRole("heading", { level: 1 });

  expect(heading.textContent).toBe("Seghan");
  expect(screen.getByRole("banner")).toBeDefined();
  expect(screen.getByRole("contentinfo")).toBeDefined();
});

test("the old name is gone from the home page", async () => {
  renderRoutes("/");

  await screen.findByRole("heading", { level: 1 });

  expect(document.body.textContent).not.toContain("Yerevan Reservations");
});

test.each(["/nowhere", "/restaurants", "/login", "/a/deep/path"])(
  "%s shows the not-found page in the shell, until a page exists there",
  async (path) => {
    renderRoutes(path);

    const main = await screen.findByRole("main");

    expect(within(main).getByRole("heading", { level: 1 }).textContent).toContain("in the book");
    expect(screen.getByRole("banner")).toBeDefined();
  },
);

describe("when something crashes", () => {
  test("a page's crash keeps the header and footer, so people can move on", async () => {
    renderRoutes("/dev/error");

    const main = await screen.findByRole("main");

    expect(within(main).getByRole("alert").textContent).toContain("Our apologies");
    expect(screen.getByRole("banner")).toBeDefined();
    expect(screen.getByRole("contentinfo")).toBeDefined();
  });

  test("a crash in the shell itself still shows the error page, in a main area", async () => {
    const [shell] = routes;
    renderRoutes("/", [{ ...shell, element: <ShellCrash /> }]);

    const main = await screen.findByRole("main");

    expect(within(main).getByRole("alert").textContent).toContain("Our apologies");
    expect(screen.queryByRole("banner")).toBeNull();
  });
});

test("the crash route doesn't exist in a production build", async () => {
  vi.stubEnv("DEV", false);
  vi.resetModules();
  const production = await import("@/router");

  renderRoutes("/dev/error", production.routes);

  const main = await screen.findByRole("main");

  expect(within(main).getByRole("heading", { level: 1 }).textContent).toContain("in the book");
});

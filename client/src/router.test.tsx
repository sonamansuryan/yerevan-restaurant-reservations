// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import type { RouteObject } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { routes } from "@/router";

// jsdom has neither of the observers the design page uses.
class FakeObserver {
  observe(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  window.scrollTo = vi.fn();
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  vi.stubGlobal("ResizeObserver", FakeObserver);
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

test("/design shows the house style in development, inside the shell", async () => {
  renderRoutes("/design");

  const heading = await screen.findByRole(
    "heading",
    { level: 1, name: "The house style" },
    { timeout: 5000 },
  );

  expect(screen.getByRole("main").contains(heading)).toBe(true);
  expect(screen.getByRole("banner")).toBeDefined();
  expect(screen.getByRole("contentinfo")).toBeDefined();
});

test("/design shows the breathing dot while its code loads, instead of a blank page", async () => {
  renderRoutes("/design");

  const loading = screen.getByRole("status", { name: "Loading the house style" });

  expect(screen.getByRole("main").contains(loading)).toBe(true);
  await screen.findByRole("heading", { level: 1, name: "The house style" }, { timeout: 5000 });
});

describe("in a production build", () => {
  test.each(["/dev/error", "/design"])("%s shows the not-found page", async (path) => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const production = await import("@/router");

    renderRoutes(path, production.routes);

    const main = await screen.findByRole("main");

    expect(within(main).getByRole("heading", { level: 1 }).textContent).toContain("in the book");
  });

  test("no development routes exist at all", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const production = await import("@/router");

    const paths = production.routes[0]?.children?.[0]?.children?.map((route) => route.path);

    expect(paths).toEqual([undefined, "*"]);
  });
});

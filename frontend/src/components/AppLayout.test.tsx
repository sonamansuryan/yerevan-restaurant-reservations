// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AppLayout } from "@/components/AppLayout";
import { ME_QUERY_KEY } from "@/lib/queryClient";
import type { AuthUser } from "@/types/api";

type TestRouter = ReturnType<typeof createMemoryRouter>;

const lilit: AuthUser = {
  id: "user-1",
  email: "lilit@example.com",
  name: "Lilit Harutyunyan",
  phone: null,
  role: "CUSTOMER",
};

beforeEach(() => {
  // jsdom has no scrollTo(), which ScrollRestoration calls.
  window.scrollTo = vi.fn();
  // The header asks who's signed in. A promise that never settles keeps it asking.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// StrictMode runs effects twice in development, as main.tsx does, so the tests do too.
function renderApp(path = "/", client = new QueryClient()): TestRouter {
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
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
  return router;
}

/**
 * Answers like our API would. /api/me knows this person until they sign out, and nothing renews
 * a session. Logout works unless told to fail, and the server unreachable fails everything.
 */
function fakeApi(
  user: AuthUser | null,
  trouble: "none" | "logout fails" | "unreachable" = "none",
): ReturnType<typeof vi.fn> {
  let signedIn = user;
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status });
  const fetch = vi.fn((url: string) => {
    if (trouble === "unreachable") return Promise.reject(new TypeError("Failed to fetch"));
    if (url === "/api/me") {
      return Promise.resolve(
        signedIn
          ? json({ user: signedIn })
          : json({ error: { code: "UNAUTHORIZED", message: "Please sign in." } }, 401),
      );
    }
    if (url === "/api/auth/refresh") {
      return Promise.resolve(json({ error: { code: "SESSION_EXPIRED", message: "Ended." } }, 401));
    }
    if (url === "/api/auth/logout") {
      if (trouble === "logout fails") return Promise.reject(new TypeError("Failed to fetch"));
      signedIn = null;
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return new Promise(() => {});
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
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

describe("who's signed in", () => {
  // The footer always has a Sign in link of its own, so these look inside the header only.
  const header = (): ReturnType<typeof within> => within(screen.getByRole("banner"));

  test("the header asks the server, and shows the person it names", async () => {
    fakeApi(lilit);
    renderApp();

    expect(await header().findByRole("button", { name: "Sign out" })).toBeDefined();
    expect(header().getByText("Lilit")).toBeDefined();
  });

  test("with nobody signed in, the header offers Sign in", async () => {
    fakeApi(null);
    renderApp();

    expect(await header().findByRole("link", { name: "Sign in" })).toBeDefined();
  });

  test("if the server can't be reached, the header offers Sign in, never a wrong name", async () => {
    fakeApi(lilit, "unreachable");
    renderApp();

    expect(await header().findByRole("link", { name: "Sign in" })).toBeDefined();
    expect(header().queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  test("Sign out ends the session on the server, then goes home", async () => {
    const fetch = fakeApi(lilit);
    const router = renderApp("/another");

    await userEvent.click(await header().findByRole("button", { name: "Sign out" }));

    expect(await header().findByRole("link", { name: "Sign in" })).toBeDefined();
    expect(router.state.location.pathname).toBe("/");
    expect(fetch).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  });

  test("Sign out forgets an owner's restaurants too, so the next person never sees them", async () => {
    fakeApi(lilit);
    const client = new QueryClient();
    client.setQueryData(["owner", "restaurants"], { data: [] });
    renderApp("/another", client);

    await userEvent.click(await header().findByRole("button", { name: "Sign out" }));
    await header().findByRole("link", { name: "Sign in" });

    expect(client.getQueryData(["owner", "restaurants"])).toBeUndefined();
  });

  test("if Sign out can't reach the server, the person stays signed in, and is told", async () => {
    fakeApi(lilit, "logout fails");
    const router = renderApp("/another");

    await userEvent.click(await header().findByRole("button", { name: "Sign out" }));

    expect((await header().findByRole("alert")).textContent).toBe("Couldn’t sign out");
    expect(header().getByRole("button", { name: "Sign out" })).toBeDefined();
    expect(router.state.location.pathname).toBe("/another");
  });

  test("once someone is known, a failed check in the background keeps them signed in", async () => {
    fakeApi(lilit);
    const queryClient = new QueryClient();
    const router = createMemoryRouter([
      { element: <AppLayout />, children: [{ index: true, element: <p>The home page</p> }] },
    ]);
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await header().findByRole("button", { name: "Sign out" });

    fakeApi(lilit, "unreachable");
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ME_QUERY_KEY });
      // TanStack Query tells components on the next tick, so give the failure time to show.
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // The check really failed, and the header kept the person anyway.
    expect(queryClient.getQueryState(ME_QUERY_KEY)?.status).toBe("error");
    expect(header().getByRole("button", { name: "Sign out" })).toBeDefined();
    expect(header().queryByRole("link", { name: "Sign in" })).toBeNull();
  });
});

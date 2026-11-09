// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { createMemoryRouter, useLocation } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, expect, test, vi } from "vitest";

import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { SignedOutOnly } from "@/features/auth/components/SignedOutOnly";
import { returnPath, returnStateFor } from "@/features/auth/returnTo";
import { ME_QUERY_KEY } from "@/lib/queryClient";
import type { AuthUser } from "@/types/api";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const lilit: AuthUser = {
  id: "user-1",
  email: "lilit@example.com",
  name: "Lilit Harutyunyan",
  phone: null,
  role: "CUSTOMER",
};
const ani: AuthUser = { ...lilit, id: "user-2", name: "Ani Sargsyan", role: "OWNER" };

type Answer = AuthUser | null | "no answer" | "unreachable";

/** /api/me names this person, says nobody (and there's no session to renew), or never answers. */
function whoIsSignedIn(answer: Answer): void {
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status });
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (answer === "no answer") return new Promise(() => {});
      if (answer === "unreachable") return Promise.reject(new TypeError("Failed to fetch"));
      if (url === "/api/me" && answer) return Promise.resolve(json({ user: answer }));
      return Promise.resolve(json({ error: { code: "UNAUTHORIZED", message: "Sign in." } }, 401));
    }),
  );
}

// Stands in for the Sign in page, and shows where it would send the person next.
function SignInStandIn(): ReactElement {
  return <p>Sign in, then go to {returnPath(useLocation().state)}</p>;
}

function renderAt(entry: string | { pathname: string; state: unknown }): {
  router: ReturnType<typeof createMemoryRouter>;
  queryClient: QueryClient;
} {
  const router = createMemoryRouter(
    [
      { element: <SignedOutOnly />, children: [{ path: "/login", element: <SignInStandIn /> }] },
      {
        element: <RequireAuth />,
        children: [{ path: "/reservations", element: <p>My reservations</p> }],
      },
      {
        element: <RequireAuth roles={["OWNER"]} notAllowedTitle="This page is for restaurants" />,
        children: [{ path: "/dashboard", element: <p>The dashboard</p> }],
      },
      { path: "/", element: <p>Home</p> },
    ],
    { initialEntries: [entry] },
  );
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

test("someone signed out is sent to Sign in, carrying where they were heading", async () => {
  whoIsSignedIn(null);
  const { router } = renderAt("/reservations?tab=past#r-1");

  expect(await screen.findByText("Sign in, then go to /reservations?tab=past#r-1")).toBeDefined();
  expect(router.state.location.pathname).toBe("/login");
  // The page is replaced, not added to, so Back doesn't bounce between it and Sign in.
  expect(router.state.historyAction).toBe("REPLACE");
});

test("someone signed in sees the page", async () => {
  whoIsSignedIn(lilit);
  renderAt("/reservations");

  expect(await screen.findByText("My reservations")).toBeDefined();
});

test("a guest is told an owner page is for restaurants, and offered the way home", async () => {
  whoIsSignedIn(lilit);
  renderAt("/dashboard");

  const heading = await screen.findByRole("heading", { level: 1 });

  expect(heading.textContent).toBe("This page is for restaurants");
  expect(screen.getByText("You’re signed in as Lilit Harutyunyan.")).toBeDefined();
  expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
  expect(screen.queryByText("The dashboard")).toBeNull();
});

test("an owner sees the owner page", async () => {
  whoIsSignedIn(ani);
  renderAt("/dashboard");

  expect(await screen.findByText("The dashboard")).toBeDefined();
});

test("while the app is still checking, it decides nothing, and shows the breathing dot", () => {
  whoIsSignedIn("no answer");
  const { router } = renderAt("/reservations");

  expect(screen.getByRole("status", { name: "Checking your account" })).toBeDefined();
  expect(screen.queryByText("My reservations")).toBeNull();
  expect(router.state.location.pathname).toBe("/reservations");
});

test("if the server can't say who's signed in, it says so, and Try again asks again", async () => {
  whoIsSignedIn("unreachable");
  renderAt("/reservations");

  expect((await screen.findByRole("alert")).textContent).toContain(
    "We couldn’t check your account.",
  );

  whoIsSignedIn(lilit);
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));

  expect(await screen.findByText("My reservations")).toBeDefined();
});

test("once there's an answer, a failed check in the background leaves the page alone", async () => {
  whoIsSignedIn(lilit);
  const { queryClient } = renderAt("/reservations");
  await screen.findByText("My reservations");

  whoIsSignedIn("unreachable");
  await act(async () => {
    await queryClient.refetchQueries({ queryKey: ME_QUERY_KEY });
    // TanStack Query tells components on the next tick, so give the failure time to show.
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  // The check really failed, and the page stayed anyway.
  expect(queryClient.getQueryState(ME_QUERY_KEY)?.status).toBe("error");
  expect(screen.getByText("My reservations")).toBeDefined();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("someone signed in who opens Sign in goes on to where they were heading", async () => {
  whoIsSignedIn(lilit);
  const state = returnStateFor({ pathname: "/reservations", search: "", hash: "" });
  const { router } = renderAt({ pathname: "/login", state });

  expect(await screen.findByText("My reservations")).toBeDefined();
  expect(router.state.historyAction).toBe("REPLACE");
});

test("…or home, if they weren't heading anywhere", async () => {
  whoIsSignedIn(lilit);
  renderAt("/login");

  expect(await screen.findByText("Home")).toBeDefined();
});
